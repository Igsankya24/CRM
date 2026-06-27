"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import {
  canEditSettings as canEditSettingsFor,
  canManageMembers as canManageMembersFor,
  canSendMessages as canSendMessagesFor,
  isAccountRole,
  type AccountRole,
} from "@/lib/auth/roles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
  beta_features: string[];
  account_id: string | null;
  account_role: AccountRole | null;
  mobile: string | null;
  department: string | null;
  designation: string | null;
  is_active: boolean;
}

interface AccountSummary {
  id: string;
  name: string;
  default_currency: string;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  accountId: string | null;
  accountRole: AccountRole | null;
  account: AccountSummary | null;
  defaultCurrency: string;
  isOwner: boolean;
  isAdmin: boolean;
  isAgent: boolean;
  isViewer: boolean;
  canManageMembers: boolean;
  canEditSettings: boolean;
  canSendMessages: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const profileRef = useRef<Profile | null>(null);

  const setProfile = useCallback((p: Profile | null) => {
    profileRef.current = p;
    setProfileState(p);
  }, []);

  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient();
    if (!profileRef.current) {
      setProfileLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, avatar_url, role, beta_features, account_id, account_role, mobile, department, designation, is_active, account:accounts!inner(id, name, default_currency)",
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[AuthProvider] fetchProfile error:", error.message);
        return;
      }

      if (data) {
        const accountRaw = Array.isArray(data.account)
          ? data.account[0] ?? null
          : (data.account as {
              id: string;
              name: string;
              default_currency: string | null;
            } | null);
        const accountRow: AccountSummary | null = accountRaw
          ? {
              id: accountRaw.id,
              name: accountRaw.name,
              default_currency: accountRaw.default_currency ?? DEFAULT_CURRENCY,
            }
          : null;

        const accountRole = isAccountRole(data.account_role)
          ? data.account_role
          : null;

        setProfile({
          id: data.id,
          full_name: data.full_name,
          email: data.email,
          avatar_url: data.avatar_url,
          role: data.role,
          beta_features: data.beta_features ?? [],
          account_id: data.account_id ?? null,
          account_role: accountRole,
          mobile: data.mobile ?? null,
          department: data.department ?? null,
          designation: data.designation ?? null,
          is_active: data.is_active ?? true,
        });
        setAccount(accountRow);
      }
    } catch (err) {
      console.error("[AuthProvider] fetchProfile threw:", err);
    } finally {
      setProfileLoading(false);
    }
  }, [setProfile]);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn("[AuthProvider] getSession() timed out after 3s");
        setLoading(false);
        setProfileLoading(false);
      }
    }, 3000);

    const init = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) console.error("[AuthProvider] getSession error:", error.message);

        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // Don't block session loading on profile fetch — chrome
          // (header, sidebar) can render from the user object alone,
          // profile enriches async. Callers that need to branch on
          // profile data gate on `profileLoading` instead.
          fetchProfile(currentUser.id);
        } else {
          // No user → no profile to load. Flip profileLoading off so
          // pages that gate on it don't wait forever on the logged-out
          // path (the route guard or redirect should fire instead).
          setProfileLoading(false);
        }
      } catch (err) {
        console.error("[AuthProvider] init threw:", err);
      } finally {
        if (mounted) setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setAccount(null);
        setProfileLoading(false);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const clearSessionData = useCallback(() => {
    // Clear all cookies
    try {
      document.cookie.split(";").forEach((cookie) => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax;Secure`;
      });
    } catch (e) {
      console.warn("[clearSessionData] Failed to clear cookies:", e);
    }

    // Clear LocalStorage
    try {
      localStorage.clear();
    } catch (e) {
      console.warn("[clearSessionData] Failed to clear localStorage:", e);
    }

    // Clear SessionStorage
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn("[clearSessionData] Failed to clear sessionStorage:", e);
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[AuthProvider] signOut error:", e);
    }
    setUser(null);
    setProfile(null);
    setAccount(null);
    clearSessionData();
    window.location.href = "/login";
  }, [setProfile, clearSessionData]);

  // Inactivity tracking and session auto-logout (60 minutes = 3,600,000 ms, warning at 55 minutes = 3,300,000 ms)
  const [showWarning, setShowWarning] = useState(false);
  const TIMEOUT_MS = 60 * 60 * 1000;
  const WARNING_MS = 55 * 60 * 1000;

  const resetInactivityTimer = useCallback(() => {
    const now = Date.now();
    localStorage.setItem("crm_last_activity", now.toString());
    setShowWarning(false);
  }, []);

  useEffect(() => {
    if (!user) {
      setShowWarning(false);
      return;
    }

    // Set initial activity timestamp
    localStorage.setItem("crm_last_activity", Date.now().toString());

    const handleActivity = () => {
      resetInactivityTimer();
    };

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    const interval = setInterval(() => {
      const lastActivityStr = localStorage.getItem("crm_last_activity");
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : Date.now();
      const timeSinceLastActivity = Date.now() - lastActivity;

      if (timeSinceLastActivity >= TIMEOUT_MS) {
        console.log("[AuthProvider] Session expired due to inactivity.");
        signOut();
      } else if (timeSinceLastActivity >= WARNING_MS) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    }, 5000); // Check every 5 seconds

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(interval);
    };
  }, [user, resetInactivityTimer, signOut]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // Derive the role booleans once per profile change rather than on
  // every consumer render. Cheap regardless, but the memo also gives
  // each derived value a stable identity for React.memo / useEffect
  // dependencies downstream.
  const derived = useMemo(() => {
    const role = profile?.account_role ?? null;
    return {
      accountRole: role,
      accountId: profile?.account_id ?? null,
      isOwner: role === "owner",
      isAdmin: role === "admin",
      isAgent: role === "agent",
      isViewer: role === "viewer",
      canManageMembers: role ? canManageMembersFor(role) : false,
      canEditSettings: role ? canEditSettingsFor(role) : false,
      canSendMessages: role ? canSendMessagesFor(role) : false,
    };
  }, [profile?.account_role, profile?.account_id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        signOut,
        refreshProfile,
        account,
        defaultCurrency: account?.default_currency ?? DEFAULT_CURRENCY,
        ...derived,
      }}
    >
      {children}
      <Dialog open={showWarning} onOpenChange={(open) => { if (!open) resetInactivityTimer(); }}>
        <DialogContent showCloseButton={false} className="border-slate-800 bg-slate-900 text-white sm:max-w-md">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-bold text-white">Session Expiring</DialogTitle>
            <DialogDescription className="text-slate-400">
              Your session will expire in 5 minutes due to inactivity.
              Click Continue to remain signed in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={signOut} className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-white">
              Logout Now
            </Button>
            <Button onClick={resetInactivityTimer} className="bg-primary text-white hover:bg-primary/90">
              Continue Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  );
}

/**
 * useAuth — read the shared auth state from context.
 * Must be used inside an <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider (shouldn't
    // happen in normal flow, but don't crash the page). Account state
    // collapses to least-privileged null — every `canX` boolean is
    // false so UI gates fail closed.
    return {
      user: null,
      profile: null,
      loading: false,
      profileLoading: false,
      signOut: async () => {
        window.location.href = "/login";
      },
      refreshProfile: async () => {},
      account: null,
      defaultCurrency: DEFAULT_CURRENCY,
      accountId: null,
      accountRole: null,
      isOwner: false,
      isAdmin: false,
      isAgent: false,
      isViewer: false,
      canManageMembers: false,
      canEditSettings: false,
      canSendMessages: false,
    };
  }
  return ctx;
}
