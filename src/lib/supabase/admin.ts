/**
 * Supabase admin client (service-role key).
 *
 * Bypasses Row Level Security — use only in server-side code that
 * must act on behalf of the system (webhooks, AI agent, cron jobs).
 *
 * Merged from Whatsapp-Agent-main/src/lib/supabase.ts singleton pattern
 * into the shared lib/supabase/ directory used by the full CRM.
 *
 * NEVER import this in client components or expose the service-role key.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

/**
 * Returns a lazily-initialised singleton admin Supabase client.
 * Calling this multiple times always returns the same instance.
 */
export function getAdminClient(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error(
        '[supabase/admin] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
      )
    }
    _admin = createClient(url, key, {
      auth: {
        // Service-role clients must not persist sessions
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return _admin
}

/**
 * Proxy shorthand — lets callers write `adminDb.from(...)` instead of
 * `getAdminClient().from(...)`.  Mirrors the pattern used in the
 * original Whatsapp-Agent-main for a smooth migration.
 */
export const adminDb = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getAdminClient() as any)[prop]
  },
})
