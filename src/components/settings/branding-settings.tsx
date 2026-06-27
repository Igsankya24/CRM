"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Globe, Layout, MessageSquare, Info } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]);
const ALLOWED_FAVICON_TYPES = new Set(["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml"]);

export function BrandingSettingsCard() {
  const { branding, refresh, updateBranding } = useBranding();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const [appName, setAppName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeFavicon, setRemoveFavicon] = useState(false);

  const [saving, setSaving] = useState(false);

  // Initialize state from context
  useEffect(() => {
    if (branding) {
      Promise.resolve().then(() => {
        setAppName(branding.app_name || "");
        setLogoPreview(branding.logo_url || null);
        setFaviconPreview(branding.favicon_url || null);
        setLogoFile(null);
        setFaviconFile(null);
        setRemoveLogo(false);
        setRemoveFavicon(false);
      });
    }
  }, [branding]);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
      if (faviconPreview && faviconPreview.startsWith("blob:")) URL.revokeObjectURL(faviconPreview);
    };
  }, [logoPreview, faviconPreview]);

  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      toast.error("Unsupported logo format", { description: "Use PNG, JPG, JPEG, SVG, or WebP." });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File is too large", { description: "Maximum size is 2 MB." });
      return;
    }

    if (logoPreview && logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const handleFaviconPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check mime type (fallback to ext check for .ico if mime is empty)
    const ext = file.name.split(".").pop()?.toLowerCase();
    const isIco = ext === "ico";

    if (!ALLOWED_FAVICON_TYPES.has(file.type) && !isIco) {
      toast.error("Unsupported favicon format", { description: "Use PNG, ICO, or SVG." });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File is too large", { description: "Maximum size is 2 MB." });
      return;
    }

    if (faviconPreview && faviconPreview.startsWith("blob:")) URL.revokeObjectURL(faviconPreview);
    setFaviconFile(file);
    setFaviconPreview(URL.createObjectURL(file));
    setRemoveFavicon(false);
  };

  const handleRemoveLogo = () => {
    if (logoPreview && logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
  };

  const handleRemoveFavicon = () => {
    if (faviconPreview && faviconPreview.startsWith("blob:")) URL.revokeObjectURL(faviconPreview);
    setFaviconFile(null);
    setFaviconPreview(null);
    setRemoveFavicon(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = appName.trim();
    if (!trimmedName) {
      toast.error("Application Name is required.");
      return;
    }
    if (trimmedName.length > 50) {
      toast.error("Application Name cannot exceed 50 characters.");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("appName", trimmedName);
      formData.append("removeLogo", String(removeLogo));
      formData.append("removeFavicon", String(removeFavicon));

      if (logoFile) {
        formData.append("logo", logoFile);
      }
      if (faviconFile) {
        formData.append("favicon", faviconFile);
      }

      const res = await fetch("/api/settings/branding", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to save settings");
      }

      // Update global context state immediately
      updateBranding({
        app_name: trimmedName,
        logo_url: removeLogo ? null : (result.settings?.logo_url || logoPreview),
        favicon_url: removeFavicon ? null : (result.settings?.favicon_url || faviconPreview),
      });

      await refresh();
      toast.success("Branding settings saved successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const isDirty =
    appName.trim() !== (branding.app_name || "") ||
    logoFile !== null ||
    faviconFile !== null ||
    removeLogo !== (branding.logo_url === null && removeLogo) ||
    removeFavicon !== (branding.favicon_url === null && removeFavicon);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Branding Form */}
      <Card className="bg-card border-border lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-foreground">SaaS Branding Config</CardTitle>
          <CardDescription className="text-muted-foreground">
            Configure your white-label platform branding. These changes will reflect immediately without reload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* App Name */}
            <div className="space-y-2">
              <Label htmlFor="app-name" className="text-foreground">
                Application Name
              </Label>
              <Input
                id="app-name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="Phoenix CRM"
                maxLength={50}
                disabled={saving}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Max 50 characters. Supports spaces.
              </p>
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label className="text-foreground">Brand Logo</Label>
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo Preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold uppercase text-muted-foreground/75">
                      {(appName || "C").charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleLogoPick}
                      disabled={saving}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={saving}
                    >
                      <Upload className="size-4" />
                      {logoPreview ? "Change logo" : "Upload logo"}
                    </Button>
                    {logoPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleRemoveLogo}
                        disabled={saving}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG, SVG, JPG, WebP. Up to 2 MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Favicon Upload */}
            <div className="space-y-2">
              <Label className="text-foreground">Browser Favicon</Label>
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 overflow-hidden">
                  {faviconPreview ? (
                    <img src={faviconPreview} alt="Favicon Preview" className="h-6 w-6 object-contain" />
                  ) : (
                    <Globe className="h-5 w-5 text-muted-foreground/75" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      ref={faviconInputRef}
                      type="file"
                      accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
                      className="hidden"
                      onChange={handleFaviconPick}
                      disabled={saving}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => faviconInputRef.current?.click()}
                      disabled={saving}
                    >
                      <Upload className="size-4" />
                      {faviconPreview ? "Change favicon" : "Upload favicon"}
                    </Button>
                    {faviconPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleRemoveFavicon}
                        disabled={saving}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG, ICO, SVG. Up to 2 MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving || !isDirty}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving changes...
                  </>
                ) : (
                  "Save branding"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Live Preview Card */}
      <Card className="bg-card border-border h-fit">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Layout className="size-5 text-primary" />
            Live Preview
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Observe how your branding renders across the workspace layout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Browser Tab Preview */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
              Browser Tab Preview
            </Label>
            <div className="flex items-center gap-2 rounded-t-lg border-x border-t border-border bg-slate-950 p-2.5 shadow-sm">
              <div className="flex items-center gap-1.5 rounded bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 w-full max-w-[200px] shadow-sm">
                <div className="h-3.5 w-3.5 shrink-0 overflow-hidden flex items-center justify-center">
                  {faviconPreview ? (
                    <img src={faviconPreview} alt="Favicon" className="h-full w-full object-contain" />
                  ) : (
                    <Globe className="h-3 w-3 text-slate-500" />
                  )}
                </div>
                <span className="truncate font-medium text-[11px]">
                  Settings — {appName.trim() || "CRM with AI"}
                </span>
              </div>
              <div className="h-2 w-2 rounded-full bg-slate-800" />
              <div className="h-2 w-2 rounded-full bg-slate-800" />
            </div>
            <div className="h-2 rounded-b-lg border-x border-b border-border bg-slate-900" />
          </div>

          {/* Sidebar Preview */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
              Sidebar Preview
            </Label>
            <div className="rounded-lg border border-border bg-slate-950 p-4 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-white text-xs overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-bold uppercase">
                      {(appName || "C").charAt(0)}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {appName.trim() || "CRM with AI"}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-1/2 rounded bg-slate-800/60" />
                <div className="h-2 w-3/4 rounded bg-slate-800/40" />
                <div className="h-2 w-2/3 rounded bg-slate-800/40" />
              </div>
            </div>
          </div>

          {/* Header Mobile Preview */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
              Header Preview (Mobile View)
            </Label>
            <div className="rounded-lg border border-border bg-slate-950 p-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-slate-800/60 flex items-center justify-center text-[10px] text-slate-400">
                  ☰
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-white text-[9px] font-bold overflow-hidden">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <span className="uppercase">
                        {(appName || "C").charAt(0)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300 truncate max-w-[60px]">
                    {appName.trim() || "CRM with AI"}
                  </span>
                  <span className="text-slate-600 text-[10px]">/</span>
                  <span className="text-[10px] text-slate-400 font-medium">Settings</span>
                </div>
              </div>
              <div className="h-6 w-6 rounded-full bg-slate-800/60" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
