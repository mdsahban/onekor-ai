import { useNav } from './AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import { isBrandingModule } from '@/lib/navigation';
import BrandingPage from '@/pages/BrandingPage';
import DashboardContent from './DashboardContent';
import { Clock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ConnectorsPage from '@/pages/discovery/ConnectorsPage';
import ConnectorDetailPage from '@/pages/discovery/ConnectorDetailPage';
import AiSourcesPage from '@/pages/discovery/AiSourcesPage';
import SourceDetailPage from '@/pages/discovery/SourceDetailPage';
import DetectionPage from '@/pages/discovery/DetectionPage';
import EnrichmentPage from '@/pages/discovery/EnrichmentPage';
import InventoryPage from '@/pages/discovery/InventoryPage';
import AssetProfilePage from '@/pages/discovery/AssetProfilePage';
import AiModelsPage from '@/pages/admin/AiModelsPage';

function ComingSoon({ feature, panel }) {
  const { t } = useLanguage();
  const Icon = feature.icon;
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-border/70 bg-card p-10 text-center shadow-sm">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Icon className="h-8 w-8" />
          </div>
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {t('Coming Soon')}
          </span>
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground">{t(feature.name)}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t(feature.desc)}</p>
          <p className="mt-5 text-xs text-muted-foreground/70">
            {t('Part of')} <span className="font-medium text-muted-foreground">{t(panel.name)}</span> · {t('navigation and structure are ready.')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FeaturePage() {
  const { panel, area, mod, feature } = useNav();
  const [searchParams] = useSearchParams();

  if (isBrandingModule(panel, area, mod)) {
    return <BrandingPage />;
  }

  if (panel.id === 'user' && area.id === 'setup' && mod.id === 'ai-discovery') {
    if (feature.id === 'connectors') {
      const connectorId = searchParams.get('connector');
      if (connectorId) return <ConnectorDetailPage connectorId={connectorId} />;
      return <ConnectorsPage />;
    }
    if (feature.id === 'ai-sources') {
      const sourceId = searchParams.get('source');
      if (sourceId) return <SourceDetailPage sourceId={sourceId} />;
      return <AiSourcesPage />;
    }
    if (feature.id === 'ai-detection') return <DetectionPage />;
    if (feature.id === 'ai-enrichment') return <EnrichmentPage />;
    if (feature.id === 'ai-inventory') return <InventoryPage />;
    if (feature.id === 'ai-profile') {
      const assetId = searchParams.get('asset');
      if (assetId) return <AssetProfilePage assetId={assetId} />;
      return <InventoryPage />;
    }
  }

  if (panel.id === 'admin' && area.id === 'platform' && mod.id === 'integrations' && (feature.id === 'llm-engines' || feature.id === 'ai-models')) {
    return <AiModelsPage />;
  }

  if (mod.id === 'dashboard') {
    return <DashboardContent />;
  }

  return <ComingSoon feature={feature} panel={panel} />;
}