"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useCallback, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { createClient } from "@/lib/supabase/client";
import {
  Bot,
  ClipboardList,
  FileText,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Radio,
  Receipt,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
  Flame,
  CheckCircle2,
  UserCheck,
  BarChart3,
  History,
  ChevronDown,
  ChevronRight,
  Building2,
  Globe,
  TrendingUp,
  Kanban,
} from "lucide-react";
import type { AccountRole } from "@/lib/auth/roles";
import { usePermissions } from "@/hooks/use-permissions";

interface SubNavItem {
  href: string;
  label: string;
  icon?: typeof LayoutDashboard;
  /** Both old-style and new-style module/action pairs are checked — any match shows the item. */
  permissions?: Array<{ module: string; action: string }>;
  badge?: string;
  badgeColor?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  beta?: boolean;
  /** Both old-style and new-style module/action pairs are checked — any match shows the item. */
  permissions?: Array<{ module: string; action: string }>;
  children?: SubNavItem[];
  group?: string;
}

// ============================================================
// Navigation Groups
//
// IMPORTANT: "Leads" is displayed as "Enquiries" and
// "Quotations" is displayed as "Quotation Register" per spec.
// Internal hrefs (/leads, /quotations) are preserved so existing
// routes, bookmarks, and API calls continue to work.
//
// Each item uses `permissions` (array of module/action pairs) so
// both legacy names AND new names work. The first match shows
// the item. Super Admin always sees everything.
// ============================================================
const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Main",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        permissions: [{ module: "dashboard", action: "view" }],
      },
      {
        href: "/inbox",
        label: "Inbox",
        icon: MessageSquare,
        permissions: [
          { module: "inbox", action: "view" },
          { module: "whatsapp", action: "view" },
        ],
      },
      {
        href: "/contacts",
        label: "Contacts",
        icon: Users,
        permissions: [
          { module: "contacts", action: "view" },
          { module: "customers", action: "view" },
        ],
      },
    ],
  },
  {
    // Group label stays "Enquiries" — renamed from "Leads"
    label: "Enquiries",
    items: [
      {
        href: "/leads",
        label: "Enquiries",      // ← Renamed from "Leads"
        icon: ClipboardList,
        permissions: [
          { module: "enquiries", action: "view" },
          { module: "leads", action: "view" },
        ],
        children: [
          {
            href: "/leads",
            label: "All Enquiries",  // ← Renamed
            icon: ClipboardList,
            permissions: [
              { module: "enquiries", action: "view" },
              { module: "leads", action: "view" },
            ],
          },
          {
            href: "/leads/indiamart",
            label: "IndiaMART",
            icon: Globe,
            permissions: [
              { module: "indiamart", action: "view" },
              { module: "indiamart_settings", action: "view" },
            ],
            badgeColor: "text-sky-400",
          },
          {
            href: "/leads/tradeindia",
            label: "TradeIndia",
            icon: Globe,
            permissions: [
              { module: "tradeindia", action: "view" },
              { module: "tradeindia_settings", action: "view" },
            ],
            badgeColor: "text-amber-400",
          },
          {
            href: "/leads/exportersindia",
            label: "ExportersIndia",
            icon: Globe,
            permissions: [
              { module: "exportersindia", action: "view" },
              { module: "exportersindia_settings", action: "view" },
            ],
            badgeColor: "text-teal-400",
          },
          {
            href: "/leads/assigned",
            label: "Assigned Enquiries",  // ← Renamed
            icon: UserCheck,
            permissions: [
              { module: "enquiries", action: "view" },
              { module: "leads", action: "view" },
            ],
          },
          {
            href: "/leads/reports",
            label: "Enquiry Reports",  // ← Renamed
            icon: BarChart3,
            permissions: [{ module: "reports", action: "view" }],
          },
        ],
      },
      {
        href: "/crm",
        label: "CRM Pipeline",
        icon: Kanban,
        permissions: [
          { module: "crm_pipeline", action: "view" },
          { module: "crm", action: "view" },
        ],
      },
      {
        href: "/pipelines",
        label: "Pipelines",
        icon: GitBranch,
        permissions: [
          { module: "crm_pipeline", action: "view" },
          { module: "sales", action: "view" },
        ],
      },
    ],
  },
  {
    // Group label stays "Sales" internally but shows Quotation Register
    label: "Sales",
    items: [
      {
        href: "/quotations",
        label: "Quotation Register",
        icon: FileText,
        permissions: [
          { module: "quotation", action: "view" },
        ],
      },
      {
        href: "/proformas",
        label: "Proforma Invoice",
        icon: Receipt,
        permissions: [
          { module: "proforma", action: "view" },
        ],
      },
      {
        href: "/sales-registers",
        label: "Sales Register",
        icon: ClipboardList,
        permissions: [
          { module: "sales", action: "view" },
        ],
      },
    ],
  },
  {
    label: "Automation",
    items: [
      {
        href: "/broadcasts",
        label: "Broadcasts",
        icon: Radio,
        permissions: [
          { module: "broadcasts", action: "view" },
          { module: "whatsapp", action: "manage" },
        ],
      },
      {
        href: "/automations",
        label: "Automations",
        icon: Zap,
        permissions: [
          { module: "automations", action: "view" },
          { module: "whatsapp", action: "manage" },
        ],
      },
      {
        href: "/flows",
        label: "Flows",
        icon: Workflow,
        beta: true,
        permissions: [
          { module: "automations", action: "view" },
          { module: "whatsapp", action: "manage" },
        ],
      },
    ],
  },
  {
    // Settings — only Super Admin sees this group
    label: "Configuration",
    items: [
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        permissions: [{ module: "settings", action: "view" }],
        children: [
          { href: "/settings?tab=general", label: "General" },
          {
            href: "/settings?tab=users",
            label: "Users",
            permissions: [
              { module: "user_management", action: "view" },
              { module: "settings", action: "view" },
            ],
          },
          {
            href: "/settings?tab=roles",
            label: "Roles & Permissions",
            permissions: [
              { module: "role_management", action: "view" },
              { module: "settings", action: "view" },
            ],
          },
          {
            href: "/settings?tab=notifications",
            label: "Notifications",
          },
          {
            href: "/settings?tab=whatsapp",
            label: "WhatsApp",
            permissions: [{ module: "whatsapp_settings", action: "view" }],
          },
          {
            href: "/settings?tab=integrations",
            label: "Integrations",
            permissions: [{ module: "integrations", action: "view" }],
          },
          {
            href: "/settings?tab=ai",
            label: "AI",
            permissions: [{ module: "ai_settings", action: "view" }],
          },
          {
            href: "/settings?tab=b2b",
            label: "B2B Marketplace",
            permissions: [
              { module: "indiamart_settings", action: "view" },
              { module: "settings", action: "view" },
            ],
          },
          {
            href: "/settings?tab=company",
            label: "Company Profile",
            icon: Building2,
            permissions: [{ module: "company_settings", action: "view" }],
          },
          {
            href: "/settings?tab=products",
            label: "Products",
            permissions: [{ module: "settings", action: "view" }],
          },
          {
            href: "/settings?tab=faq",
            label: "FAQ",
            permissions: [{ module: "settings", action: "view" }],
          },
          { href: "/settings?tab=appearance", label: "Appearance" },
          { href: "/settings?tab=security", label: "Security" },
          {
            href: "/settings?tab=audit-logs",
            label: "Audit Logs",
            permissions: [{ module: "audit_logs", action: "view" }],
          },
        ],
      },
    ],
  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { accountId, accountRole, profile, signOut } = useAuth();
  const { branding } = useBranding();
  const { hasPermission, hasAnyPermission, isSuperAdmin } = usePermissions();
  const totalUnread = useTotalUnread();
  const supabase = createClient();
  const [tagline, setTagline] = useState<string>("Business CRM");

  // Track which parent items are expanded
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  /**
   * Determines whether a nav item or sub-item is visible.
   * An item is visible if:
   *  - It has no `permissions` array (always visible), OR
   *  - The user has ANY of the listed module/action pairs, OR
   *  - The user is Super Admin (bypass all)
   */
  const isItemVisible = useCallback(
    (permissions?: Array<{ module: string; action: string }>): boolean => {
      if (isSuperAdmin) return true;
      if (!permissions || permissions.length === 0) return true;
      return hasAnyPermission(permissions);
    },
    [isSuperAdmin, hasAnyPermission]
  );

  // Dynamically filter navGroups — purely permission-based, no hardcoded role logic
  const filteredNavGroups = useMemo(() => {
    return navGroups
      .map((group) => {
        const filteredItems = group.items
          .filter((item) => isItemVisible(item.permissions))
          .map((item) => {
            if (!item.children) return item;
            // Filter children too
            const filteredChildren = item.children.filter((child) =>
              isItemVisible(child.permissions)
            );
            return { ...item, children: filteredChildren };
          });

        if (filteredItems.length === 0) return null;
        return { ...group, items: filteredItems };
      })
      .filter((group): group is { label: string; items: NavItem[] } => group !== null);
  }, [isItemVisible]);

  // Fetch company tagline
  useEffect(() => {
    if (!accountId) return;
    const fetchCompanyTagline = async () => {
      try {
        const { data } = await supabase
          .from("company_settings")
          .select("tagline")
          .eq("account_id", accountId)
          .maybeSingle();
        if (data?.tagline) {
          setTagline(data.tagline);
        } else {
          setTagline("Business CRM");
        }
      } catch (err) {
        console.error("Failed to fetch company tagline:", err);
      }
    };
    fetchCompanyTagline();
  }, [accountId, supabase]);

  useEffect(() => {
    onClose?.();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Auto-expand groups that contain the active route
  useEffect(() => {
    const newExpanded = new Set<string>();
    for (const group of navGroups) {
      for (const item of group.items) {
        if (item.children) {
          const isActiveParent =
            item.href !== "/dashboard" && pathname.startsWith(item.href);
          if (isActiveParent) {
            newExpanded.add(item.href);
          }
        }
      }
    }
    setExpandedItems(newExpanded);
  }, [pathname]);

  const toggleExpanded = useCallback((href: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  }, []);

  const isChildActive = (child: SubNavItem) => {
    if (child.href.includes("?")) {
      const [basePath, query] = child.href.split("?");
      return (
        pathname === basePath &&
        searchParams.get("tab") === new URLSearchParams(query).get("tab")
      );
    }
    return pathname === child.href;
  };

  const isParentActive = (item: { href: string; children?: SubNavItem[] }) => {
    if (item.href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(item.href);
  };

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  return (
    <>
      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full flex-col",
          "w-[240px] border-r border-sidebar-border bg-sidebar",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-0 lg:translate-x-0 lg:transition-none"
        )}
        aria-label="Primary navigation"
      >
        {/* Logo / Brand */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground overflow-hidden shadow-sm">
              {branding.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt={branding.app_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold uppercase text-primary-foreground">
                  {(branding.app_name || "CRM").charAt(0)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-sidebar-foreground truncate leading-tight">
                {branding.app_name || "CRM with AI"}
              </span>
              <span className="block text-[10px] text-sidebar-foreground/40 font-medium leading-tight">
                {tagline}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent">
          <div className="space-y-4">
            {filteredNavGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/30 select-none">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = isParentActive(item);
                    const hasChildren =
                      item.children && item.children.length > 0;
                    const isExpanded = expandedItems.has(item.href);
                    const showUnreadDot =
                      item.href === "/inbox" &&
                      totalUnread > 0 &&
                      !isActive;

                    return (
                      <li key={item.href}>
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(item.href)}
                            className={cn(
                              "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <item.icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isActive
                                  ? "text-primary"
                                  : "text-sidebar-foreground/50"
                              )}
                            />
                            <span className="flex-1 text-left truncate">
                              {item.label}
                            </span>
                            {item.beta && (
                              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400">
                                Beta
                              </span>
                            )}
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 shrink-0 text-sidebar-foreground/30 transition-transform duration-200",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </button>
                        ) : (
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <item.icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isActive
                                  ? "text-primary"
                                  : "text-sidebar-foreground/50"
                              )}
                            />
                            <span className="flex-1 truncate">
                              {item.label}
                            </span>
                            {item.beta && (
                              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400">
                                Beta
                              </span>
                            )}
                            {showUnreadDot && (
                              <span
                                aria-label={`${totalUnread} unread`}
                                className="relative flex h-2 w-2 shrink-0"
                              >
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                              </span>
                            )}
                          </Link>
                        )}

                        {/* Children */}
                        {hasChildren && isExpanded && (
                          <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                            {(item.children as SubNavItem[] | undefined)?.map((child: SubNavItem) => {
                              // Permission check for child items
                              if (!isItemVisible(child.permissions)) return null;
                              const childActive = isChildActive(child);

                              return (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                                      childActive
                                        ? "bg-primary/10 text-primary font-semibold"
                                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    )}
                                  >
                                    {child.icon && (
                                      <child.icon
                                        className={cn(
                                          "h-3 w-3 shrink-0",
                                          child.badgeColor
                                            ? child.badgeColor
                                            : childActive
                                            ? "text-primary"
                                            : "text-sidebar-foreground/40"
                                        )}
                                      />
                                    )}
                                    <span className="truncate">
                                      {child.label}
                                    </span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
}
