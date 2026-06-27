'use client'

/**
 * useB2BSync — Background auto-sync hook for B2B leads.
 *
 * Behavior:
 *   - Polls /api/integrations/cron every `intervalMs` (default 5 minutes)
 *     while the browser tab is visible (uses Page Visibility API).
 *   - On a new-lead response (syncedCount > 0) it calls onNewLeads() so the
 *     caller can refresh the UI and/or show a toast.
 *   - Pauses automatically when the tab is hidden (saves API quota).
 *   - Resets the timer on manual sync so we don't double-fire.
 *   - Tracks a lightweight sync status for UI indicators.
 *
 * Usage:
 *   const { status, lastSyncAt, triggerManualSync } = useB2BSync({
 *     onNewLeads: (count) => { fetchLeads(); toast.success(`${count} new leads!`) }
 *   })
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'rate_limited'

export interface SyncSummary {
  successCount: number
  failedCount: number
  skippedCount: number
  rateLimitedCount: number
  totalSynced: number
}

export interface UseB2BSyncOptions {
  /** Called whenever the cron returns totalSynced > 0 */
  onNewLeads?: (count: number, summary: SyncSummary) => void
  /** Called when any sync completes (success or error) */
  onSyncComplete?: (summary: SyncSummary | null, error?: string) => void
  /** Auto-poll interval in ms. Default: 5 minutes (300_000). Min: 60_000. */
  intervalMs?: number
  /** If false, disables the background auto-poll (manual only). Default: true */
  autoSync?: boolean
}

export interface UseB2BSyncReturn {
  /** Current sync status */
  status: SyncStatus
  /** ISO string of when the last successful sync completed */
  lastSyncAt: string | null
  /** Summary from the most recent cron execution */
  lastSummary: SyncSummary | null
  /** Error message if last sync failed */
  lastError: string | null
  /** Whether a sync is currently in-flight */
  isSyncing: boolean
  /** Trigger an immediate sync outside of the normal interval */
  triggerManualSync: () => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const MIN_INTERVAL_MS = 60_000        // 1 minute floor
const DEFAULT_INTERVAL_MS = 300_000  // 5 minutes

export function useB2BSync({
  onNewLeads,
  onSyncComplete,
  intervalMs = DEFAULT_INTERVAL_MS,
  autoSync = true,
}: UseB2BSyncOptions = {}): UseB2BSyncReturn {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [lastSummary, setLastSummary] = useState<SyncSummary | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const effectiveInterval = Math.max(intervalMs, MIN_INTERVAL_MS)

  // Core sync function — calls the cron API endpoint
  const runSync = useCallback(async (): Promise<void> => {
    if (isSyncing) return  // prevent overlap

    setIsSyncing(true)
    setStatus('syncing')

    try {
      const res = await fetch('/api/integrations/cron', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-store',
        },
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`)
        throw new Error(errText || `Cron HTTP ${res.status}`)
      }

      const data = await res.json()
      const summary: SyncSummary = data.summary ?? {
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        rateLimitedCount: 0,
        totalSynced: 0,
      }

      const now = new Date().toISOString()
      setLastSyncAt(now)
      setLastSummary(summary)
      setLastError(null)

      if (summary.rateLimitedCount > 0 && summary.successCount === 0) {
        setStatus('rate_limited')
      } else if (summary.failedCount > 0 && summary.successCount === 0) {
        setStatus('error')
        setLastError(`${summary.failedCount} platform(s) failed to sync`)
      } else {
        setStatus('success')
      }

      // Notify caller about new leads
      if (summary.totalSynced > 0 && onNewLeads) {
        onNewLeads(summary.totalSynced, summary)
      }

      onSyncComplete?.(summary)
    } catch (err) {
      const msg: string = err instanceof Error ? err.message : 'Sync failed'
      console.error('[use-b2b-sync] Sync error:', msg)
      setStatus('error')
      setLastError(msg)
      onSyncComplete?.(null, msg)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, onNewLeads, onSyncComplete])

  const scheduleNextTickRef = useRef<() => void>(() => {})

  // Schedule the next auto-poll tick
  const scheduleNextTick = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      // Only fire if the tab is visible
      if (!document.hidden) {
        void runSync().then(() => scheduleNextTickRef.current())
      } else {
        scheduleNextTickRef.current() // Reschedule without running; will fire when visible
      }
    }, effectiveInterval)
  }, [effectiveInterval, runSync])

  useEffect(() => {
    scheduleNextTickRef.current = scheduleNextTick
  }, [scheduleNextTick])

  // Page Visibility change handler — resume sync when tab becomes visible
  useEffect(() => {
    if (!autoSync) return

    const handleVisibilityChange = () => {
      if (!document.hidden && status !== 'syncing') {
        // Tab became visible — run sync immediately, then restart schedule
        void runSync().then(() => scheduleNextTickRef.current())
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [autoSync, status, runSync])

  // Bootstrap — run once on mount, then schedule recurring ticks
  useEffect(() => {
    if (!autoSync) return

    // Run first sync immediately on mount
    Promise.resolve().then(() => {
      void runSync().then(() => scheduleNextTickRef.current())
    })

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync]) // Only on mount / autoSync change

  // Manual trigger — resets the auto-poll timer so we don't double-fire
  const triggerManualSync = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    await runSync()
    scheduleNextTickRef.current()
  }, [runSync])

  return { status, lastSyncAt, lastSummary, lastError, isSyncing, triggerManualSync }
}
