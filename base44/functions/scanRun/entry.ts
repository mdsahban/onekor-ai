import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { secrets } from 'base44:runtime';
import { getConnector } from '../../shared/connectors.ts';
import { runDiscoveryPipeline } from '../../shared/discovery-pipeline.ts';
import { resolveToken } from '../../shared/github-client.ts';
import { runAiPlatformPipeline } from '../../shared/ai-platform-pipeline.ts';

const STAGE_TO_CATEGORY = {
  connect: 'connection', authenticate: 'connection', fetch: 'processing',
  normalize: 'processing', classify: 'detection', deduplicate: 'dedup',
  correlate: 'dedup', enrich: 'enrichment', upsert: 'enrichment',
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { templateId, profileId, sourceId: testSourceId } = body;

    let template, profileIds, sourceIds, templateName, templateRefId;

    if (templateId) {
      const page = await base44.entities.ScanTemplate.filter({ id: templateId }, { limit: 1 });
      template = page.items && page.items[0];
      if (!template) return Response.json({ error: 'Template not found' }, { status: 404 });
      if (!template.enabled) return Response.json({ error: 'Template is disabled' }, { status: 400 });
      profileIds = template.profile_ids || [];
      sourceIds = template.source_ids || [];
      templateName = template.name;
      templateRefId = templateId;
    } else if (profileId && testSourceId) {
      profileIds = [profileId];
      sourceIds = [testSourceId];
      templateName = 'Test Detection';
      templateRefId = null;
    } else {
      return Response.json({ error: 'templateId or (profileId + sourceId) is required' }, { status: 400 });
    }

    if (sourceIds.length === 0) return Response.json({ error: 'No sources selected' }, { status: 400 });
    if (profileIds.length === 0) return Response.json({ error: 'No profiles selected' }, { status: 400 });

    // Read detection profiles and flatten rules
    const profilePages = await Promise.all(profileIds.map((id) => base44.entities.DetectionProfile.filter({ id }, { limit: 1 })));
    const profiles = profilePages.map((p) => p.items && p.items[0]).filter(Boolean);
    if (profiles.length === 0) return Response.json({ error: 'No valid detection profiles found' }, { status: 400 });

    const allRules = [];
    let aiModelId = null;
    for (const profile of profiles) {
      if (!profile.enabled) continue;
      if (profile.ai_model_id && !aiModelId) aiModelId = profile.ai_model_id;
      for (const rule of (profile.detection_rules || [])) {
        allRules.push({
          name: rule.label || rule.pattern,
          type: rule.type,
          pattern: rule.pattern,
          asset_type: rule.asset_type || profile.asset_type || 'ai_application',
          provider: rule.provider || profile.provider || 'unknown',
          confidence: rule.confidence || 'medium',
          enabled: true,
        });
      }
    }

    // Read sources
    const sourcePages = await Promise.all(sourceIds.map((id) => base44.entities.DiscoverySource.filter({ id }, { limit: 1 })));
    const sources = sourcePages.map((p) => p.items && p.items[0]).filter(Boolean);
    if (sources.length === 0) return Response.json({ error: 'No valid sources found' }, { status: 404 });

    // Create the scan
    const now = new Date().toISOString();
    const scan = await base44.entities.Scan.create({
      template_id: templateRefId || 'test',
      template_name: templateName,
      source_ids: sourceIds,
      profile_ids: profileIds,
      status: 'running',
      started_at: now,
      progress: 0,
      ai_model_id: aiModelId,
      run_ids: [],
    });

    const log = (severity, category, message, sourceId, details) =>
      base44.entities.ScanLog.create({
        scan_id: scan.id, template_id: templateRefId, source_id: sourceId || null,
        severity, category, message, details,
      });

    await log('info', 'lifecycle', `Scan started: ${sources.length} source(s), ${profiles.length} profile(s), ${allRules.length} detection rules.`);

    let totalFindings = 0, totalHigh = 0, totalLow = 0, totalProcessed = 0, totalSkipped = 0, totalErrors = 0;
    const runIds = [];
    let hasErrors = false;

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const progress = Math.round((i / sources.length) * 100);
      await base44.entities.Scan.update(scan.id, { progress, current_source: source.name });
      await log('info', 'lifecycle', `Starting source "${source.name}" (${source.connector_id}).`, source.id);

      try {
        const run = await base44.entities.DiscoveryRun.create({
          source_id: source.id, source_name: source.name, connector_id: source.connector_id,
          status: 'starting', started_at: new Date().toISOString(),
        });
        runIds.push(run.id);

        let result;

        if (source.connector_id === 'openai' || source.connector_id === 'anthropic') {
          const config = source.config || {};
          if (!config._api_key) {
            await log('error', 'connection', `Source "${source.name}" has no API key. Skipping.`, source.id);
            await base44.entities.DiscoveryRun.update(run.id, { status: 'failed', completed_at: new Date().toISOString(), error_message: 'No API key' });
            totalErrors++; hasErrors = true; continue;
          }
          await base44.entities.DiscoveryRun.update(run.id, { status: 'connecting' });
          result = await runAiPlatformPipeline(base44, source, run.id);
        } else if (source.connector_id === 'github') {
          const config = source.config || {};
          const hasInlineCreds = config._token || (config._app_id && config._private_key && config._installation_id);
          let token;
          if (hasInlineCreds) {
            const tokenResult = await resolveToken(source);
            if (!tokenResult.ok) {
              await log('error', 'connection', `Auth failed for "${source.name}": ${tokenResult.error}`, source.id);
              await base44.entities.DiscoveryRun.update(run.id, { status: 'failed', completed_at: new Date().toISOString(), error_message: tokenResult.error });
              totalErrors++; hasErrors = true; continue;
            }
            token = tokenResult.token;
          } else {
            token = secrets.get('GITHUB_TOKEN');
            if (!token) {
              await log('error', 'connection', `No GitHub credentials for "${source.name}".`, source.id);
              await base44.entities.DiscoveryRun.update(run.id, { status: 'failed', completed_at: new Date().toISOString(), error_message: 'No GitHub credentials' });
              totalErrors++; hasErrors = true; continue;
            }
          }
          await base44.entities.DiscoveryRun.update(run.id, { status: 'connecting' });
          result = await runDiscoveryPipeline(base44, source, run.id, token, { rules: allRules });
        } else {
          await log('warn', 'connector', `Connector "${source.connector_id}" not supported. Skipping.`, source.id);
          await base44.entities.DiscoveryRun.update(run.id, { status: 'failed', completed_at: new Date().toISOString(), error_message: 'Unsupported connector' });
          totalSkipped++; continue;
        }

        // Bulk create discovery logs
        if (result.logs && result.logs.length > 0) {
          await base44.entities.DiscoveryLog.bulkCreate(result.logs);
          for (const l of result.logs) {
            await log(l.severity === 'error' ? 'error' : l.severity === 'warn' ? 'warn' : 'info',
              STAGE_TO_CATEGORY[l.stage] || 'lifecycle', l.message, source.id, { duration_ms: l.duration_ms });
          }
        }

        const completedAt = new Date().toISOString();
        if (result.failed) {
          await base44.entities.DiscoveryRun.update(run.id, { status: 'failed', completed_at: completedAt, error_message: result.error });
          totalErrors++; hasErrors = true;
          await log('error', 'error', `Detection failed for "${source.name}": ${result.error}`, source.id);
        } else {
          await base44.entities.DiscoveryRun.update(run.id, {
            status: 'completed', completed_at: completedAt,
            repositories_scanned: result.reposScanned || 0, signals_detected: result.signalsDetected || 0,
            findings_created: result.findingsCreated || 0, assets_created: result.assetsCreated || 0,
            assets_updated: result.assetsUpdated || 0, duplicates_detected: result.duplicatesDetected || 0,
          });
          const findings = result.allFindings || [];
          totalFindings += findings.length;
          totalHigh += findings.filter((f) => (f.confidence_score || 0) >= 0.75).length;
          totalLow += findings.filter((f) => (f.confidence_score || 0) < 0.5).length;
          totalProcessed += result.reposScanned || result.modelsDiscovered || 0;
          await log('info', 'lifecycle', `Source "${source.name}" done: ${findings.length} findings, ${result.assetsCreated || 0} new, ${result.assetsUpdated || 0} updated.`, source.id);
        }
      } catch (srcErr) {
        totalErrors++; hasErrors = true;
        await log('error', 'error', `Error on "${source.name}": ${srcErr.message}`, source.id);
      }
    }

    // AI-assisted classification (if profiles have ai_prompt and a validated model)
    const profilesWithAi = profiles.filter((p) => p.ai_prompt && p.ai_model_id);
    if (profilesWithAi.length > 0 && aiModelId) {
      const modelPage = await base44.entities.AiModel.filter({ id: aiModelId }, { limit: 1 });
      const aiModel = modelPage.items && modelPage.items[0];
      if (aiModel && aiModel.is_validated) {
        await log('info', 'ai_model', `Running AI-assisted classification using ${aiModel.display_name || aiModel.model_id}.`);
        try {
          const combinedPrompt = profilesWithAi.map((p) => p.ai_prompt).join('\n\n');
          const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `${combinedPrompt}\n\nAnalyze the following detected signals and provide classification guidance:\n${JSON.stringify(allRules.map((r) => ({ pattern: r.pattern, type: r.type, provider: r.provider })))}`,
          });
          await log('info', 'ai_model', 'AI-assisted classification completed.', null, { response_length: String(llmResult).length });
        } catch (aiErr) {
          await log('warn', 'ai_model', `AI classification skipped: ${aiErr.message}`);
        }
      } else {
        await log('warn', 'ai_model', 'AI model not validated. Skipping AI-assisted classification.');
      }
    }

    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(now).getTime();
    const finalStatus = hasErrors && totalFindings > 0 ? 'partially_completed' : hasErrors ? 'failed' : 'completed';

    await base44.entities.Scan.update(scan.id, {
      status: finalStatus, completed_at: completedAt, duration_ms: durationMs, progress: 100,
      resources_processed: totalProcessed, resources_skipped: totalSkipped,
      findings_count: totalFindings, high_confidence_findings: totalHigh,
      low_confidence_findings: totalLow, errors_count: totalErrors,
      run_ids: runIds, current_source: null,
    });

    if (templateRefId && template) {
      await base44.entities.ScanTemplate.update(templateRefId, { last_run_at: now });
    }

    await base44.entities.AuditEvent.create({
      action: 'scan_completed', resource_type: 'scan', resource_id: scan.id,
      result: hasErrors ? 'failure' : 'success',
      details: { template_id: templateRefId, sources: sources.length, profiles: profiles.length, findings: totalFindings, high_confidence: totalHigh, errors: totalErrors },
    });

    await log(hasErrors ? 'warn' : 'info', 'lifecycle', `Scan ${finalStatus}: ${totalFindings} findings, ${totalHigh} high-confidence, ${totalErrors} errors, ${durationMs}ms.`);

    return Response.json({
      scan_id: scan.id, status: finalStatus, findings_count: totalFindings,
      high_confidence_findings: totalHigh, low_confidence_findings: totalLow,
      resources_processed: totalProcessed, errors_count: totalErrors, duration_ms: durationMs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}