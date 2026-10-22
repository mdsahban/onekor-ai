import user from './user';
import admin from './admin';

export const panels = [user, admin];

export const getPanel = (panelId) => panels.find((p) => p.id === panelId);
export const getArea = (panel, areaId) => panel?.areas.find((a) => a.id === areaId);
export const getModule = (area, moduleId) => area?.modules.find((m) => m.id === moduleId);
export const getFeature = (mod, featureId) => mod?.features.find((f) => f.id === featureId);

export const defaultPath = (panelId) => {
  const p = getPanel(panelId) || panels[0];
  const a = p.areas[0];
  const m = a.modules[0];
  return `/${p.id}/${a.id}/${m.id}/${m.features[0].id}`;
};

export const areaDefaultPath = (panelId, areaId) => {
  const p = getPanel(panelId);
  const a = getArea(p, areaId);
  if (!a) return defaultPath(panelId);
  const m = a.modules[0];
  return `/${panelId}/${areaId}/${m.id}/${m.features[0].id}`;
};

export const moduleDefaultPath = (panelId, areaId, moduleId) => {
  const p = getPanel(panelId);
  const a = getArea(p, areaId);
  const m = a?.modules.find((mod) => mod.id === moduleId);
  if (!m) return areaDefaultPath(panelId, areaId);
  return `/${panelId}/${areaId}/${moduleId}/${m.features[0].id}`;
};

export const pathFor = (panelId, areaId, moduleId, featureId) =>
  `/${panelId}/${areaId}/${moduleId}/${featureId}`;

export const isFeatureLive = (panel, area, mod) => {
  if (mod.id === 'dashboard') return true;
  if (panel.id === 'admin' && area.id === 'organization' && mod.id === 'branding') return true;
  if (panel.id === 'user' && area.id === 'setup' && mod.id === 'ai-discovery') return true;
  return false;
};

export const isBrandingModule = (panel, area, mod) =>
  panel.id === 'admin' && area.id === 'organization' && mod.id === 'branding';