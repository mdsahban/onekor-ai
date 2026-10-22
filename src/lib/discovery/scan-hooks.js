import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// ─── Detection Profiles ───
export function useDetectionProfiles() {
  return useQuery({
    queryKey: ['detection-profiles'],
    queryFn: async () => {
      const { items } = await base44.entities.DetectionProfile.filter({}, { sort: '-created_date', limit: 200 });
      return items;
    },
  });
}

export function useCreateDetectionProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => base44.entities.DetectionProfile.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['detection-profiles'] }),
  });
}

export function useUpdateDetectionProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => base44.entities.DetectionProfile.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['detection-profiles'] }),
  });
}

export function useDeleteDetectionProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => base44.entities.DetectionProfile.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['detection-profiles'] }),
  });
}

export function useGenerateDetectionProfile() {
  return useMutation({
    mutationFn: async (description) => {
      const res = await base44.functions.invoke('generateDetectionProfile', { description });
      return res;
    },
  });
}

// ─── Scan Templates ───
export function useScanTemplates() {
  return useQuery({
    queryKey: ['scan-templates'],
    queryFn: async () => {
      const { items } = await base44.entities.ScanTemplate.filter({}, { sort: '-created_date', limit: 100 });
      return items;
    },
  });
}

export function useCreateScanTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => base44.entities.ScanTemplate.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scan-templates'] }),
  });
}

export function useUpdateScanTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => base44.entities.ScanTemplate.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scan-templates'] }),
  });
}

export function useDeleteScanTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => base44.entities.ScanTemplate.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scan-templates'] }),
  });
}

// ─── Scans ───
export function useScans(enabled = true) {
  return useQuery({
    queryKey: ['scans'],
    queryFn: async () => {
      const page = await base44.entities.Scan.filter({}, { sort: '-created_date', limit: 50 });
      return page?.items || [];
    },
    enabled,
    refetchInterval: (query) => {
      const items = query?.state?.data;
      if (!Array.isArray(items) || items.length === 0) return false;
      const hasActive = items.some((s) => ['queued', 'running', 'paused'].includes(s?.status));
      return hasActive ? 3000 : false;
    },
  });
}

export function useRunScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await base44.functions.invoke('scanRun', payload);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scans'] }),
  });
}

export function useScanControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ scanId, action }) => {
      const res = await base44.functions.invoke('scanControl', { scanId, action });
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scans'] }),
  });
}

export function useScan(scanId) {
  return useQuery({
    queryKey: ['scan', scanId],
    queryFn: async () => {
      if (!scanId) return null;
      const page = await base44.entities.Scan.filter({ id: scanId }, { limit: 1 });
      return page?.items?.[0] || null;
    },
    enabled: !!scanId,
    refetchInterval: (query) => {
      const data = query?.state?.data;
      if (!data) return false;
      const isActive = ['queued', 'running', 'paused'].includes(data.status);
      return isActive ? 2000 : false;
    },
  });
}

export function useDeleteScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => base44.entities.Scan.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scans'] });
      qc.invalidateQueries({ queryKey: ['scan-logs'] });
    },
  });
}

// ─── Scan Findings ───
export function useScanFindings({ scanId, runIds = [], sourceId } = {}) {
  return useQuery({
    queryKey: ['scan-findings', scanId, runIds, sourceId],
    queryFn: async () => {
      const query = {};
      if (sourceId && sourceId !== 'all') query.source_id = sourceId;
      const page = await base44.entities.DiscoveryFinding.filter(query, { sort: '-created_date', limit: 300 });
      const items = page?.items || [];
      if (runIds && runIds.length > 0) {
        return items.filter((f) => runIds.includes(f.run_id));
      }
      if (scanId) {
        return [];
      }
      return items;
    },
    enabled: true,
  });
}

export function usePromoteFindingToAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (finding) => {
      const now = new Date().toISOString();
      const assetData = {
        name: finding.name,
        display_name: finding.name,
        asset_type: finding.asset_type || 'ai_application',
        provider: finding.provider || 'custom',
        confidence_score: finding.confidence_score || 0.8,
        first_seen: now,
        last_seen: now,
        status: 'active',
        enriched_data: {
          repository: finding.evidence?.repository,
          url: finding.evidence?.url,
          signals: finding.evidence?.signals || [],
          promoted_manually: true,
        },
      };
      const asset = await base44.entities.AiAsset.create(assetData);
      if (finding.external_id) {
        await base44.entities.AiAssetSource.create({
          asset_id: asset.id,
          source_id: finding.source_id,
          external_id: finding.external_id,
          first_seen: now,
          last_seen: now,
        });
      }
      await base44.entities.DiscoveryFinding.update(finding.id, {
        asset_id: asset.id,
        status: 'asset_created',
      });
      return asset;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scan-findings'] });
      qc.invalidateQueries({ queryKey: ['discovery-findings'] });
      qc.invalidateQueries({ queryKey: ['ai-assets'] });
    },
  });
}

// ─── Scan Logs ───
export function useScanLogs(filters = {}, enabled = true) {
  const { scanId, severity, category, sourceId } = filters;
  const query = {};
  if (scanId) query.scan_id = scanId;
  if (severity && severity !== 'all') query.severity = severity;
  if (category && category !== 'all') query.category = category;
  if (sourceId) query.source_id = sourceId;

  return useQuery({
    queryKey: ['scan-logs', query],
    queryFn: async () => {
      const { items } = await base44.entities.ScanLog.filter(query, { sort: '-created_date', limit: 500 });
      return items;
    },
    enabled,
    refetchInterval: (data) => {
      if (!data) return 5000;
      return 5000; // Poll for new logs
    },
  });
}

export function usePurgeScanLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await base44.functions.invoke('purgeScanLogs', payload);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scan-logs'] }),
  });
}

// ─── AI Models ───
export function useAiModels() {
  return useQuery({
    queryKey: ['ai-models'],
    queryFn: async () => {
      const { items } = await base44.entities.AiModel.filter({}, { sort: '-created_date', limit: 100 });
      return items;
    },
  });
}

export function useCreateAiModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => base44.entities.AiModel.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-models'] }),
  });
}

export function useUpdateAiModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => base44.entities.AiModel.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-models'] }),
  });
}

export function useDeleteAiModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => base44.entities.AiModel.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-models'] }),
  });
}

export function useValidateAiModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await base44.functions.invoke('validateAiModel', payload);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-models'] }),
  });
}

// ─── Seed Built-in Profiles ───
export function useSeedBuiltinProfiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ profiles }) => {
      const created = await base44.entities.DetectionProfile.bulkCreate(profiles);
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['detection-profiles'] }),
  });
}