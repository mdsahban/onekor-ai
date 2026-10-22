import { useState, useEffect } from 'react';
import { useNav } from '@/components/layout/AppLayout';
import { useLanguage } from '@/components/LanguageProvider';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DetectionProfilesTab from './detection/DetectionProfilesTab';
import ScanProfilesTab from './detection/ScanProfilesTab';
import ScanHistoryTab from './detection/ScanHistoryTab';
import ScanOutputTab from './detection/ScanOutputTab';
import { Crosshair, ScanLine, History, FileSearch } from 'lucide-react';

export default function DetectionPage() {
  const { feature } = useNav();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'profiles');
  const [drillScanId, setDrillScanId] = useState(searchParams.get('scan') || null);

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    const scanParam = searchParams.get('scan');
    if (scanParam !== drillScanId) {
      setDrillScanId(scanParam);
    }
  }, [tabParam, searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (tab !== 'output') next.delete('scan');
    setSearchParams(next);
  };

  const handleNavigateOutput = (scanId) => {
    setDrillScanId(scanId);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'output');
    if (scanId) next.set('scan', scanId);
    setSearchParams(next);
    setActiveTab('output');
  };

  const handleNavigateHistory = (scanId) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'history');
    if (scanId) next.set('scan', scanId);
    setSearchParams(next);
    setActiveTab('history');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <feature.icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{t(feature.name)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(feature.desc)}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="profiles" className="gap-1.5"><Crosshair className="h-3.5 w-3.5" /> Detection Profiles</TabsTrigger>
          <TabsTrigger value="scan-profiles" className="gap-1.5"><ScanLine className="h-3.5 w-3.5" /> Scan Profiles</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="h-3.5 w-3.5" /> Scan History</TabsTrigger>
          <TabsTrigger value="output" className="gap-1.5"><FileSearch className="h-3.5 w-3.5" /> Scan Output</TabsTrigger>
        </TabsList>
        <TabsContent value="profiles"><DetectionProfilesTab /></TabsContent>
        <TabsContent value="scan-profiles"><ScanProfilesTab onNavigateHistory={handleNavigateHistory} onNavigateOutput={handleNavigateOutput} /></TabsContent>
        <TabsContent value="history"><ScanHistoryTab onNavigateOutput={handleNavigateOutput} /></TabsContent>
        <TabsContent value="output"><ScanOutputTab initialScanId={drillScanId} /></TabsContent>
      </Tabs>
    </div>
  );
}