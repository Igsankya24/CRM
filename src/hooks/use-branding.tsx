"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface BrandingSettings {
  id?: string;
  app_name: string;
  logo_url: string | null;
  favicon_url: string | null;
}

interface BrandingContextValue {
  branding: BrandingSettings;
  loading: boolean;
  refresh: () => Promise<void>;
  updateBranding: (updates: Partial<BrandingSettings>) => void;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

export const DEFAULT_BRANDING: BrandingSettings = {
  app_name: "CRM with AI",
  logo_url: null,
  favicon_url: null,
};

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inbox": "Inbox",
  "/contacts": "Contacts",
  "/pipelines": "Pipelines",
  "/broadcasts": "Broadcasts",
  "/automations": "Automations",
  "/settings": "Settings",
  "/leads": "All Leads",
  "/leads/indiamart": "IndiaMART Leads",
  "/leads/tradeindia": "TradeIndia Leads",
  "/leads/exportersindia": "ExportersIndia Leads",
  "/leads/assigned": "Assigned Leads",
  "/leads/reports": "Lead Reports",
  "/profile": "My Profile",
  "/login": "Sign In",
  "/signup": "Create Account",
  "/forgot-password": "Reset Password",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Find closest matching path, sorted by length descending
  const match = Object.entries(PAGE_TITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => pathname.startsWith(path));
  return match ? match[1] : "";
}

export function BrandingProvider({
  children,
  initialSettings,
}: {
  children: ReactNode;
  initialSettings: BrandingSettings | null;
}) {
  const [branding, setBrandingState] = useState<BrandingSettings>(initialSettings || DEFAULT_BRANDING);
  const [loading, setLoading] = useState(!initialSettings);
  const pathname = usePathname();

  const fetchBranding = useCallback(async () => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST205') {
        console.warn('[BrandingProvider] Database settings fetch failed:', error.message);
      }

      if (data) {
        setBrandingState(data);
      } else {
        setBrandingState(DEFAULT_BRANDING);
      }
    } catch (err) {
      console.warn('[BrandingProvider] Error loading branding settings, using fallbacks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = async () => {
    await fetchBranding();
  };

  const updateBranding = useCallback((updates: Partial<BrandingSettings>) => {
    setBrandingState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Fetch settings if not provided during SSR
  useEffect(() => {
    if (!initialSettings) {
      Promise.resolve().then(() => {
        fetchBranding();
      });
    }
  }, [initialSettings, fetchBranding]);

  // Sync browser favicon in real-time
  useEffect(() => {
    if (typeof window === "undefined") return;

    const faviconUrl = branding.favicon_url || "/icon";
    const links = document.querySelectorAll("link[rel*='icon']");
    
    if (links.length > 0) {
      links.forEach((link) => {
        (link as HTMLLinkElement).href = faviconUrl;
      });
    } else {
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = faviconUrl;
      document.head.appendChild(link);
    }
  }, [branding.favicon_url]);

  // Sync document title in real-time on pathname or branding changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pageTitle = getPageTitle(pathname);
    const baseName = branding.app_name || "CRM with AI";

    if (pageTitle) {
      document.title = `${pageTitle} — ${baseName}`;
    } else {
      document.title = baseName;
    }
  }, [pathname, branding.app_name]);

  return (
    <BrandingContext.Provider value={{ branding, loading, refresh, updateBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      branding: DEFAULT_BRANDING,
      loading: false,
      refresh: async () => {},
      updateBranding: () => {},
    };
  }
  return ctx;
}
