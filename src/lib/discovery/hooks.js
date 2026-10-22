import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// ─── Sources ───
export function useDiscoverySources() {
  return useQuery({
    queryKey: ['discovery-sources'],
    queryFn: async () => {
      const page = await base44.entities.DiscoverySource.filter({}, { sort: '-created_date', limit: 100 });
      return page.items || [];
    },
  });
}

export function useDiscoverySource(id) {
  return useQuery({
    queryKey: ['discovery-source', id],
    queryFn: async () => {
      if (!id) return null;
      const page = await base44.entities.DiscoverySource.filter({ id }, { limit: 1 });
      return (page.items && page.items[0]) || null;
    },
    enabled: !!id,
  });
}

export function useCreateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      return await base44.entities.DiscoverySource.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-sources'] });
    },
  });
}

export function useUpdateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.DiscoverySource.update(id, data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['discovery-sources'] });
      qc.invalidateQueries({ queryKey: ['discovery-source', vars.id] });
    },
  });
}

export function useDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      return await base44.entities.DiscoverySource.delete(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-sources'] });
    },
  });
}

// ─── Backend Functions ───

// The functions SDK client has interceptResponses: false, so non-2xx responses
// throw raw Axios errors with generic messages like "Request failed with status
// code 400". This helper extracts the actual error body the backend returned.
function extractFunctionError(err, fallback) {
  const data = err?.response?.data;
  if (data) {
    const msg = data.error || data.message || data.detail;
    if (msg) return new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    // If the backend returned { ok: false, error: ... } but with a 4xx status,
    // return that error message
    if (data.ok === false && data.error) return new Error(data.error);
  }
  return err instanceof Error ? err : new Error(fallback || 'Request failed');
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async (payload) => {
      try {
        const res = await base44.functions.invoke('discoveryTestConnection', payload);
        return res.data;
      } catch (err) {
        throw extractFunctionError(err, 'Connection test failed');
      }
    },
  });
}

export function useValidateCredentials() {
  return useMutation({
    mutationFn: async (payload) => {
      try {
        const res = await base44.functions.invoke('discoveryValidate', payload);
        return res.data;
      } catch (err) {
        throw extractFunctionError(err, 'Validation failed');
      }
    },
  });
}

export function useRunDiscovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId) => {
      try {
        const res = await base44.functions.invoke('discoveryRun', { sourceId });
        return res.data;
      } catch (err) {
        throw extractFunctionError(err, 'Discovery run failed');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-sources'] });
      qc.invalidateQueries({ queryKey: ['discovery-runs'] });
      qc.invalidateQueries({ queryKey: ['discovery-findings'] });
      qc.invalidateQueries({ queryKey: ['ai-assets'] });
      qc.invalidateQueries({ queryKey: ['discovery-source'] });
    },
  });
}

// ─── All Runs (across all sources) ───
export function useAllDiscoveryRuns() {
  return useQuery({
    queryKey: ['discovery-runs-all'],
    queryFn: async () => {
      const page = await base44.entities.DiscoveryRun.filter({}, { sort: '-created_date', limit: 50 });
      return page.items || [];
    },
    refetchInterval: (query) => {
      const items = query.state.data;
      if (!items || items.length === 0) return false;
      const hasActive = items.some((r) => ['queued', 'starting', 'connecting', 'fetching', 'analyzing', 'classifying', 'deduplicating', 'enriching', 'saving'].includes(r.status));
      return hasActive ? 3000 : false;
    },
  });
}

// ─── Runs ───
export function useDiscoveryRuns(sourceId) {
  return useQuery({
    queryKey: ['discovery-runs', sourceId],
    queryFn: async () => {
      if (!sourceId) return [];
      const page = await base44.entities.DiscoveryRun.filter({ source_id: sourceId }, { sort: '-created_date', limit: 50 });
      return page.items || [];
    },
    enabled: !!sourceId,
    refetchInterval: (query) => {
      const items = query.state.data;
      if (!items || items.length === 0) return false;
      const hasActive = items.some((r) => ['queued', 'starting', 'connecting', 'fetching', 'analyzing', 'classifying', 'deduplicating', 'enriching', 'saving'].includes(r.status));
      return hasActive ? 3000 : false;
    },
  });
}

export function useDiscoveryRun(runId) {
  return useQuery({
    queryKey: ['discovery-run', runId],
    queryFn: async () => {
      if (!runId) return null;
      const page = await base44.entities.DiscoveryRun.filter({ id: runId }, { limit: 1 });
      return (page.items && page.items[0]) || null;
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      const run = query.state.data;
      if (!run) return false;
      if (['queued', 'starting', 'connecting', 'fetching', 'analyzing', 'classifying', 'deduplicating', 'enriching', 'saving'].includes(run.status)) return 2000;
      return false;
    },
  });
}

// ─── Logs ───
export function useDiscoveryLogs(runId) {
  return useQuery({
    queryKey: ['discovery-logs', runId],
    queryFn: async () => {
      if (!runId) return [];
      const page = await base44.entities.DiscoveryLog.filter({ run_id: runId }, { sort: 'created_date', limit: 500 });
      return page.items || [];
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      // Refetch while the run is active — we detect this by checking if logs are still coming
      // Simple approach: refetch every 2s for 5 minutes
      return 2000;
    },
  });
}

