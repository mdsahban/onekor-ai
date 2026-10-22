import { getAuthenticatedUser, listRepositories, getRepoTree, getFileContent, identifyInterestingFiles } from './github-client.ts';
import { DEFAULT_RULES } from './detection-rules.ts';

const CONFIDENCE_MAP = { high: 0.9, medium: 0.6, low: 0.3 };

function matchPackageJson(content, rules) {
  const matches = [];
  try {
    const pkg = JSON.parse(content);
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const [name] of Object.entries(deps)) {
      for (const rule of rules) {
        if (rule.type === 'package' && name.toLowerCase().includes(rule.pattern.toLowerCase())) {
          matches.push({ rule, evidence: { package: name, file_type: 'package_json' } });
        }
      }
    }
  } catch (e) { /* not valid JSON */ }
  return matches;
}

function matchRequirementsTxt(content, rules) {
  const matches = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;
    const pkgName = trimmed.split(/[=<>!~\[\s]/)[0].toLowerCase();
    if (!pkgName) continue;
    for (const rule of rules) {
      if (rule.type === 'package' && (pkgName === rule.pattern.toLowerCase() || pkgName.includes(rule.pattern.toLowerCase()))) {
        matches.push({ rule, evidence: { package: pkgName, file_type: 'requirements_txt' } });
      }
    }
  }
  return matches;
}

function matchTextContent(content, rules, fileType) {
  const matches = [];
  const lower = content.toLowerCase();
  const lines = content.split('\n');
  for (const rule of rules) {
    if (rule.type === 'package') continue;
    if (lower.includes(rule.pattern.toLowerCase())) {
      let lineNum = null;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(rule.pattern.toLowerCase())) {
          lineNum = i + 1;
          break;
        }
      }
      matches.push({ rule, evidence: { line: lineNum, file_type: fileType, matched_text: rule.pattern } });
    }
  }
  return matches;
}

function matchFile(content, fileType, rules) {
  switch (fileType) {
    case 'package_json':
      return matchPackageJson(content, rules);
    case 'requirements_txt':
      return matchRequirementsTxt(content, rules);
    default:
      return matchTextContent(content, rules, fileType);
  }
}

function computeConfidence(matchedRules) {
  if (matchedRules.length === 0) return { score: 0, level: 'low', reasons: [] };
  let maxScore = 0;
  const reasons = [];
  const seenRules = new Set();
  for (const m of matchedRules) {
    const score = CONFIDENCE_MAP[m.rule.confidence] || 0.3;
    if (score > maxScore) maxScore = score;
    if (!seenRules.has(m.rule.name)) {
      reasons.push(`${m.rule.name} detected`);
      seenRules.add(m.rule.name);
    }
  }
  // Boost confidence if multiple distinct rules match
  const distinctRules = seenRules.size;
  let score = maxScore;
  if (distinctRules >= 3) score = Math.min(0.98, score + 0.08);
  if (distinctRules >= 5) score = Math.min(0.99, score + 0.05);
  const level = score >= 0.75 ? 'high' : score >= 0.5 ? 'medium' : 'low';
  return { score: Math.round(score * 100) / 100, level, reasons };
}

