import { useNav } from './AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { cn } from '@/lib/utils';

const dashboardData = {
  'ai-governance': {
    stats: [
      { label: 'Active AI Assets', value: '128', delta: '+12', up: true, hint: 'this month' },
      { label: 'Open Risks', value: '7', delta: '-3', up: false, hint: 'vs last week' },
      { label: 'Policies Enforced', value: '24', delta: '+2', up: true, hint: 'new policies' },
      { label: 'Compliance Score', value: '94%', delta: '+5%', up: true, hint: 'overall' },
    ],
    chart: [
      { day: 'Mon', value: 42 }, { day: 'Tue', value: 55 }, { day: 'Wed', value: 48 },
      { day: 'Thu', value: 67 }, { day: 'Fri', value: 72 }, { day: 'Sat', value: 58 }, { day: 'Sun', value: 81 },
    ],
    bars: [
      { name: 'Approved', value: 86 }, { name: 'Pending', value: 12 }, { name: 'Rejected', value: 5 }, { name: 'Review', value: 8 },
    ],
    activity: [
      { title: 'New AI policy approved', time: '2h ago', type: 'success' },
      { title: 'Risk assessment completed for GPT-4 assistant', time: '5h ago', type: 'info' },
      { title: '3 new AI assets discovered in cloud environment', time: '8h ago', type: 'info' },
      { title: 'Compliance score improved by 5%', time: '1d ago', type: 'success' },
      { title: 'Policy violation detected on AI agent', time: '2d ago', type: 'warning' },
    ],
  },
  'ai-security': {
    stats: [
      { label: 'Active Threats', value: '3', delta: '-2', up: false, hint: 'vs last week' },
      { label: 'Blocked Attacks', value: '1,247', delta: '+89', up: true, hint: 'this month' },
      { label: 'Security Score', value: '87%', delta: '+3%', up: true, hint: 'overall' },
      { label: 'Open Incidents', value: '2', delta: '-1', up: false, hint: 'vs last week' },
    ],
    chart: [
      { day: 'Mon', value: 120 }, { day: 'Tue', value: 95 }, { day: 'Wed', value: 140 },
      { day: 'Thu', value: 88 }, { day: 'Fri', value: 160 }, { day: 'Sat', value: 72 }, { day: 'Sun', value: 105 },
    ],
    bars: [
      { name: 'Blocked', value: 1247 }, { name: 'Allowed', value: 3402 }, { name: 'Flagged', value: 156 }, { name: 'Quarantined', value: 43 },
    ],
    activity: [
      { title: 'Prompt injection attack blocked', time: '12m ago', type: 'warning' },
      { title: 'New security policy deployed', time: '1h ago', type: 'success' },
      { title: 'Suspicious AI activity flagged for review', time: '3h ago', type: 'warning' },
      { title: 'Security incident resolved', time: '6h ago', type: 'success' },
      { title: 'Data leakage prevention rule updated', time: '1d ago', type: 'info' },
    ],
  },
  'ai-factory': {
    stats: [
      { label: 'Active Projects', value: '14', delta: '+3', up: true, hint: 'this month' },
      { label: 'Build Success Rate', value: '92%', delta: '+4%', up: true, hint: 'overall' },
      { label: 'Test Coverage', value: '78%', delta: '+6%', up: true, hint: 'vs last week' },
      { label: 'Deployments', value: '47', delta: '+11', up: true, hint: 'this month' },
    ],
    chart: [
      { day: 'Mon', value: 8 }, { day: 'Tue', value: 12 }, { day: 'Wed', value: 6 },
      { day: 'Thu', value: 15 }, { day: 'Fri', value: 9 }, { day: 'Sat', value: 4 }, { day: 'Sun', value: 11 },
    ],
    bars: [
      { name: 'Building', value: 5 }, { name: 'Testing', value: 3 }, { name: 'Deployed', value: 47 }, { name: 'Failed', value: 2 },
    ],
    activity: [
      { title: 'AI agent deployed to production', time: '25m ago', type: 'success' },
      { title: 'Build completed for customer service bot', time: '2h ago', type: 'info' },
      { title: 'Security testing passed for model v2.1', time: '4h ago', type: 'success' },
      { title: 'New AI project created', time: '7h ago', type: 'info' },
      { title: 'Deployment failed - retrying', time: '1d ago', type: 'warning' },
    ],
  },
};

function StatCard({ stat, t }) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{t(stat.label)}</p>
        <div className="mt-2 flex items-end justify-between">
          <span className="font-display text-3xl font-semibold tracking-tight text-foreground">{stat.value}</span>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
              stat.up ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'
            )}
          >
            {stat.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {stat.delta}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t(stat.hint)}</p>
      </CardContent>
    </Card>
  );
}

function ActivityIcon({ type }) {
  if (type === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Activity className="h-4 w-4 text-primary" />;
}

export default function DashboardContent() {
  const { panel, area, feature } = useNav();
  const { t } = useLanguage();
  const data = dashboardData[area.id] || dashboardData['ai-governance'];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <feature.icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{t(feature.name)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(feature.desc)}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.stats.map((s) => (
          <StatCard key={s.label} stat={s} t={t} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-border/70 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">{t('Trend Analysis')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('Status Distribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.bars} layout="vertical" margin={{ top: 5, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                  cursor={{ fill: 'hsl(var(--muted))' }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t('Recent Activity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {data.activity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted">
                  <ActivityIcon type={item.type} />
                </div>
                <span className="flex-1 text-sm text-foreground">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}