export function useSourceLogs(sourceId) {
  return useQuery({
    queryKey: ['source-logs', sourceId],
    queryFn: async () => {
      if (!sourceId) return [];
      const page = await base44.entities.DiscoveryLog.filter({ source_id: sourceId }, { sort: '-created_date', limit: 200 });
      return page.items || [];
    },
    enabled: !!sourceId,
  });
}

// ─── Findings ───
export function useDiscoveryFindings(sourceId) {
  return useQuery({
    queryKey: ['discovery-findings', sourceId],
    queryFn: async () => {
      const query = sourceId ? { source_id: sourceId } : {};
      const page = await base44.entities.DiscoveryFinding.filter(query, { sort: '-created_date', limit: 200 });
      return page.items || [];
    },
  });
}

export function useDiscoveryFinding(id) {
  return useQuery({
    queryKey: ['discovery-finding', id],
    queryFn: async () => {
      if (!id) return null;
      const page = await base44.entities.DiscoveryFinding.filter({ id }, { limit: 1 });
      return (page.items && page.items[0]) || null;
    },
    enabled: !!id,
  });
}

// ─── Findings by Asset ───
export function useDiscoveryFindingsByAsset(assetId) {
  return useQuery({
    queryKey: ['discovery-findings-asset', assetId],
    queryFn: async () => {
      if (!assetId) return [];
      const page = await base44.entities.DiscoveryFinding.filter({ asset_id: assetId }, { sort: '-created_date', limit: 50 });
      return page.items || [];
    },
    enabled: !!assetId,
  });
}

export function useUpdateFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.DiscoveryFinding.update(id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-findings'] });
      qc.invalidateQueries({ queryKey: ['discovery-findings-asset'] });
    },
  });
}

// ─── AI Assets ───
export function useAiAssets() {
  return useQuery({
    queryKey: ['ai-assets'],
    queryFn: async () => {
      const page = await base44.entities.AiAsset.filter({}, { sort: '-last_seen', limit: 200 });
      return page.items || [];
    },
  });
}

export function useCreateAiAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      return await base44.entities.AiAsset.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-assets'] });
    },
  });
}

export function useAiAsset(id) {
  return useQuery({
    queryKey: ['ai-asset', id],
    queryFn: async () => {
      if (!id) return null;
      const page = await base44.entities.AiAsset.filter({ id }, { limit: 1 });
      return (page.items && page.items[0]) || null;
    },
    enabled: !!id,
  });
}

export function useUpdateAiAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.AiAsset.update(id, data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ai-assets'] });
      qc.invalidateQueries({ queryKey: ['ai-asset', vars.id] });
    },
  });
}

export function useDeleteAiAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      return await base44.entities.AiAsset.delete(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-assets'] });
    },
  });
}

export function useBulkUpdateAiAssets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, data }) => {
      return await Promise.all(ids.map((id) => base44.entities.AiAsset.update(id, data)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-assets'] });
    },
  });
}

export function useAiAssetCount() {
  return useQuery({
    queryKey: ['ai-asset-count'],
    queryFn: async () => {
      return await base44.entities.AiAsset.count({});
    },
  });
}

export function useAiAssetSources(assetId) {
  return useQuery({
    queryKey: ['ai-asset-sources', assetId],
    queryFn: async () => {
      if (!assetId) return [];
      const page = await base44.entities.AiAssetSource.filter({ asset_id: assetId }, { limit: 50 });
      return page.items || [];
    },
    enabled: !!assetId,
  });
}

// ─── Rules ───
export function useDiscoveryRules() {
  return useQuery({
    queryKey: ['discovery-rules'],
    queryFn: async () => {
      const page = await base44.entities.DiscoveryRule.filter({}, { sort: 'name', limit: 200 });
      return page.items || [];
    },
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      return await base44.entities.DiscoveryRule.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-rules'] });
    },
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.DiscoveryRule.update(id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-rules'] });
    },
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      return await base44.entities.DiscoveryRule.delete(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-rules'] });
    },
  });
}

export function useSeedRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rules) => {
      return await base44.entities.DiscoveryRule.bulkCreate(rules);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery-rules'] });
    },
  });
}

// ─── Audit Events ───
export function useAuditEvents() {
  return useQuery({
    queryKey: ['audit-events'],
    queryFn: async () => {
      const page = await base44.entities.AuditEvent.filter({}, { sort: '-created_date', limit: 100 });
      return page.items || [];
    },
  });
}

export function useAssetAuditEvents(assetId) {
  return useQuery({
    queryKey: ['audit-events', assetId],
    queryFn: async () => {
      if (!assetId) return [];
      const page = await base44.entities.AuditEvent.filter({ resource_id: assetId }, { sort: '-created_date', limit: 50 });
      return page.items || [];
    },
    enabled: !!assetId,
  });
}

export function useCreateAuditEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      return await base44.entities.AuditEvent.create(data);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['audit-events'] });
      if (vars?.resource_id) {
        qc.invalidateQueries({ queryKey: ['audit-events', vars.resource_id] });
      }
    },
  });
}

// ─── Counts ───
export function useFindingCount(sourceId) {
  return useQuery({
    queryKey: ['finding-count', sourceId],
    queryFn: async () => {
      const query = sourceId ? { source_id: sourceId } : {};
      return await base44.entities.DiscoveryFinding.count(query);
    },
  });
}