function determineAssetType(matchedRules) {
  // Priority: ai_agent > ai_application > ai_api > ai_model > ai_integration
  const typePriority = ['ai_agent', 'ai_application', 'ai_api', 'ai_model', 'ai_integration'];
  const typeCounts = {};
  for (const m of matchedRules) {
    const t = m.rule.asset_type;
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  for (const t of typePriority) {
    if (typeCounts[t]) return t;
  }
  return 'ai_application';
}

function determineProvider(matchedRules) {
  const providerCounts = {};
  for (const m of matchedRules) {
    const p = m.rule.provider;
    providerCounts[p] = (providerCounts[p] || 0) + 1;
  }
  let maxCount = 0;
  let topProvider = 'unknown';
  for (const [p, c] of Object.entries(providerCounts)) {
    if (c > maxCount) {
      maxCount = c;
      topProvider = p;
    }
  }
  return topProvider;
}

export async function runDiscoveryPipeline(base44, source, runId, token, options = {}) {
  const config = source.config || {};
  const org = config.organization || '';
  const repoFilter = config.repositories || [];
  const branchFilter = config.branch || '';
  const pathFilter = config.path_filter || '';

  // Read enabled rules from entity, fall back to defaults
  let rules = options.rules;
  if (!rules || rules.length === 0) {
    try {
      const page = await base44.entities.DiscoveryRule.filter({ enabled: true }, { limit: 200 });
      rules = page.items && page.items.length > 0 ? page.items : DEFAULT_RULES;
    } catch (e) {
      rules = DEFAULT_RULES;
    }
  }

  const logs = [];
  const allFindings = [];
  let findingsCreated = 0;
  let reposScanned = 0;
  let signalsDetected = 0;
  let duplicatesDetected = 0;

  // Stage: CONNECT
  logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'connect', message: 'Connecting to GitHub.' });
  const userResult = await getAuthenticatedUser(token);
  if (!userResult.ok) {
    logs.push({ run_id: runId, source_id: source.id, severity: 'error', stage: 'connect', message: userResult.error });
    return { logs, allFindings: [], reposScanned, signalsDetected, duplicatesDetected, failed: true, error: userResult.error };
  }
  logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'authenticate', message: `Authenticated as ${userResult.user.login}.`, duration_ms: userResult.latency });

  // Stage: FETCH — list repositories
  const repoResult = await listRepositories(token, org, { repoFilter });
  if (!repoResult.ok) {
    logs.push({ run_id: runId, source_id: source.id, severity: 'error', stage: 'fetch', message: repoResult.error });
    return { logs, allFindings: [], reposScanned, signalsDetected, duplicatesDetected, failed: true, error: repoResult.error };
  }
  const repos = repoResult.repos;
  logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'fetch', message: `Found ${repos.length} repositories.`, duration_ms: repoResult.latency });

  // Limit repos for timeout safety
  const maxRepos = 20;
  const reposToScan = repos.slice(0, maxRepos);
  if (repos.length > maxRepos) {
    logs.push({ run_id: runId, source_id: source.id, severity: 'warn', stage: 'fetch', message: `Limiting scan to first ${maxRepos} repositories for performance.` });
  }

  // Stage: FETCH + NORMALIZE + CLASSIFY — scan each repo
  for (const repo of reposToScan) {
    const repoFullName = repo.full_name;
    logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'fetch', message: `Scanning repository ${repoFullName}.` });
    reposScanned++;

    const treeResult = await getRepoTree(token, repo.owner.login, repo.name, branchFilter);
    if (!treeResult.ok) {
      logs.push({ run_id: runId, source_id: source.id, severity: 'warn', stage: 'fetch', message: `Skipped ${repoFullName}: ${treeResult.error}` });
      continue;
    }

    const interestingFiles = identifyInterestingFiles(treeResult.tree, pathFilter);
    if (interestingFiles.length === 0) {
      logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'classify', message: `No AI-related files found in ${repoFullName}.` });
      continue;
    }

    // Fetch file contents in parallel batches of 6
    const batchSize = 6;
    const allMatches = [];
    for (let i = 0; i < interestingFiles.length; i += batchSize) {
      const batch = interestingFiles.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (f) => {
          const contentResult = await getFileContent(token, repo.owner.login, repo.name, f.path, treeResult.defaultBranch);
          if (!contentResult.ok) return null;
          const matches = matchFile(contentResult.content, f.fileType, rules);
          return { file: f, matches };
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value && r.value.matches.length > 0) {
          for (const m of r.value.matches) {
            allMatches.push({
              rule: m.rule,
              evidence: {
                repository: repoFullName,
                file: r.value.file.path,
                file_type: r.value.evidence.file_type,
                ...m.evidence,
              },
            });
          }
        }
      }
    }

    if (allMatches.length === 0) {
      logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'classify', message: `No AI signals detected in ${repoFullName}.` });
      continue;
    }

    signalsDetected += allMatches.length;
    const signalNames = [...new Set(allMatches.map((m) => m.rule.name))];
    logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'classify', message: `Detected ${allMatches.length} AI signal(s) in ${repoFullName}: ${signalNames.join(', ')}.` });

    // Create a finding per repository (deduplicated within repo)
    const confidence = computeConfidence(allMatches);
    const assetType = determineAssetType(allMatches);
    const provider = determineProvider(allMatches);
    const externalId = `github:${repoFullName}`;

    // Check for existing finding with same external_id
    const existingPage = await base44.entities.DiscoveryFinding.filter({ external_id: externalId }, { limit: 1 });
    const existing = existingPage.items && existingPage.items[0];

    const findingData = {
      source_id: source.id,
      run_id: runId,
      external_id: externalId,
      name: repo.name,
      provider,
      asset_type: assetType,
      confidence_score: confidence.score,
      confidence_level: confidence.level,
      confidence_reasons: confidence.reasons,
      evidence: {
        repository: repoFullName,
        url: repo.html_url,
        signals: signalNames,
        files_scanned: interestingFiles.length,
        matches: allMatches.map((m) => ({
          rule: m.rule.name,
          rule_type: m.rule.type,
          file: m.evidence.file,
          file_type: m.evidence.file_type,
          line: m.evidence.line || null,
          package: m.evidence.package || null,
        })),
      },
      status: 'classified',
    };

    if (existing) {
      // Update existing finding
      await base44.entities.DiscoveryFinding.update(existing.id, findingData);
      allFindings.push({ ...findingData, id: existing.id });
      duplicatesDetected++;
      logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'deduplicate', message: `Updated existing finding for ${repoFullName}.` });
    } else {
      const created = await base44.entities.DiscoveryFinding.create(findingData);
      allFindings.push(created);
      findingsCreated++;
    }
  }

  // Stage: ENRICH + UPSERT — create/update AI assets
  let assetsCreated = 0;
  let assetsUpdated = 0;

  for (const finding of allFindings) {
    if (!finding.external_id) continue;
    // Check if an AiAssetSource already links to this external_id
    const linkPage = await base44.entities.AiAssetSource.filter({ external_id: finding.external_id }, { limit: 1 });
    const existingLink = linkPage.items && linkPage.items[0];

    const now = new Date().toISOString();
    const assetData = {
      name: finding.name,
      display_name: finding.name,
      asset_type: finding.asset_type,
      provider: finding.provider,
      confidence_score: finding.confidence_score,
      first_seen: existingLink ? undefined : now,
      last_seen: now,
      status: 'active',
      enriched_data: {
        repository: finding.evidence?.repository,
        url: finding.evidence?.url,
        signals: finding.evidence?.signals,
        environment: 'github',
      },
    };

    if (existingLink) {
      // Update existing asset
      const updateData = { ...assetData };
      delete updateData.first_seen;
      await base44.entities.AiAsset.update(existingLink.asset_id, updateData);
      await base44.entities.AiAssetSource.update(existingLink.id, { last_seen: now });
      assetsUpdated++;
      logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'upsert', message: `Updated existing AI asset: ${finding.name}.` });
    } else {
      // Create new asset
      const asset = await base44.entities.AiAsset.create(assetData);
      await base44.entities.AiAssetSource.create({
        asset_id: asset.id,
        source_id: source.id,
        external_id: finding.external_id,
        first_seen: now,
        last_seen: now,
      });
      // Update finding with asset_id
      await base44.entities.DiscoveryFinding.update(finding.id || finding._id, { asset_id: asset.id, status: 'asset_created' });
      assetsCreated++;
      logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'upsert', message: `Created new AI asset: ${finding.name}.` });
    }
  }

  logs.push({ run_id: runId, source_id: source.id, severity: 'info', stage: 'upsert', message: 'Discovery completed.' });

  return {
    logs,
    allFindings,
    reposScanned,
    signalsDetected,
    duplicatesDetected,
    assetsCreated,
    assetsUpdated,
    findingsCreated,
    failed: false,
  };
}