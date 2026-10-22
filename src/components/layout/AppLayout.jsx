import { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { panels, getPanel, getArea, getModule, getFeature } from '@/lib/navigation';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileSidebar from './MobileSidebar';
import Breadcrumbs from './Breadcrumbs';
import FeaturePage from './FeaturePage';

const NavContext = createContext(null);
export const useNav = () => useContext(NavContext);

export default function AppLayout() {
  const { panel: panelId, area: areaId, module: moduleId, feature: featureId } = useParams();
  const panel = getPanel(panelId) || panels[0];
  const area = getArea(panel, areaId) || panel.areas[0];
  const mod = getModule(area, moduleId) || area.modules[0];
  const feature = getFeature(mod, featureId) || mod.features[0];

  const [collapsed, setCollapsed] = useState(
    () => (typeof window !== 'undefined' && window.localStorage.getItem('onekor-collapsed') === '1')
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('onekor-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  const value = { panel, area, mod, feature, collapsed, setCollapsed, mobileOpen, setMobileOpen };

  return (
    <NavContext.Provider value={value}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <MobileSidebar />

        <div className="flex flex-1 flex-col min-w-0">
          <Header />
          <Breadcrumbs />
          <main className="flex-1 overflow-y-auto">
            <FeaturePage />
          </main>
        </div>
      </div>
    </NavContext.Provider>
  );
}