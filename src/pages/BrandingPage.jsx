import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useNav } from '@/components/layout/AppLayout';
import { useBranding } from '@/components/BrandingProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { base44 } from '@/api/base44Client';
import { pathFor } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, Save, Check, Trash2, Loader2, Monitor } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

function UploadZone({ onUpload, accept, t, hint }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      onUpload(file_url);
    } catch (err) {
      setError(err.message || 'Upload failed');
    }
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-foreground">
          {uploading ? 'Uploading...' : t('Drag and drop or click to upload')}
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ImagePreview({ src, onRemove, t, label }) {
  if (!src) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
        <Image src={src} alt={label} fittingType="fit" className="h-full w-full" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{t('Current Logo')}</p>
        <p className="truncate text-xs text-muted-foreground">{src}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove} className="h-8 w-8 text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function TabLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      {children}
    </Link>
  );
}

export default function BrandingPage() {
  const { panel, area, mod, feature } = useNav();
  const { branding, updateBranding } = useBranding();
  const { t } = useLanguage();
  const [siteName, setSiteName] = useState(branding.siteName);
  const [tagline, setTagline] = useState(branding.tagline);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateBranding({ siteName, tagline });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const base = pathFor(panel.id, area.id, mod.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <feature.icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{t(feature.name)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(feature.desc)}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <TabLink to={`${base}/site-branding`} active={feature.id === 'site-branding'}>{t('Site Branding')}</TabLink>
        <TabLink to={`${base}/logos`} active={feature.id === 'logos'}>{t('Logos')}</TabLink>
        <TabLink to={`${base}/favicon`} active={feature.id === 'favicon'}>{t('Favicon')}</TabLink>
      </div>

      {feature.id === 'site-branding' && (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display">{t('Brand Identity')}</CardTitle>
            <CardDescription>{t('Customize your workspace appearance')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site-name">{t('Site Name')}</Label>
              <Input id="site-name" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="OneKor" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">{t('Tagline')}</Label>
              <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Enterprise Workspace" />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} className="gap-2">
                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? t('Saved successfully') : t('Save Changes')}
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('Preview')}</p>
              <div className="flex items-center gap-3 rounded-xl bg-background p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-sm font-semibold text-primary-foreground">
                  {(siteName || 'OK').charAt(0).toUpperCase()}
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="font-display text-[15px] font-semibold text-foreground">{siteName || 'OneKor'}</span>
                  <span className="text-[11px] text-muted-foreground">{tagline || 'Enterprise Workspace'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {feature.id === 'logos' && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display">{t('Light Logo')}</CardTitle>
              <CardDescription>{t('PNG or SVG')} · {t('Recommended size')} 128×32px</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ImagePreview
                src={branding.logoLight}
                onRemove={() => updateBranding({ logoLight: null })}
                t={t}
                label={t('Light Logo')}
              />
              <UploadZone
                onUpload={(url) => updateBranding({ logoLight: url })}
                accept="image/png,image/svg+xml"
                t={t}
                hint="PNG / SVG"
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display">{t('Dark Logo')}</CardTitle>
              <CardDescription>{t('PNG or SVG')} · {t('Recommended size')} 128×32px</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ImagePreview
                src={branding.logoDark}
                onRemove={() => updateBranding({ logoDark: null })}
                t={t}
                label={t('Dark Logo')}
              />
              <UploadZone
                onUpload={(url) => updateBranding({ logoDark: url })}
                accept="image/png,image/svg+xml"
                t={t}
                hint="PNG / SVG"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {feature.id === 'favicon' && (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display">{t('Favicon Management')}</CardTitle>
            <CardDescription>{t('Upload and manage your favicon')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {branding.favicon && (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                  <Image src={branding.favicon} alt="Favicon" fittingType="fit" className="h-full w-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{t('Current Logo')}</p>
                  <p className="truncate text-xs text-muted-foreground">{branding.favicon}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => updateBranding({ favicon: null })} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            <UploadZone
              onUpload={(url) => updateBranding({ favicon: url })}
              accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
              t={t}
              hint="PNG, SVG or ICO · 32×32px / 16×16px"
            />
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <Monitor className="h-4 w-4 shrink-0" />
              <span>{t('The icon shown in browser tabs and bookmarks.')}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}