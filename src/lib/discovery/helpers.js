export const CONNECTION_STATUS_META = {
  not_configured: { label: 'Not Configured', color: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' },
  connected: { label: 'Connected', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', dot: 'bg-emerald-500' },
  degraded: { label: 'Degraded', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', dot: 'bg-amber-500' },
  authentication_failed: { label: 'Auth Failed', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40', dot: 'bg-red-500' },
  permission_denied: { label: 'Permission Denied', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40', dot: 'bg-red-500' },
  rate_limited: { label: 'Rate Limited', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40', dot: 'bg-orange-500' },
  error: { label: 'Error', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40', dot: 'bg-red-500' },
  disabled: { label: 'Disabled', color: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' },
};

export const CONNECTOR_STATUS_META = {
  available: { label: 'Available', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', dot: 'bg-emerald-500' },
  beta: { label: 'Beta', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40', dot: 'bg-blue-500' },
  coming_soon: { label: 'Coming Soon', color: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' },
  disabled: { label: 'Disabled', color: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' },
  error: { label: 'Error', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40', dot: 'bg-red-500' },
};

export const CONFIDENCE_META = {
  high: { label: 'High', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', bar: 'bg-emerald-500' },
  medium: { label: 'Medium', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', bar: 'bg-amber-500' },
  low: { label: 'Low', color: 'text-muted-foreground', bg: 'bg-muted', bar: 'bg-muted-foreground' },
};

export const REVIEW_STATUS_META = {
  pending: { label: 'Pending Review', color: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' },
  confirmed: { label: 'Confirmed', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', dot: 'bg-emerald-500' },
  rejected: { label: 'Rejected', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40', dot: 'bg-red-500' },
  needs_review: { label: 'Needs Review', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', dot: 'bg-amber-500' },
};

export const SEVERITY_META = {
  high: { label: 'High', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40' },
  medium: { label: 'Medium', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  low: { label: 'Low', color: 'text-muted-foreground', bg: 'bg-muted' },
};

export const RISK_LEVEL_META = {
  critical: { label: 'Critical', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40', dot: 'bg-red-500', border: 'border-red-200 dark:border-red-900' },
  high: { label: 'High', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40', dot: 'bg-orange-500', border: 'border-orange-200 dark:border-orange-900' },
  medium: { label: 'Medium', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', dot: 'bg-amber-500', border: 'border-amber-200 dark:border-amber-900' },
  low: { label: 'Low', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-900' },
  unknown: { label: 'Unknown', color: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground', border: 'border-border' },
};

export const LIFECYCLE_META = {
  active: { label: 'Active', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', dot: 'bg-emerald-500' },
  deprecated: { label: 'Deprecated', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', dot: 'bg-amber-500' },
  sunset: { label: 'Sunset', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40', dot: 'bg-red-500' },
  evaluation: { label: 'Evaluation', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40', dot: 'bg-blue-500' },
  unknown: { label: 'Unknown', color: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' },
};

export const DATA_SENSITIVITY_META = {
  public: { label: 'Public', color: 'text-muted-foreground', bg: 'bg-muted' },
  internal: { label: 'Internal', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40' },
  confidential: { label: 'Confidential', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  restricted: { label: 'Restricted', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40' },
};


export const LOG_SEVERITY_META = {
  info: { label: 'Info', color: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  warn: { label: 'Warn', color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  error: { label: 'Error', color: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  debug: { label: 'Debug', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

export const ASSET_TYPE_LABELS = {
  ai_application: 'AI Application',
  ai_agent: 'AI Agent',
  ai_model: 'AI Model',
  ai_api: 'AI API',
  ai_saas: 'AI SaaS',
  ai_copilot: 'AI Copilot',
  ai_workflow: 'AI Workflow',
  ai_platform: 'AI Platform',
  ai_integration: 'AI Integration',
  ai_account: 'AI Account',
  personal_ai_account: 'Personal AI Account',
  shadow_ai: 'Shadow AI',
};

export const RUN_STATUS_META = {
  queued: { label: 'Queued', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  starting: { label: 'Starting', color: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  connecting: { label: 'Connecting', color: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  fetching: { label: 'Fetching', color: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  analyzing: { label: 'Analyzing', color: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  classifying: { label: 'Classifying', color: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  deduplicating: { label: 'Deduplicating', color: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  enriching: { label: 'Enriching', color: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  saving: { label: 'Saving', color: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  completed: { label: 'Completed', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  failed: { label: 'Failed', color: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(dateStr) {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Never';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  if (ms < 60000) return `${s}s`;
  const m = Math.floor(ms / 60000);
  const remS = Math.floor((ms % 60000) / 1000);
  return `${m}m ${remS}s`;
}

export function formatSchedule(freq) {
  const map = { manual: 'Manual', hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly' };
  return map[freq] || freq || 'Manual';
}