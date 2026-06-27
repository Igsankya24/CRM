"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { cn } from "@/lib/utils";
import {
  LogOut,
  Menu,
  User,
  Search,
  Bell,
  X,
  Loader2,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { B2BLead } from "@/types";

const pageTitles: Record<string, string> = {
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
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.entries(pageTitles)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => pathname.startsWith(path));
  return match ? match[1] : "Dashboard";
}

const PLATFORM_COLORS: Record<string, string> = {
  INDIAMART: "text-sky-400",
  TRADEINDIA: "text-amber-400",
  EXPORTERSINDIA: "text-teal-400",
};

interface GlobalSearchResult {
  id: string;
  buyer_name: string | null;
  company_name: string | null;
  mobile: string | null;
  email: string | null;
  product_name: string | null;
  platform: string;
  status: string;
}

interface HeaderProps {
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, accountId, accountRole, signOut } = useAuth();
  const { branding } = useBranding();
  const { isSuperAdmin } = usePermissions();
  const supabase = createClient();
  const title = getPageTitle(pathname);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Click outside closes search
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    };
    if (searchOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen]);

  // Debounced search
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || !accountId) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);
      try {
        const q = query.toLowerCase().trim();
        const { data } = await supabase
          .from("b2b_leads")
          .select(
            "id, buyer_name, company_name, mobile, email, product_name, platform, status"
          )
          .eq("account_id", accountId)
          .is("deleted_at", null)
          .or(
            [
              `buyer_name.ilike.%${q}%`,
              `company_name.ilike.%${q}%`,
              `mobile.ilike.%${q}%`,
              `email.ilike.%${q}%`,
              `product_name.ilike.%${q}%`,
              `external_lead_id.ilike.%${q}%`,
            ].join(",")
          )
          .order("inquiry_at", { ascending: false })
          .limit(8);

        setSearchResults((data as GlobalSearchResult[]) ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [accountId, supabase]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (!value.trim()) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);
      debounceTimer.current = setTimeout(() => performSearch(value), 300);
    },
    [performSearch]
  );

  const handleResultClick = (result: GlobalSearchResult) => {
    router.push(`/leads/${result.id}`);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-slate-500/20 text-slate-400",
    assigned: "bg-blue-500/20 text-blue-400",
    contacted: "bg-purple-500/20 text-purple-400",
    converted: "bg-emerald-500/20 text-emerald-400",
    rejected: "bg-rose-500/20 text-rose-400",
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:px-6 relative z-20">
      <div className="flex min-w-0 items-center gap-2 flex-1">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-muted hover:text-foreground lg:hidden shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile branding */}
        <div className="flex items-center gap-2 lg:hidden shrink-0">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground overflow-hidden">
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt={branding.app_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-bold uppercase text-primary-foreground">
                {(branding.app_name || "CRM").charAt(0)}
              </span>
            )}
          </div>
        </div>

        {/* Page title — desktop */}
        <h1 className="hidden lg:block truncate text-base font-semibold text-foreground">
          {title}
        </h1>

        {/* Global Smart Search */}
        <div
          ref={searchRef}
          className="relative ml-2 flex-1 max-w-md"
        >
          <button
            type="button"
            onClick={() => {
              setSearchOpen(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className={cn(
              "flex w-full items-center gap-2 h-8 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-all hover:border-muted-foreground/30 hover:bg-muted",
              searchOpen && "hidden"
            )}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left text-xs">Search leads…</span>
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {searchOpen && (
            <div className="absolute left-0 right-0 top-0">
              <div className="flex items-center gap-2 h-8 rounded-lg border border-primary/50 bg-background px-3 shadow-lg ring-1 ring-primary/10">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by name, mobile, email, product…"
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                  autoFocus
                />
                {searchLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5 shrink-0" />
                  </button>
                )}
              </div>

              {/* Results dropdown */}
              {searchQuery.trim() && (
                <div className="absolute left-0 right-0 top-10 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                  {searchResults.length === 0 && !searchLoading ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No leads found for &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    <ul>
                      {searchResults.map((result) => (
                        <li key={result.id}>
                          <button
                            type="button"
                            onClick={() => handleResultClick(result)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60 transition-colors group"
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                              {(result.buyer_name || "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold text-foreground truncate">
                                  {result.buyer_name || result.mobile || "Unknown"}
                                </p>
                                <span
                                  className={cn(
                                    "shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                                    PLATFORM_COLORS[result.platform]
                                      ? `bg-current/10 ${PLATFORM_COLORS[result.platform]}`
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {result.platform}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {[result.company_name, result.mobile, result.product_name]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize",
                                STATUS_COLORS[result.status] ?? "bg-muted text-muted-foreground"
                              )}
                            >
                              {result.status}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="border-t border-border px-4 py-2 bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">
                      Press <kbd className="font-mono">↵</kbd> to open · <kbd className="font-mono">ESC</kbd> to close
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
            aria-label="Open account menu"
          >
            <Avatar className="size-7">
              {profile?.avatar_url ? (
                <AvatarImage
                  src={profile.avatar_url}
                  alt={profile.full_name ?? "Avatar"}
                />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="hidden flex-col text-left sm:flex">
              <span className="text-xs font-semibold text-foreground leading-tight">
                {profile?.full_name ?? "User"}
              </span>
              <span className="text-[10px] text-muted-foreground capitalize leading-none mt-0.5">
                {isSuperAdmin ? "Super Admin" : (accountRole ?? "user")}
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="min-w-56 bg-card border-border text-foreground shadow-lg"
          >
            <div className="px-3 py-2 border-b border-border">
              <p className="truncate text-sm font-semibold text-foreground">
                {profile?.full_name ?? "User"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {profile?.email ?? ""}
              </p>
            </div>
            <DropdownMenuItem
              render={
                <Link
                  href="/profile"
                  className="focus:bg-muted focus:text-foreground"
                />
              }
            >
              <User className="size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link
                  href="/settings"
                  className="focus:bg-muted focus:text-foreground"
                />
              }
            >
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-rose-500 focus:bg-rose-500/10 focus:text-rose-400"
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
