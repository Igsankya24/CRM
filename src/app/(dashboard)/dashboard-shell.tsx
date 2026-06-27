"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { usePermissions } from "@/hooks/use-permissions";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

// Route → required permission(s). The first matching route wins.
// Each entry supports multiple permission pairs (any match = authorized).
// Supports both new-style ("enquiries", "view") and legacy ("leads", "view")
// so existing functionality is never broken.
const ROUTE_PERMISSIONS: Array<{
  path: string;
  permissions: Array<{ module: string; action: string }>;
}> = [
  // Settings — Super Admin only
  {
    path: "/settings",
    permissions: [{ module: "settings", action: "view" }],
  },
  // Enquiries / Leads
  {
    path: "/leads/indiamart",
    permissions: [
      { module: "indiamart", action: "view" },
      { module: "enquiries", action: "view" },
    ],
  },
  {
    path: "/leads/tradeindia",
    permissions: [
      { module: "tradeindia", action: "view" },
      { module: "enquiries", action: "view" },
    ],
  },
  {
    path: "/leads/exportersindia",
    permissions: [
      { module: "exportersindia", action: "view" },
      { module: "enquiries", action: "view" },
    ],
  },
  {
    path: "/leads",
    permissions: [
      { module: "enquiries", action: "view" },
      { module: "leads", action: "view" },
    ],
  },
  // Dashboard
  {
    path: "/dashboard",
    permissions: [{ module: "dashboard", action: "view" }],
  },
  // Inbox
  {
    path: "/inbox",
    permissions: [
      { module: "inbox", action: "view" },
      { module: "whatsapp", action: "view" },
    ],
  },
  // Contacts
  {
    path: "/contacts",
    permissions: [
      { module: "contacts", action: "view" },
      { module: "customers", action: "view" },
    ],
  },
  // CRM Pipeline
  {
    path: "/crm",
    permissions: [
      { module: "crm_pipeline", action: "view" },
      { module: "crm", action: "view" },
    ],
  },
  // Pipelines
  {
    path: "/pipelines",
    permissions: [
      { module: "crm_pipeline", action: "view" },
      { module: "sales", action: "view" },
    ],
  },
  // Quotation Register / Quotations
  {
    path: "/quotations",
    permissions: [
      { module: "quotation", action: "view" },
    ],
  },
  // Proforma Invoice
  {
    path: "/proformas",
    permissions: [
      { module: "proforma", action: "view" },
    ],
  },
  // Sales Register
  {
    path: "/sales-registers",
    permissions: [
      { module: "sales", action: "view" },
    ],
  },
  // Broadcasts
  {
    path: "/broadcasts",
    permissions: [
      { module: "broadcasts", action: "view" },
      { module: "whatsapp", action: "manage" },
    ],
  },
  // Automations
  {
    path: "/automations",
    permissions: [
      { module: "automations", action: "view" },
      { module: "whatsapp", action: "manage" },
    ],
  },
  // Flows
  {
    path: "/flows",
    permissions: [
      { module: "automations", action: "view" },
      { module: "whatsapp", action: "manage" },
    ],
  },
];

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { hasPermission, hasAnyPermission, loading: permissionsLoading, isSuperAdmin } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();

  // Sidebar drawer state — only used on mobile.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    // If on dashboard but no dashboard permission, redirect to first available module
    if (!loading && user && !permissionsLoading && pathname === "/dashboard") {
      if (!hasPermission("dashboard", "view")) {
        if (hasAnyPermission([{ module: "inbox", action: "view" }, { module: "whatsapp", action: "view" }])) {
          router.push("/inbox");
        } else if (hasAnyPermission([{ module: "enquiries", action: "view" }, { module: "leads", action: "view" }])) {
          router.push("/leads");
        } else if (hasAnyPermission([{ module: "quotation", action: "view" }])) {
          router.push("/quotations");
        } else if (hasAnyPermission([{ module: "proforma", action: "view" }])) {
          router.push("/proformas");
        } else if (hasAnyPermission([{ module: "sales", action: "view" }])) {
          router.push("/sales-registers");
        } else {
          router.push("/profile");
        }
      }
    }
  }, [user, loading, permissionsLoading, pathname, hasPermission, hasAnyPermission, router]);

  // Find the permission requirement for the current path
  const routePermission = ROUTE_PERMISSIONS.find((rp) =>
    pathname.startsWith(rp.path)
  );

  // Super Admin always authorized. Otherwise check permissions.
  // If no route permission entry exists, the route is publicly accessible (profile, etc.)
  const isAuthorized =
    !user ||
    isSuperAdmin ||
    !routePermission ||
    hasAnyPermission(routePermission.permissions);

  if (loading || (user && permissionsLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-slate-400">Loading permissions...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const renderContent = () => {
    if (!isAuthorized) {
      return (
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
          <div className="w-full max-w-md border border-slate-800 bg-slate-900/40 backdrop-blur p-6 rounded-2xl text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Access Denied</h2>
            <p className="text-sm text-slate-400">
              You do not have the required permissions to view this module. Please contact your system administrator.
            </p>
            <div className="pt-2">
              <Button
                onClick={() => {
                  if (hasPermission("dashboard", "view")) {
                    router.push("/dashboard");
                  } else if (hasAnyPermission([{ module: "inbox", action: "view" }, { module: "whatsapp", action: "view" }])) {
                    router.push("/inbox");
                  } else if (hasAnyPermission([{ module: "enquiries", action: "view" }, { module: "leads", action: "view" }])) {
                    router.push("/leads");
                  } else {
                    router.push("/profile");
                  }
                }}
                className="w-full bg-primary text-white hover:bg-primary/90"
              >
                Go Back
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return children;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        {/* Thinner horizontal padding on mobile so cards have room to breathe. */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{renderContent()}</main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AuthProvider>
  );
}
