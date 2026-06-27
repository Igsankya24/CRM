import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Checks if a sync job is already running for the given platform and account.
 * Prevents overlapping cron/manual execution. Returns true if lock was successfully acquired.
 */
export async function acquireSyncLock(
  supabase: SupabaseClient,
  accountId: string,
  platform: string
): Promise<boolean> {
  try {
    const { data: syncState, error } = await supabase
      .from('integration_sync_state')
      .select('id, sync_status, updated_at')
      .eq('account_id', accountId)
      .eq('platform', platform)
      .maybeSingle()

    if (error) {
      console.error(`[sync-lock] Error fetching sync state for ${platform}:`, error)
      return false
    }

    const now = Date.now()
    if (syncState && syncState.sync_status === 'RUNNING') {
      const updatedAt = new Date(syncState.updated_at).getTime()
      const elapsedMinutes = (now - updatedAt) / (60 * 1000)
      // Lock is valid if it was updated less than 10 minutes ago
      if (elapsedMinutes < 10) {
        console.warn(`[sync-lock] Sync for ${platform} is already RUNNING (started ${Math.round(elapsedMinutes)}m ago). Skipping execution.`)
        return false
      }
      console.warn(`[sync-lock] Sync for ${platform} was stuck in RUNNING (started ${Math.round(elapsedMinutes)}m ago). Breaking lock.`)
    }

    // Upsert lock state to RUNNING
    const { error: upsertError } = await supabase
      .from('integration_sync_state')
      .upsert(
        {
          account_id: accountId,
          platform,
          sync_status: 'RUNNING',
          error_message: null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'account_id,platform' }
      )

    if (upsertError) {
      console.error(`[sync-lock] Failed to acquire lock for ${platform}:`, upsertError)
      return false
    }

    return true
  } catch (err) {
    console.error(`[sync-lock] Fatal error acquiring lock for ${platform}:`, err)
    return false
  }
}

/**
 * Releases the sync lock by updating status to COMPLETED or FAILED.
 */
export async function releaseSyncLock(
  supabase: SupabaseClient,
  accountId: string,
  platform: string,
  status: 'COMPLETED' | 'FAILED',
  errorMessage?: string | null
): Promise<void> {
  try {
    const { error } = await supabase
      .from('integration_sync_state')
      .upsert(
        {
          account_id: accountId,
          platform,
          sync_status: status,
          error_message: errorMessage || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'account_id,platform' }
      )

    if (error) {
      console.error(`[sync-lock] Failed to release lock for ${platform}:`, error)
    }
  } catch (err) {
    console.error(`[sync-lock] Fatal error releasing lock for ${platform}:`, err)
  }
}
