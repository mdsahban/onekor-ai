import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  useAiAsset, useAiAssetSources, useDiscoveryFindingsByAsset, useDiscoverySources,
  useAiAssets, useUpdateAiAsset, useDeleteAiAsset, useCreateAuditEvent, useAssetAuditEvents,
} from '@/lib/discovery/hooks';
import {
  ASSET_TYPE_LABELS, formatRelative, formatDateTime, formatDate,
  REVIEW_STATUS_META, RISK_LEVEL_META, LIFECYCLE_META, DATA_SENSITIVITY_META,
} from '@/lib/discovery/helpers';
import { ConfidenceBadge } from '@/components/discovery/Badges';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft, Check, X, AlertTriangle, Pencil, Save, FileText,
  GitBranch, Network, History, Eye, Boxes, Brain, Bot, AppWindow, Code, Server,
  Workflow, Sparkles, Cloud, UserCircle, Ghost, Shield, Clock, Database,
  ChevronRight, MoreVertical, Download, Trash2, ArrowUpRight, AlertCircle,
  CheckCircle2, Lock, Cpu, Layers, FileCode, CheckCheck, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Asset type icon map ───────────────────────────────────────────────────────
const TYPE_ICONS = {
  ai_application: AppWindow, ai_agent: Bot, ai_model: Brain, ai_api: Code,
  ai_saas: Cloud, ai_copilot: Sparkles, ai_workflow: Workflow, ai_platform: Server,
  ai_integration: Network, ai_account: UserCircle, personal_ai_account: UserCircle, shadow_ai: Ghost,
};

const PROVIDER_COLORS = {
  openai: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  anthropic: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  github: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  google: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  microsoft: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  aws: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  huggingface: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
};

