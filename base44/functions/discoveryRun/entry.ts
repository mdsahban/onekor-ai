import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { secrets } from 'base44:runtime';
import { getConnector } from '../../shared/connectors.ts';
import { runDiscoveryPipeline } from '../../shared/discovery-pipeline.ts';
import { resolveToken } from '../../shared/github-client.ts';
import { runAiPlatformPipeline } from '../../shared/ai-platform-pipeline.ts';
import { runAzurePipeline, runAWSPipeline, runGCPPipeline } from '../../shared/cloud-pipeline.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { sourceId } = body;
    if (!sourceId) return Response.json({ error: 'sourceId is required' }, { status: 400 });

    // Read the source
    const page = await base44.entities.DiscoverySource.filter({ id: sourceId }, { limit: 1 });
    const source = page.items && page.items[0];
    if (!source) return Response.json({ error: 'Source not found' }, { status: 404 });
    if (!source.enabled) return Response.json({ error: 'Source is disabled. Enable it before running discovery.' }, { status: 400 });

    const connector = getConnector(source.connector_id);
    if (!connector) return Response.json({ error: 'Unknown connector type' }, { status: 400 });
    if (connector.status !== 'available' && connector.status !== 'beta') {
      return Response.json({ error: `Connector "${connector.name}" is ${connector.status}.` }, { status: 400 });
    }

    // Create the run
    const now = new Date().toISOString();
    const run = await base44.entities.DiscoveryRun.create({
      source_id: source.id,
      source_name: source.name,
      connector_id: source.connector_id,
      status: 'starting',
      started_at: now,
    });

    // Create initial log
    await base44.entities.DiscoveryLog.create({
      run_id: run.id,
      source_id: source.id,
      severity: 'info',
      stage: 'connect',
      message: `Starting discovery for source "${source.name}".`,
    });

    // ─── AI Platform connectors (OpenAI, Anthropic) ───
    if (source.connector_id === 'openai' || source.connector_id === 'anthropic') {
      const config = source.config || {};
      const resolvedKey = config._api_key || config.apiKey || (source.connector_id === 'openai' ? secrets.get('OPENAI_API_KEY') : secrets.get('ANTHROPIC_API_KEY'));
      if (!resolvedKey) {
        await base44.entities.DiscoveryRun.update(run.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: 'No API key configured. Enter your API key during source setup.',
        });
        await base44.entities.DiscoveryLog.create({
          run_id: run.id, source_id: source.id, severity: 'error', stage: 'connect',
          message: 'No API key configured. Enter your API key during source setup.',
        });
        await base44.entities.DiscoverySource.update(source.id, { connection_status: 'not_configured', errors_count: (source.errors_count || 0) + 1 });
        return Response.json({ error: 'No API key configured. Enter your API key during source setup.' }, { status: 400 });
      }
      if (!config._api_key) config._api_key = resolvedKey;

      await base44.entities.DiscoveryRun.update(run.id, { status: 'connecting' });

      const result = await runAiPlatformPipeline(base44, source, run.id);

      // Bulk create logs
      if (result.logs.length > 0) {
        await base44.entities.DiscoveryLog.bulkCreate(result.logs);
      }

      const completedAt = new Date().toISOString();
      const durationMs = new Date(completedAt).getTime() - new Date(now).getTime();

      if (result.failed) {
        await base44.entities.DiscoveryRun.update(run.id, {
          status: 'failed', completed_at: completedAt, duration_ms: durationMs,
          error_message: result.error,
          signals_detected: result.modelsDiscovered || 0,
        });
        await base44.entities.DiscoverySource.update(source.id, {
          connection_status: 'error', last_scan_at: now, errors_count: (source.errors_count || 0) + 1,
        });
        return Response.json({
          run_id: run.id, status: 'failed', error: result.error,
          signals_detected: result.modelsDiscovered || 0, duration_ms: durationMs,
        });
      }

      await base44.entities.DiscoveryRun.update(run.id, {
        status: 'completed', completed_at: completedAt, duration_ms: durationMs,
        signals_detected: result.modelsDiscovered,
        findings_created: result.assetsCreated,
        assets_created: result.assetsCreated,
        assets_updated: result.assetsUpdated,
        duplicates_detected: result.duplicatesDetected,
      });

      await base44.entities.DiscoverySource.update(source.id, {
        connection_status: 'connected',
        last_scan_at: now, last_successful_scan: now,
        assets_discovered: (source.assets_discovered || 0) + result.assetsCreated,
        new_assets: result.assetsCreated, updated_assets: result.assetsUpdated,
        errors_count: 0,
        metadata: {
          provider: source.connector_id,
          organizations: result.organizations || [],
          models_discovered: result.modelsDiscovered,
          last_successful_scan: now,
          first_connected: source.metadata?.first_connected || now,
          last_updated: now,
          connector_version: '1.0.0',
          discovery_version: '1.0.0',
        },
      });

      await base44.entities.AuditEvent.create({
        action: 'discovery_completed', resource_type: 'discovery_source', resource_id: source.id,
        result: 'success', details: {
          run_id: run.id, models_discovered: result.modelsDiscovered,
          assets_created: result.assetsCreated, assets_updated: result.assetsUpdated,
        },
      });

      return Response.json({
        run_id: run.id, status: 'completed',
        signals_detected: result.modelsDiscovered,
        findings_created: result.assetsCreated,
        assets_created: result.assetsCreated, assets_updated: result.assetsUpdated,
        duplicates_detected: result.duplicatesDetected, duration_ms: durationMs,
      });
    }

    // ─── Cloud connectors (Azure, AWS, GCP) ───
    if (source.connector_id === 'azure' || source.connector_id === 'aws' || source.connector_id === 'gcp') {
      await base44.entities.DiscoveryRun.update(run.id, { status: 'connecting' });

      let result: any;
      if (source.connector_id === 'azure') {
        result = await runAzurePipeline(base44, source, run.id);
      } else if (source.connector_id === 'aws') {
        result = await runAWSPipeline(base44, source, run.id);
      } else {
        result = await runGCPPipeline(base44, source, run.id);
      }

      // Bulk create logs
      if (result.logs && result.logs.length > 0) {
        await base44.entities.DiscoveryLog.bulkCreate(result.logs);
      }

      const completedAt = new Date().toISOString();
      const durationMs = new Date(completedAt).getTime() - new Date(now).getTime();

      if (result.failed) {
        await base44.entities.DiscoveryRun.update(run.id, {
          status: 'failed', completed_at: completedAt, duration_ms: durationMs,
          error_message: result.error,
          signals_detected: result.resourcesDiscovered || 0,
        });
        await base44.entities.DiscoverySource.update(source.id, {
          connection_status: 'error', last_scan_at: now, errors_count: (source.errors_count || 0) + 1,
        });
        return Response.json({
          run_id: run.id, status: 'failed', error: result.error,
          signals_detected: result.resourcesDiscovered || 0, duration_ms: durationMs,
        });
      }

      await base44.entities.DiscoveryRun.update(run.id, {
        status: 'completed', completed_at: completedAt, duration_ms: durationMs,
        signals_detected: result.resourcesDiscovered,
        findings_created: result.assetsCreated,
        assets_created: result.assetsCreated,
        assets_updated: result.assetsUpdated,
        duplicates_detected: result.duplicatesDetected,
      });

      await base44.entities.DiscoverySource.update(source.id, {
        connection_status: 'connected',
        last_scan_at: now, last_successful_scan: now,
        assets_discovered: (source.assets_discovered || 0) + result.assetsCreated,
        new_assets: result.assetsCreated, updated_assets: result.assetsUpdated,
        errors_count: 0,
        metadata: {
          provider: source.connector_id,
          resources_discovered: result.resourcesDiscovered,
          last_successful_scan: now,
          first_connected: source.metadata?.first_connected || now,
          last_updated: now,
          connector_version: '1.0.0',
          discovery_version: '1.0.0',
        },
      });

      await base44.entities.AuditEvent.create({
        action: 'discovery_completed', resource_type: 'discovery_source', resource_id: source.id,
        result: 'success', details: {
          run_id: run.id, resources_discovered: result.resourcesDiscovered,
          assets_created: result.assetsCreated, assets_updated: result.assetsUpdated,
        },
      });

      return Response.json({
        run_id: run.id, status: 'completed',
        signals_detected: result.resourcesDiscovered,
        findings_created: result.assetsCreated,
        assets_created: result.assetsCreated, assets_updated: result.assetsUpdated,
        duplicates_detected: result.duplicatesDetected, duration_ms: durationMs,
      });
    }

    // ─── GitHub connector ───
    // Resolve the token — supports inline PAT, inline GitHub App, or GITHUB_TOKEN secret
    let token;
    const config = source.config || {};
    const hasInlineCreds = config._token || config.token || (config._app_id && config._private_key && config._installation_id) || (config.appId && config.privateKey && config.installationId);
    if (hasInlineCreds) {
      const tokenResult = await resolveToken(source);
      if (!tokenResult.ok) {
        await base44.entities.DiscoveryRun.update(run.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: tokenResult.error,
        });
        await base44.entities.DiscoveryLog.create({
          run_id: run.id,
          source_id: source.id,
          severity: 'error',
          stage: 'connect',
          message: tokenResult.error,
        });
        await base44.entities.DiscoverySource.update(source.id, { connection_status: 'authentication_failed', errors_count: (source.errors_count || 0) + 1 });
        return Response.json({ error: tokenResult.error }, { status: 400 });
      }
      token = tokenResult.token;
    } else {
      token = secrets.get('GITHUB_TOKEN');
      if (!token) {
        await base44.entities.DiscoveryRun.update(run.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: 'No GitHub credentials configured. Enter a token during source setup or set GITHUB_TOKEN in Dashboard → Secrets.',
        });
        await base44.entities.DiscoveryLog.create({
          run_id: run.id,
          source_id: source.id,
          severity: 'error',
          stage: 'connect',
          message: 'No GitHub credentials configured. Enter a token during source setup or set GITHUB_TOKEN in Dashboard → Secrets (Environment Variables).',
        });
        await base44.entities.DiscoverySource.update(source.id, { connection_status: 'not_configured', errors_count: (source.errors_count || 0) + 1 });
        return Response.json({ error: 'No GitHub credentials configured. Enter a token during source setup or set GITHUB_TOKEN in Dashboard → Secrets.' }, { status: 400 });
      }
    }

    // Update run status
    await base44.entities.DiscoveryRun.update(run.id, { status: 'connecting' });

    // Run the pipeline
    const result = await runDiscoveryPipeline(base44, source, run.id, token);

    // Bulk create logs
    if (result.logs.length > 0) {
      await base44.entities.DiscoveryLog.bulkCreate(result.logs);
    }

    // Update run with results
    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(now).getTime();

    if (result.failed) {
      await base44.entities.DiscoveryRun.update(run.id, {
        status: 'failed',
        completed_at: completedAt,
        duration_ms: durationMs,
        error_message: result.error,
        repositories_scanned: result.reposScanned,
        signals_detected: result.signalsDetected,
      });
      await base44.entities.DiscoverySource.update(source.id, {
        connection_status: 'error',
        last_scan_at: now,
        errors_count: (source.errors_count || 0) + 1,
      });
      return Response.json({
        run_id: run.id,
        status: 'failed',
        error: result.error,
        repositories_scanned: result.reposScanned,
        signals_detected: result.signalsDetected,
        duration_ms: durationMs,
      });
    }

    await base44.entities.DiscoveryRun.update(run.id, {
      status: 'completed',
      completed_at: completedAt,
      duration_ms: durationMs,
      repositories_scanned: result.reposScanned,
      signals_detected: result.signalsDetected,
      findings_created: result.findingsCreated,
      assets_created: result.assetsCreated,
      assets_updated: result.assetsUpdated,
      duplicates_detected: result.duplicatesDetected,
    });

    // Update source stats
    await base44.entities.DiscoverySource.update(source.id, {
      connection_status: 'connected',
      last_scan_at: now,
      last_successful_scan: now,
      assets_discovered: (source.assets_discovered || 0) + result.assetsCreated,
      new_assets: result.assetsCreated,
      updated_assets: result.assetsUpdated,
      errors_count: 0,
      metadata: {
        provider: 'github',
        organizations: source.config?.organization ? [source.config.organization] : [],
        repositories_scanned: result.reposScanned,
        last_successful_scan: now,
        first_connected: source.metadata?.first_connected || now,
        last_updated: now,
        connector_version: '1.0.0',
        discovery_version: '1.0.0',
      },
    });

    // Create audit event
    await base44.entities.AuditEvent.create({
      action: 'discovery_completed',
      resource_type: 'discovery_source',
      resource_id: source.id,
      result: 'success',
      details: {
        run_id: run.id,
        repositories_scanned: result.reposScanned,
        findings_created: result.findingsCreated,
        assets_created: result.assetsCreated,
        assets_updated: result.assetsUpdated,
      },
    });

    return Response.json({
      run_id: run.id,
      status: 'completed',
      repositories_scanned: result.reposScanned,
      signals_detected: result.signalsDetected,
      findings_created: result.findingsCreated,
      assets_created: result.assetsCreated,
      assets_updated: result.assetsUpdated,
      duplicates_detected: result.duplicatesDetected,
      duration_ms: durationMs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}