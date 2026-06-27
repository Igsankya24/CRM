import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "@/hooks/use-theme";
import { BrandingProvider } from "@/hooks/use-branding";
import { createClient } from "@/lib/supabase/server";
import { AuthProvider } from "@/hooks/use-auth";

export async function generateMetadata(): Promise<Metadata> {
  let appName = "CRM with AI";
  let faviconUrl = "/icon";

  try {
    const supabase = await createClient();
    const { data } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
    if (data) {
      if (data.app_name) appName = data.app_name;
      if (data.favicon_url) faviconUrl = data.favicon_url;
    }
  } catch (e) {
    // Graceful fallback
  }

  return {
    title: {
      default: appName,
      template: `%s — ${appName}`,
    },
    description: "Self-hostable CRM template for WhatsApp.",
    robots: {
      index: false,
      follow: false,
    },
    icons: {
      icon: [{ url: faviconUrl }],
    },
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#020617",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialBranding = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
    if (data) {
      initialBranding = data;
    }
  } catch (e) {
    // Graceful fallback
  }

  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head />
      <body className="min-h-full bg-background text-foreground font-sans">
        <BrandingProvider initialSettings={initialBranding}>
          <ThemeProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
            <Toaster
              theme="dark"
              position="top-right"
              toastOptions={{
                style: {
                  background: "rgb(30 41 59)",
                  border: "1px solid rgb(51 65 85)",
                  color: "white",
                },
              }}
            />
          </ThemeProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
