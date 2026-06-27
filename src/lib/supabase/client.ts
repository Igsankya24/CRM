import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton instance — one client shared across the whole browser session.
// Creating multiple clients causes auth-lock contention ("Lock was released
// because another request stole it") and intermittent fetch failures.
let browserClient: SupabaseClient | undefined

const customStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    const rememberMe = window.localStorage.getItem("crm_remember_me") === "true";
    if (rememberMe) {
      return window.localStorage.getItem(key);
    } else {
      return window.sessionStorage.getItem(key);
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    const rememberMe = window.localStorage.getItem("crm_remember_me") === "true";
    if (rememberMe) {
      window.localStorage.setItem(key, value);
    } else {
      window.sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
}

export function createClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // During build-time static generation on the server, allow missing environment variables
    // by returning a dummy client to prevent build failures.
    if (typeof window === 'undefined') {
      return createBrowserClient(
        'https://placeholder.supabase.co',
        'placeholder-anon-key'
      )
    }

    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.'
    )
  }
  console.log("Supabase Client initialized with URL:", url);

  browserClient = createBrowserClient(url, key, {
    auth: {
      storage: typeof window !== 'undefined' ? customStorage : undefined,
      persistSession: true,
      detectSessionInUrl: true
    }
  })

  return browserClient
}
