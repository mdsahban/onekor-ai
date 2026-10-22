import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { scanId, action } = body;
    if (!scanId || !action) return Response.json({ error: 'scanId and action are required' }, { status: 400 });

    const page = await base44.entities.Scan.filter({ id: scanId }, { limit: 1 });
    const scan = page.items && page.items[0];
    if (!scan) return Response.json({ error: 'Scan not found' }, { status: 404 });

    const validActions = ['pause', 'resume', 'stop', 'retry'];
    if (!validActions.includes(action)) return Response.json({ error: 'Invalid action' }, { status: 400 });

    let newStatus, logMessage;
    switch (action) {
      case 'pause':
        if (scan.status !== 'running') return Response.json({ error: 'Scan is not running' }, { status: 400 });
        newStatus = 'paused'; logMessage = 'Scan paused by user.'; break;
      case 'resume':
        if (scan.status !== 'paused') return Response.json({ error: 'Scan is not paused' }, { status: 400 });
        newStatus = 'running'; logMessage = 'Scan resumed by user.'; break;
      case 'stop':
        if (['completed', 'failed', 'cancelled'].includes(scan.status)) return Response.json({ error: 'Scan already finished' }, { status: 400 });
        newStatus = 'cancelled'; logMessage = 'Scan cancelled by user.'; break;
      case 'retry':
        if (scan.status !== 'failed') return Response.json({ error: 'Only failed scans can be retried' }, { status: 400 });
        newStatus = 'queued'; logMessage = 'Scan queued for retry.'; break;
    }

    const updateData = { status: newStatus };
    if (action === 'stop') updateData.completed_at = new Date().toISOString();
    if (action === 'retry') { updateData.started_at = new Date().toISOString(); updateData.progress = 0; updateData.error_message = ''; }
    await base44.entities.Scan.update(scanId, updateData);

    await base44.entities.ScanLog.create({
      scan_id: scanId, template_id: scan.template_id,
      severity: 'info', category: 'lifecycle', message: logMessage,
    });

    await base44.entities.AuditEvent.create({
      action: 'scan_controlled', resource_type: 'scan', resource_id: scanId,
      result: 'success', details: { action, previous_status: scan.status, new_status: newStatus },
    });

    return Response.json({ scan_id: scanId, status: newStatus });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}