// ─── Shared badge helpers ──────────────────────────────────────────────────────
function ReviewBadge({ status, className }) {
  const m = REVIEW_STATUS_META[status] || REVIEW_STATUS_META.pending;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', m.bg, m.color, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

function RiskBadge({ level, className }) {
  const m = RISK_LEVEL_META[level] || RISK_LEVEL_META.unknown;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border', m.bg, m.color, m.border, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

function LifecycleBadge({ stage, className }) {
  const m = LIFECYCLE_META[stage] || LIFECYCLE_META.unknown;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', m.bg, m.color, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

function SensitivityBadge({ sensitivity, className }) {
  const m = DATA_SENSITIVITY_META[sensitivity] || DATA_SENSITIVITY_META.internal;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', m.bg, m.color, className)}>
      <Lock className="h-3 w-3" />
      {m.label}
    </span>
  );
}

export default function AssetProfilePage({ assetId: propAssetId }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assetId = propAssetId || searchParams.get('asset');

  const { data: asset, isLoading } = useAiAsset(assetId);
  const { data: assetSources = [] } = useAiAssetSources(assetId);
  const { data: findings = [] } = useDiscoveryFindingsByAsset(assetId);
  const { data: sources = [] } = useDiscoverySources();
  const { data: allAssets = [] } = useAiAssets();
  const { data: auditEvents = [] } = useAssetAuditEvents(assetId);

  const updateAsset = useUpdateAiAsset();
  const deleteAsset = useDeleteAiAsset();
  const createAudit = useCreateAuditEvent();

  // Modals state
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Review notes state
  const [reviewNote, setReviewNote] = useState('');
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);

  // Risk override state
  const [riskOverrideLevel, setRiskOverrideLevel] = useState('unknown');
  const [riskOverrideScore, setRiskOverrideScore] = useState(0);
  const [riskOverrideSensitivity, setRiskOverrideSensitivity] = useState('internal');
  const [riskOverrideRationale, setRiskOverrideRationale] = useState('');
  const [riskSavedFeedback, setRiskSavedFeedback] = useState(false);

  // Populate local fields when asset loads
  useEffect(() => {
    if (asset) {
      setReviewNote(asset.review_notes || '');
      setRiskOverrideLevel(asset.risk_level || 'unknown');
      setRiskOverrideScore(asset.risk_score || 0);
      setRiskOverrideSensitivity(asset.data_sensitivity || 'internal');
      setRiskOverrideRationale(asset.enriched_data?.risk_rationale || '');
    }
  }, [asset]);

  const sourceMap = useMemo(() => {
    const map = {};
    for (const s of sources) map[s.id] = s;
    return map;
  }, [sources]);

  // Related assets: same provider
  const sameProviderAssets = useMemo(() => {
    if (!asset) return [];
    return allAssets
      .filter((a) => a.id !== assetId && a.provider?.toLowerCase() === asset.provider?.toLowerCase())
      .slice(0, 8);
  }, [allAssets, asset, assetId]);

  // Related assets: same source
  const sameSourceAssets = useMemo(() => {
    if (!asset || assetSources.length === 0) return [];
    const sourceIds = new Set(assetSources.map((s) => s.source_id));
    return allAssets
      .filter((a) => a.id !== assetId && sourceIds.has(a.source_id))
      .slice(0, 8);
  }, [allAssets, asset, assetSources, assetId]);

  // Handle Review Status
  const handleReview = async (status) => {
    await updateAsset.mutateAsync({
      id: assetId,
      data: {
        review_status: status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: 'Administrator',
      },
    });
    await createAudit.mutateAsync({
      action: 'asset_reviewed',
      resource_type: 'ai_asset',
      resource_id: assetId,
      result: 'success',
      details: { review_status: status },
    });
  };

  // Handle Quick Lifecycle update
  const handleLifecycleChange = async (newStage) => {
    await updateAsset.mutateAsync({
      id: assetId,
      data: { lifecycle_stage: newStage },
    });
    await createAudit.mutateAsync({
      action: 'asset_lifecycle_updated',
      resource_type: 'ai_asset',
      resource_id: assetId,
      result: 'success',
      details: { from: asset.lifecycle_stage, to: newStage },
    });
  };

  // Handle Save Review Notes
  const handleSaveReviewNote = async () => {
    await updateAsset.mutateAsync({
      id: assetId,
      data: { review_notes: reviewNote },
    });
    await createAudit.mutateAsync({
      action: 'asset_review_notes_updated',
      resource_type: 'ai_asset',
      resource_id: assetId,
      result: 'success',
      details: { note_length: reviewNote.length },
    });
    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 2500);
  };

  // Handle Risk Assessment Override
  const handleSaveRiskOverride = async () => {
    const scoreNum = Math.max(0, Math.min(100, Number(riskOverrideScore) || 0));
    const enriched = asset?.enriched_data || {};
    await updateAsset.mutateAsync({
      id: assetId,
      data: {
        risk_level: riskOverrideLevel,
        risk_score: scoreNum,
        data_sensitivity: riskOverrideSensitivity,
        enriched_data: {
          ...enriched,
          risk_rationale: riskOverrideRationale,
          last_risk_assessment: new Date().toISOString(),
        },
      },
    });
    await createAudit.mutateAsync({
      action: 'asset_risk_updated',
      resource_type: 'ai_asset',
      resource_id: assetId,
      result: 'success',
      details: {
        risk_level: riskOverrideLevel,
        risk_score: scoreNum,
        data_sensitivity: riskOverrideSensitivity,
      },
    });
    setRiskSavedFeedback(true);
    setTimeout(() => setRiskSavedFeedback(false), 2500);
  };

  // Handle Open Edit Modal
  const handleOpenEdit = () => {
    setEditData({
      display_name: asset.display_name || asset.name || '',
      description: asset.description || '',
      business_owner: asset.business_owner || '',
      technical_owner: asset.technical_owner || '',
      environment: asset.environment || '',
      lifecycle_stage: asset.lifecycle_stage || 'unknown',
      risk_level: asset.risk_level || 'unknown',
      risk_score: asset.risk_score || 0,
      data_sensitivity: asset.data_sensitivity || 'internal',
      regulatory_scope: (asset.regulatory_scope || []).join(', '),
      tags: (asset.tags || []).join(', '),
    });
    setEditOpen(true);
  };

  // Handle Save Edit Modal
  const handleSaveEdit = async () => {
    const tags = editData.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const regScope = editData.regulatory_scope.split(',').map((r) => r.trim()).filter(Boolean);
    await updateAsset.mutateAsync({
      id: assetId,
      data: {
        display_name: editData.display_name,
        description: editData.description,
        business_owner: editData.business_owner,
        technical_owner: editData.technical_owner,
        environment: editData.environment,
        lifecycle_stage: editData.lifecycle_stage,
        risk_level: editData.risk_level,
        risk_score: Number(editData.risk_score) || 0,
        data_sensitivity: editData.data_sensitivity,
        regulatory_scope: regScope,
        tags,
      },
    });
    await createAudit.mutateAsync({
      action: 'asset_updated',
      resource_type: 'ai_asset',
      resource_id: assetId,
      result: 'success',
      details: { updated_fields: Object.keys(editData) },
    });
    setEditOpen(false);
  };

  // Handle Delete
  const handleDeleteAsset = async () => {
    await deleteAsset.mutateAsync(assetId);
    await createAudit.mutateAsync({
      action: 'asset_deleted',
      resource_type: 'ai_asset',
      resource_id: assetId,
      result: 'success',
      details: { asset_name: asset.display_name || asset.name },
    });
    setDeleteConfirm(false);
    navigate('/user/setup/ai-discovery/ai-inventory');
  };

  // Export JSON
  const handleExportJson = () => {
    if (!asset) return;
    const payload = {
      canonical_ai_asset: asset,
      lineage_sources: assetSources.map((link) => ({
        ...link,
        source_details: sourceMap[link.source_id] || null,
      })),
      discovery_findings: findings,
      governance_history: auditEvents,
      exported_at: new Date().toISOString(),
      governance_platform: 'OneKor Enterprise AI Inventory',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(asset.name || 'ai-asset').replace(/[^a-zA-Z0-9_-]/g, '_')}_profile.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <Boxes className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h2 className="mt-3 font-display text-lg font-semibold text-foreground">AI Asset Not Found</h2>
        <p className="mt-1 text-sm text-muted-foreground">The requested AI asset could not be located in the canonical inventory.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate('/user/setup/ai-discovery/ai-inventory')}>
          <ArrowLeft className="h-4 w-4" /> Return to AI Inventory
        </Button>
      </div>
    );
  }

  const Icon = TYPE_ICONS[asset.asset_type] || Boxes;
  const enriched = asset.enriched_data || {};
  const riskMeta = RISK_LEVEL_META[asset.risk_level] || RISK_LEVEL_META.unknown;
  const confLevel = (asset.confidence_score || 0) >= 0.75 ? 'high' : (asset.confidence_score || 0) >= 0.5 ? 'medium' : 'low';
  const riskScoreNum = asset.risk_score || 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Top Breadcrumb Nav */}
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => navigate('/user/setup/ai-discovery/ai-inventory')}>
          <ArrowLeft className="h-4 w-4" /> AI Inventory
        </Button>
        <span className="text-xs font-mono text-muted-foreground/60">ID: {asset.id}</span>
      </div>

      {/* Hero Header Card */}
      <div className="mb-6 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div className={cn('grid h-16 w-16 shrink-0 place-items-center rounded-2xl border shadow-sm', PROVIDER_COLORS[asset.provider?.toLowerCase()] || 'bg-primary/10 text-primary border-primary/20')}>
              <Icon className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground truncate">
                  {asset.display_name || asset.name}
                </h1>
                {asset.name && asset.display_name && asset.display_name !== asset.name && (
                  <span className="font-mono text-xs text-muted-foreground">({asset.name})</span>
                )}
              </div>

              {/* Status & Governance Badges Row */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-medium">
                  {ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type}
                </Badge>
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize border', PROVIDER_COLORS[asset.provider?.toLowerCase()] || 'bg-primary/10 text-primary')}>
                  {asset.provider || 'unknown'}
                </span>
                <ReviewBadge status={asset.review_status} />
                <ConfidenceBadge level={confLevel} score={asset.confidence_score} />
                <RiskBadge level={asset.risk_level} />
                {asset.lifecycle_stage && asset.lifecycle_stage !== 'unknown' && (
                  <LifecycleBadge stage={asset.lifecycle_stage} />
                )}
                {asset.data_sensitivity && (
                  <SensitivityBadge sensitivity={asset.data_sensitivity} />
                )}
                {asset.regulatory_scope && asset.regulatory_scope.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                    <Shield className="h-3 w-3" />
                    {asset.regulatory_scope.join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex shrink-0 items-center gap-2 self-start">
            {/* Quick Review Buttons */}
            {asset.review_status !== 'confirmed' && (
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleReview('confirmed')}>
                <Check className="h-3.5 w-3.5" /> Confirm
              </Button>
            )}
            {asset.review_status !== 'rejected' && (
              <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30" onClick={() => handleReview('rejected')}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            )}
            {asset.review_status !== 'needs_review' && (
              <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-900/50 dark:hover:bg-amber-950/30" onClick={() => handleReview('needs_review')}>
                <AlertTriangle className="h-3.5 w-3.5" /> Flag
              </Button>
            )}

            {/* Edit Button */}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleOpenEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>

            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Lifecycle Management</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleLifecycleChange('active')}>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2" /> Mark as Active
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLifecycleChange('evaluation')}>
                  <span className="h-2 w-2 rounded-full bg-blue-500 mr-2" /> Mark as Evaluation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLifecycleChange('deprecated')}>
                  <span className="h-2 w-2 rounded-full bg-amber-500 mr-2" /> Mark as Deprecated
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLifecycleChange('sunset')}>
                  <span className="h-2 w-2 rounded-full bg-red-500 mr-2" /> Mark as Sunset
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportJson}>
                  <Download className="h-3.5 w-3.5 mr-2 text-muted-foreground" /> Export Profile JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 className="h-3.5 w-3.5 mr-2 text-red-600" /> Delete Asset
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-6 grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <Eye className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-1.5 text-xs sm:text-sm">
            <Shield className="h-3.5 w-3.5" /> Risk & Governance
          </TabsTrigger>
          <TabsTrigger value="evidence" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5" /> Evidence
          </TabsTrigger>
          <TabsTrigger value="relationships" className="gap-1.5 text-xs sm:text-sm">
            <Network className="h-3.5 w-3.5" /> AI Map
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
            <History className="h-3.5 w-3.5" /> Audit & History
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: OVERVIEW */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="overview">
          <div className="grid gap-5 md:grid-cols-2">
            {/* Identity Card */}
            <InfoCard title="Canonical Identity" icon={FileText}>
              <DataRow label="Asset Name" value={asset.name} />
              <DataRow label="Display Name" value={asset.display_name || asset.name} />
              <DataRow label="Asset Type" value={ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type} />
              <DataRow label="Provider / Vendor" value={<span className="capitalize">{asset.provider || 'unknown'}</span>} />
              <DataRow label="Inventory Status" value={<span className="capitalize">{asset.status || 'active'}</span>} />
              <DataRow label="Lifecycle Stage" value={<LifecycleBadge stage={asset.lifecycle_stage} />} />
            </InfoCard>

            {/* Confidence & Review Card */}
            <InfoCard title="Confidence & Review Status" icon={Shield}>
              <DataRow label="Confidence Score" value={`${Math.round((asset.confidence_score || 0) * 100)}%`} />
              <DataRow label="Confidence Level" value={<ConfidenceBadge level={confLevel} score={asset.confidence_score} />} />
              <DataRow label="Review Status" value={<ReviewBadge status={asset.review_status} />} />
              {asset.reviewed_at && <DataRow label="Reviewed At" value={formatDateTime(asset.reviewed_at)} />}
              {asset.reviewed_by && <DataRow label="Reviewed By" value={asset.reviewed_by} />}
              
              {/* Review notes editor */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Review Notes</span>
                  {noteSavedFeedback && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-normal normal-case flex items-center gap-1">
                      <Check className="h-3 w-3" /> Saved
                    </span>
                  )}
                </Label>
                <Textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Add administrative review rationale, compliance notes, or exceptions..."
                  rows={2}
                  className="mt-1.5 text-xs"
                />
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1" onClick={handleSaveReviewNote}>
                  <Save className="h-3 w-3" /> Save Note
                </Button>
              </div>
            </InfoCard>

            {/* Ownership & Governance Card */}
            <InfoCard title="Ownership & Governance" icon={UserCircle}>
              <DataRow label="Business Owner" value={asset.business_owner || 'Not assigned'} />
              <DataRow label="Technical Owner" value={asset.technical_owner || 'Not assigned'} />
              <DataRow label="Environment" value={asset.environment ? <span className="capitalize">{asset.environment}</span> : 'Not specified'} />
              <DataRow label="Data Sensitivity" value={<SensitivityBadge sensitivity={asset.data_sensitivity} />} />
              <DataRow
                label="Regulatory Scope"
                value={
                  asset.regulatory_scope && asset.regulatory_scope.length > 0
                    ? asset.regulatory_scope.join(', ')
                    : 'None specified'
                }
              />
            </InfoCard>

            {/* Lifecycle Card */}
            <InfoCard title="Activity & Lifecycle Timeline" icon={Clock}>
              <DataRow label="Lifecycle Stage" value={<LifecycleBadge stage={asset.lifecycle_stage} />} />
              <DataRow label="First Discovered" value={formatDateTime(asset.first_seen || asset.created_date)} />
              <DataRow label="Last Verified / Seen" value={formatRelative(asset.last_seen || asset.created_date)} />
              <DataRow label="Created In Catalog" value={formatDateTime(asset.created_date)} />
            </InfoCard>

            {/* Description Card */}
            {asset.description && (
              <InfoCard title="Description & Purpose" icon={FileText} className="md:col-span-2">
                <p className="text-sm leading-relaxed text-foreground">{asset.description}</p>
              </InfoCard>
            )}

            {/* Tags Card */}
            {asset.tags && asset.tags.length > 0 && (
              <InfoCard title="Governance Tags" icon={Boxes} className="md:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {asset.tags.map((tag, i) => (
                    <span key={i} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      #{tag}
                    </span>
                  ))}
                </div>
              </InfoCard>
            )}

            {/* Provider Enriched Metadata */}
            {Object.keys(enriched).length > 0 && (
              <InfoCard title="Provider-Derived Enriched Attributes" icon={Database} className="md:col-span-2">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {Object.entries(enriched)
                    .filter(([k]) => !k.startsWith('_'))
                    .map(([key, val]) => (
                      val != null && val !== '' && (
                        <DataRow
                          key={key}
                          label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          value={Array.isArray(val) ? val.join(', ') : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        />
                      )
                    ))}
                </div>
              </InfoCard>
            )}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: RISK & GOVERNANCE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="risk">
          <div className="space-y-6">
            {/* Top Risk Overview Card */}
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-lg font-semibold text-foreground">AI Risk & Governance Posture</h3>
                </div>
                <RiskBadge level={asset.risk_level} />
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-3">
                {/* Score Gauge */}
                <div className="flex flex-col items-center justify-center rounded-xl bg-muted/20 p-5 text-center">
                  <div className="relative flex items-center justify-center">
                    <div className={cn(
                      'flex h-24 w-24 items-center justify-center rounded-full border-4 font-display text-3xl font-bold',
                      riskScoreNum >= 75 ? 'border-red-500 text-red-600 bg-red-500/10' :
                      riskScoreNum >= 50 ? 'border-orange-500 text-orange-600 bg-orange-500/10' :
                      riskScoreNum >= 25 ? 'border-amber-500 text-amber-600 bg-amber-500/10' :
                      'border-emerald-500 text-emerald-600 bg-emerald-500/10'
                    )}>
                      {riskScoreNum}
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Numeric Risk Score</p>
                  <p className="mt-1 text-xs text-muted-foreground">0 (Minimal) to 100 (Critical)</p>
                </div>

                {/* Classification info */}
                <div className="space-y-3 rounded-xl bg-muted/20 p-5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Assigned Risk Level:</span>
                    <RiskBadge level={asset.risk_level} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Data Sensitivity Tier:</span>
                    <SensitivityBadge sensitivity={asset.data_sensitivity} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Regulatory Impact Scope:</span>
                    <span className="text-xs font-medium text-foreground">
                      {asset.regulatory_scope?.length ? asset.regulatory_scope.join(', ') : 'Unspecified'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Shadow AI Indicator:</span>
                    <span className="text-xs font-medium">
                      {asset.asset_type === 'shadow_ai' || !asset.business_owner ? (
                        <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Unmanaged / Shadow AI
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Managed Asset
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Factor Analysis */}
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Automated Risk Evaluation & Threat Factors
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <RiskFactorCard
                  title="Data Leakage & Prompt Exposure"
                  severity={asset.data_sensitivity === 'restricted' || asset.data_sensitivity === 'confidential' ? 'high' : 'low'}
                  description={
                    asset.data_sensitivity === 'restricted'
                      ? 'Asset interacts with restricted corporate or customer data. Guardrails and redaction are mandatory.'
                      : 'Asset processes public or internal baseline data.'
                  }
                />
                <RiskFactorCard
                  title="Third-Party Ecosystem Dependency"
                  severity={['openai', 'anthropic'].includes(asset.provider?.toLowerCase()) ? 'medium' : 'low'}
                  description={`Integrated with ${asset.provider || 'external'} hosted LLM services. Service availability and data egress policies apply.`}
                />
                <RiskFactorCard
                  title="Autonomous Action Capability"
                  severity={['ai_agent', 'ai_workflow'].includes(asset.asset_type) ? 'high' : 'low'}
                  description={
                    ['ai_agent', 'ai_workflow'].includes(asset.asset_type)
                      ? 'High autonomy: asset can trigger API side effects, execute scripts, or invoke downstream tools.'
                      : 'Standard model/application interface without unbound external tool access.'
                  }
                />
                <RiskFactorCard
                  title="Regulatory Compliance Mandates"
                  severity={asset.regulatory_scope?.length ? 'high' : 'low'}
                  description={
                    asset.regulatory_scope?.length
                      ? `Subject to statutory governance mandates: ${asset.regulatory_scope.join(', ')}.`
                      : 'No strict statutory constraints explicitly declared.'
                  }
                />
              </div>

              {/* Stored Risk Rationale if present */}
              {enriched.risk_rationale && (
                <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historical Risk Rationale</p>
                  <p className="mt-1 text-sm text-foreground">{enriched.risk_rationale}</p>
                </div>
              )}
            </div>

            {/* Recommended Governance Controls */}
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-foreground">
                <Shield className="h-4 w-4 text-emerald-600" /> Recommended Enterprise Governance Controls
              </h3>
              <div className="space-y-3">
                <ControlRow
                  name="Role-Based Access Control (RBAC)"
                  status={asset.business_owner && asset.technical_owner ? 'enforced' : 'action_required'}
                  recommendation="Maintain defined business and engineering ownership with periodic credential rotation."
                />
                <ControlRow
                  name="Prompt Injection & Output Filtering Guardrails"
                  status={['ai_application', 'ai_agent'].includes(asset.asset_type) ? 'recommended' : 'optional'}
                  recommendation="Deploy gateway filters to sanitize untrusted prompts and inspect outbound generation for toxic content."
                />
                <ControlRow
                  name="Continuous Audit Trail & Telemetry"
                  status="enforced"
                  recommendation="All state alterations and discovery scans are recorded in OneKor's immutable audit log."
                />
                <ControlRow
                  name="PII Redaction & Data Loss Prevention"
                  status={asset.data_sensitivity === 'restricted' ? 'action_required' : 'recommended'}
                  recommendation="Enforce pre-call token anonymization before sending payload to external model providers."
                />
              </div>
            </div>

            {/* Manual Risk Override Form */}
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-primary" /> Administrative Risk Override & Assessment
                  </h3>
                  <p className="text-xs text-muted-foreground">Adjust risk scores and classification based on internal security reviews.</p>
                </div>
                {riskSavedFeedback && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Assessment Saved
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Risk Level</Label>
                  <Select value={riskOverrideLevel} onValueChange={setRiskOverrideLevel}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                      <SelectItem value="critical">Critical Risk</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Risk Score (0–100)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={riskOverrideScore}
                    onChange={(e) => setRiskOverrideScore(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Data Sensitivity</Label>
                  <Select value={riskOverrideSensitivity} onValueChange={setRiskOverrideSensitivity}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="confidential">Confidential</SelectItem>
                      <SelectItem value="restricted">Restricted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-3">
                  <Label className="text-xs">Assessment Justification & Notes</Label>
                  <Textarea
                    value={riskOverrideRationale}
                    onChange={(e) => setRiskOverrideRationale(e.target.value)}
                    placeholder="Document the technical rationale, security mitigation, or audit sign-off..."
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={handleSaveRiskOverride} className="gap-2">
                  <Save className="h-3.5 w-3.5" /> Save Risk Assessment
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: SOURCES & EVIDENCE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="evidence">
          <div className="space-y-5">
            {assetSources.length === 0 && findings.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-card py-16 text-center shadow-sm">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <h4 className="mt-3 font-display text-base font-semibold text-foreground">No Source Evidence Available</h4>
                <p className="mt-1 text-sm text-muted-foreground">This asset was either created manually or its discovery evidence was cleared.</p>
              </div>
            ) : (
              <>
                {/* Source Lineage Cards */}
                {assetSources.map((link) => {
                  const source = sourceMap[link.source_id];
                  return (
                    <div key={link.id} className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                      <div className="flex items-center justify-between pb-3 border-b border-border/50">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-primary" />
                          <h4 className="font-display text-base font-semibold text-foreground">
                            Discovery Source: {source?.name || link.source_id}
                          </h4>
                        </div>
                        {source && (
                          <Badge variant="outline" className="capitalize text-xs">
                            {source.connector_id} connector
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                        <TraceRow label="External Resource ID" value={<span className="font-mono text-xs">{link.external_id}</span>} />
                        <TraceRow label="First Detected" value={formatDateTime(link.first_seen)} />
                        <TraceRow label="Last Verified" value={formatRelative(link.last_seen)} />
                        <TraceRow label="Source Status" value={<span className="capitalize">{source?.status || 'active'}</span>} />
                      </div>
                    </div>
                  );
                })}

                {/* Evidence Findings Cards */}
                {findings.map((finding) => (
                  <div key={finding.id} className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <FileCode className="h-4 w-4 text-primary" />
                        <h4 className="font-display text-base font-semibold text-foreground">
                          Evidence Signal: {finding.name}
                        </h4>
                      </div>
                      <ConfidenceBadge
                        level={(finding.confidence_score || 0) >= 0.75 ? 'high' : (finding.confidence_score || 0) >= 0.5 ? 'medium' : 'low'}
                        score={finding.confidence_score}
                      />
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                      <TraceRow label="Provider Detected" value={<span className="capitalize">{finding.provider}</span>} />
                      <TraceRow label="Asset Type Signal" value={ASSET_TYPE_LABELS[finding.asset_type] || finding.asset_type} />
                      <TraceRow label="Detected Timestamp" value={formatDateTime(finding.created_date)} />
                      <TraceRow label="External Reference" value={<span className="font-mono text-xs truncate">{finding.external_id}</span>} />
                    </div>

                    {/* Confidence Reasons */}
                    {finding.confidence_reasons && finding.confidence_reasons.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/40">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Verification Criteria
                        </p>
                        <div className="space-y-1">
                          {finding.confidence_reasons.map((reason, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deep technical evidence detail */}
                    {finding.evidence && (
                      <div className="mt-3 pt-3 border-t border-border/40">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Technical Detection Artifacts
                        </p>
                        <div className="space-y-2 rounded-xl bg-muted/30 p-3 text-xs">
                          {finding.evidence.repository && <TraceRow label="Repository" value={finding.evidence.repository} />}
                          {finding.evidence.url && (
                            <TraceRow
                              label="Artifact URL"
                              value={
                                <a href={finding.evidence.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                  {finding.evidence.url} <ArrowUpRight className="h-3 w-3" />
                                </a>
                              }
                            />
                          )}
                          {finding.evidence.signals && <TraceRow label="Signals" value={finding.evidence.signals.join(', ')} />}
                          {finding.evidence.files_scanned != null && <TraceRow label="Files Scanned" value={String(finding.evidence.files_scanned)} />}

                          {finding.evidence.matches && finding.evidence.matches.length > 0 && (
                            <div className="pt-2">
                              <p className="mb-1.5 text-muted-foreground font-medium">Matched Detection Signatures:</p>
                              <div className="space-y-1.5">
                                {finding.evidence.matches.map((m, i) => (
                                  <div key={i} className="rounded-lg border border-border/50 bg-card p-2">
                                    <div className="font-semibold text-foreground">{m.rule}</div>
                                    <div className="text-muted-foreground font-mono text-[11px] mt-0.5">
                                      {m.rule_type} {m.file && `· ${m.file}`} {m.line && `· line ${m.line}`} {m.package && `· package ${m.package}`}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: AI MAP & RELATIONSHIPS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="relationships">
          <div className="space-y-6">
            {/* Visual Topology Graph */}
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-base font-semibold text-foreground">Discovery Topology & Lineage Map</h3>
                </div>
                <Badge variant="outline" className="text-xs">Evidence-Backed</Badge>
              </div>

              {/* Node Diagram */}
              <div className="py-6 flex flex-col items-center">
                {/* Top: Discovery Source Node */}
                {assetSources.length > 0 ? (
                  assetSources.map((link) => {
                    const source = sourceMap[link.source_id];
                    return (
                      <div key={link.id} className="flex flex-col items-center">
                        <div className="rounded-xl border border-border bg-muted/40 px-5 py-3 text-center shadow-sm max-w-sm">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upstream AI Source</p>
                          <p className="mt-0.5 text-sm font-semibold text-foreground">{source?.name || link.source_id}</p>
                          <p className="text-xs text-muted-foreground capitalize">{source?.connector_id || 'Connector'} · {link.external_id}</p>
                        </div>
                        {/* Connecting Line */}
                        <div className="h-6 w-px bg-border my-1" />
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mb-1" />
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground text-center">
                    Direct Manual Registration (No upstream automated connector)
                  </div>
                )}

                {/* Center: The Canonical Asset Node */}
                <div className="rounded-2xl border-2 border-primary/50 bg-primary/5 px-6 py-4 text-center shadow-md max-w-md w-full">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground mb-2">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="font-display text-base font-bold text-foreground truncate">{asset.display_name || asset.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type} · <span className="capitalize">{asset.provider}</span>
                  </p>
                  <div className="mt-2.5 flex items-center justify-center gap-1.5">
                    <RiskBadge level={asset.risk_level} />
                    <ReviewBadge status={asset.review_status} />
                    <LifecycleBadge stage={asset.lifecycle_stage} />
                  </div>
                </div>

                {/* Bottom line to Sibling Assets */}
                <div className="h-6 w-px bg-border my-1" />
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              </div>

              <div className="rounded-xl bg-muted/20 p-3 text-center text-xs text-muted-foreground">
                <Shield className="inline h-3.5 w-3.5 mr-1 text-primary" />
                Deterministic lineage: Assets are connected only when supported by verifiable connector telemetry and repository code references.
              </div>
            </div>

            {/* Same Provider Assets */}
            {sameProviderAssets.length > 0 && (
              <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-foreground">
                  <Boxes className="h-4 w-4 text-primary" /> Sibling Assets (Same Provider: <span className="capitalize">{asset.provider}</span>)
                </h3>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {sameProviderAssets.map((rel) => {
                    const RelIcon = TYPE_ICONS[rel.asset_type] || Boxes;
                    const relConf = (rel.confidence_score || 0) >= 0.75 ? 'high' : (rel.confidence_score || 0) >= 0.5 ? 'medium' : 'low';
                    return (
                      <button
                        key={rel.id}
                        onClick={() => navigate('/user/setup/ai-discovery/ai-profile?asset=' + rel.id)}
                        className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-all hover:bg-muted/20 hover:border-primary/50 shadow-sm"
                      >
                        <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg border', PROVIDER_COLORS[rel.provider?.toLowerCase()] || 'bg-primary/10 text-primary')}>
                          <RelIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{rel.display_name || rel.name}</p>
                          <p className="text-[11px] text-muted-foreground">{ASSET_TYPE_LABELS[rel.asset_type] || rel.asset_type}</p>
                        </div>
                        <RiskBadge level={rel.risk_level} className="text-[10px] px-2 py-0" />
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Same Source Assets */}
            {sameSourceAssets.length > 0 && (
              <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-foreground">
                  <GitBranch className="h-4 w-4 text-primary" /> Sibling Assets Discovered from Same AI Source
                </h3>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {sameSourceAssets.map((rel) => {
                    const RelIcon = TYPE_ICONS[rel.asset_type] || Boxes;
                    return (
                      <button
                        key={rel.id}
                        onClick={() => navigate('/user/setup/ai-discovery/ai-profile?asset=' + rel.id)}
                        className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-all hover:bg-muted/20 hover:border-primary/50 shadow-sm"
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <RelIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{rel.display_name || rel.name}</p>
                          <p className="text-[11px] text-muted-foreground">{ASSET_TYPE_LABELS[rel.asset_type] || rel.asset_type} · <span className="capitalize">{rel.provider}</span></p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: AUDIT & HISTORY */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="history">
          <div className="space-y-6">
            {/* Governance Audit Log */}
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-base font-semibold text-foreground">Governance Audit Trail</h3>
                </div>
                <Badge variant="outline" className="text-xs">Immutable Logs</Badge>
              </div>

              {auditEvents.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No governance modifications recorded yet for this asset. Actions like review confirmation, editing, and risk adjustment are automatically recorded here.
                </div>
              ) : (
                <div className="mt-4 relative space-y-4 pl-6">
                  <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
                  {auditEvents.map((evt) => (
                    <div key={evt.id} className="relative">
                      <div className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-primary bg-card" />
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                            {evt.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{formatDateTime(evt.created_date)}</span>
                        </div>
                        {evt.details && (
                          <div className="mt-2 text-xs text-muted-foreground font-mono bg-background/50 rounded-lg p-2 border border-border/40">
                            {JSON.stringify(evt.details, null, 1)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discovery Findings Timeline */}
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-foreground">
                <Clock className="h-4 w-4 text-primary" /> Detection & Discovery Timeline
              </h3>
              {findings.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No scan detection events logged.</p>
              ) : (
                <div className="relative space-y-4 pl-6">
                  <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
                  {findings.map((f) => (
                    <div key={f.id} className="relative">
                      <div className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-emerald-500 bg-card" />
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">{f.name}</span>
                          <span className="text-[11px] text-muted-foreground">{formatDateTime(f.created_date)}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {ASSET_TYPE_LABELS[f.asset_type] || f.asset_type} · <span className="capitalize">{f.provider}</span> · {Math.round((f.confidence_score || 0) * 100)}% confidence
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* EDIT ASSET MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit AI Asset: {asset.display_name || asset.name}
            </DialogTitle>
            <DialogDescription>
              Update asset metadata, governance ownership, risk levels, and regulatory boundaries. Changes are recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Display Name</Label>
                <Input
                  value={editData.display_name || ''}
                  onChange={(e) => setEditData({ ...editData, display_name: e.target.value })}
                  placeholder="Human-readable name"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={editData.description || ''}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder="Purpose, capabilities, or business justification"
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Business Owner</Label>
                <Input
                  value={editData.business_owner || ''}
                  onChange={(e) => setEditData({ ...editData, business_owner: e.target.value })}
                  placeholder="e.g. Jane Doe (Product)"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Technical Owner</Label>
                <Input
                  value={editData.technical_owner || ''}
                  onChange={(e) => setEditData({ ...editData, technical_owner: e.target.value })}
                  placeholder="e.g. Platform Team"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Environment</Label>
                <Input
                  value={editData.environment || ''}
                  onChange={(e) => setEditData({ ...editData, environment: e.target.value })}
                  placeholder="e.g. production, staging, development"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Lifecycle Stage</Label>
                <Select
                  value={editData.lifecycle_stage || 'unknown'}
                  onValueChange={(val) => setEditData({ ...editData, lifecycle_stage: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="evaluation">Evaluation</SelectItem>
                    <SelectItem value="deprecated">Deprecated</SelectItem>
                    <SelectItem value="sunset">Sunset</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Risk Level</Label>
                <Select
                  value={editData.risk_level || 'unknown'}
                  onValueChange={(val) => setEditData({ ...editData, risk_level: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Risk Score (0–100)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={editData.risk_score || 0}
                  onChange={(e) => setEditData({ ...editData, risk_score: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Data Sensitivity</Label>
                <Select
                  value={editData.data_sensitivity || 'internal'}
                  onValueChange={(val) => setEditData({ ...editData, data_sensitivity: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="confidential">Confidential</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Regulatory Scope (comma-separated)</Label>
                <Input
                  value={editData.regulatory_scope || ''}
                  onChange={(e) => setEditData({ ...editData, regulatory_scope: e.target.value })}
                  placeholder="e.g. GDPR, HIPAA, EU AI Act"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={editData.tags || ''}
                  onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
                  placeholder="e.g. customer-facing, automated, production-llm"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} className="gap-2">
              <Save className="h-4 w-4" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DELETE CONFIRM ALERT DIALOG */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete AI Asset?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">{asset.display_name || asset.name}</span>?
              This will remove the canonical asset record from the AI Catalog. Original detection findings and source evidence are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteAsset}>
              Delete AI Asset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────
function InfoCard({ title, icon: Icon, children, className }) {
  return (
    <div className={cn('rounded-2xl border border-border/70 bg-card p-5 shadow-sm', className)}>
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DataRow({ label, value }) {
  if (!value || value === 'Not assigned' || value === 'Not specified') {
    return (
      <div className="flex justify-between items-center gap-2 text-sm">
        <span className="shrink-0 text-muted-foreground">{label}:</span>
        <span className="text-muted-foreground/60 italic text-xs">{value || 'Not available'}</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between items-center gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function TraceRow({ label, value }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function RiskFactorCard({ title, severity, description }) {
  const isHigh = severity === 'high';
  const isMed = severity === 'medium';
  return (
    <div className={cn(
      'rounded-xl border p-3.5',
      isHigh ? 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20' :
      isMed ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20' :
      'border-border/60 bg-muted/20'
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className={cn(
          'text-[10px] font-bold uppercase rounded px-1.5 py-0.5',
          isHigh ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
          isMed ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
          'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
        )}>
          {severity}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function ControlRow({ name, status, recommendation }) {
  const isEnforced = status === 'enforced';
  const isReq = status === 'action_required';
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{recommendation}</p>
      </div>
      <span className={cn(
        'shrink-0 text-[10px] font-bold uppercase rounded px-2 py-0.5 mt-0.5',
        isEnforced ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
        isReq ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
        'bg-blue-500/20 text-blue-600 dark:text-blue-400'
      )}>
        {status.replace('_', ' ')}
      </span>
    </div>
  );
}