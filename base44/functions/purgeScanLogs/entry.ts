import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json();
    const { olderThanDays, scanId, preview } = body;

    let query = {};
    if (scanId) {
      query = { scan_id: scanId };
    } else if (olderThanDays != null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);
      query = { created_date: { $lt: cutoff.toISOString() } };
    } else {
      return Response.json({ error: 'olderThanDays or scanId is required' }, { status: 400 });
    }

    const count = await base44.entities.ScanLog.count(query);

    if (preview) {
      return Response.json({ preview: true, would_delete: count });
    }

    if (count === 0) {
      return Response.json({ deleted_count: 0 });
    }

    await base44.entities.ScanLog.deleteMany(query);

    await base44.entities.AuditEvent.create({
      action: 'scan_logs_purged', resource_type: 'scan_log',
      result: 'success',
      details: { deleted_count: count, older_than_days: olderThanDays, scan_id: scanId || null },
    });

    return Response.json({ deleted_count: count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}