// Auto-sync cron for all B2B platforms (IndiaMART, TradeIndia, ExportersIndia).
// Called by Vercel Cron every 5 minutes via vercel.json:
//   { "path": "/api/integrations/cron", "schedule": "*/5 * * * *" }
//
// Can also be triggered manually:
//   GET /api/integrations/cron
//   GET /api/integrations/cron?secret=<AUTOMATION_CRON_SECRET>
//   or with header: x-cron-secret: <AUTOMATION_CRON_SECRET>
//   or with header: Authorization: Bearer <AUTOMATION_CRON_SECRET>
//
// Sync interval logic:
//   - Respects integration.sync_interval field ('5m', '15m', '30m', '1h')
//   - Skips integrations not yet due for sync
//   - Rate limited (429) integrations are skipped and retried next tick
//   - Failed integrations do not block others

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { IndiaMartService } from '@/integrations/indiamart/services/indiamart'
import { TradeIndiaService } from '@/integrations/tradeindia/services/tradeindia'
import { ExportersIndiaService } from '@/integrations/exportersindia/services/exportersindia'
import type { B2BIntegration } from '@/types'

// Force dynamic route — no edge caching, no static generation
export const dynamic = 'force-dynamic'

// Map sync interval labels to milliseconds (with a 30-second safety buffer)
const INTERVAL_MS_MAP: Record<string, number> = {
  '5m':  5  * 60 * 1000 - 30_000,   // 4m 30s
  '15m': 15 * 60 * 1000 - 30_000,   // 14m 30s
  '30m': 30 * 60 * 1000 - 30_000,   // 29m 30s
  '1h':  60 * 60 * 1000 - 30_000,   // 59m 30s
}

// ─── Security helper ─────────────────────────────────────────────────────────
function isAuthorized(request: Request): boolean {
  const secret = process.env.AUTOMATION_CRON_SECRET
  if (!secret) return true // No secret configured → open (dev mode)

  // Accept via query param, custom header, or Bearer auth header
  const url = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const headerSecret = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('authorization')
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  return (
    querySecret === secret ||
    headerSecret === secret ||
    bearerSecret === secret
  )
}

function isDueForHourlySync(lastSuccessfulSyncStr: string | null): boolean {
  if (!lastSuccessfulSyncStr) return true
  const lastSync = new Date(lastSuccessfulSyncStr)
  const now = new Date()

  // Different hour of the day or different day/month/year
  const isDifferentHour =
    lastSync.getFullYear() !== now.getFullYear() ||
    lastSync.getMonth() !== now.getMonth() ||
    lastSync.getDate() !== now.getDate() ||
    lastSync.getHours() !== now.getHours()

  return isDifferentHour
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  const now = Date.now()
  const startedAtStr = new Date(now).toISOString()

  const url = new URL(request.url)
  const isManual = url.searchParams.get('manual') === 'true'

  console.log(`[b2b-cron] Cron tick at ${startedAtStr} (isManual: ${isManual})`)

  try {
    // 1. Load all enabled B2B integrations
    const { data: integrations, error: fetchError } = await admin
      .from('b2b_integrations')
      .select('*')
      .eq('enabled', true)

    if (fetchError) {
      console.error('[b2b-cron] Failed to fetch integrations:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!integrations || integrations.length === 0) {
      console.log('[b2b-cron] No enabled integrations found. Exiting.')
      return NextResponse.json({ processed: 0, skipped: 0, failed: 0, message: 'No enabled integrations' })
    }

    console.log(`[b2b-cron] Found ${integrations.length} enabled integration(s)`)

    type SyncResult = {
      id: string
      platform: string
      account_id: string
      status: 'success' | 'failed' | 'skipped' | 'rate_limited'
      syncedCount?: number
      duplicateCount?: number
      error?: string
    }

    const results: SyncResult[] = []

    // 2. Process each integration sequentially to avoid hammering external APIs
    for (const integration of integrations as B2BIntegration[]) {
      const logPrefix = `[b2b-cron][${integration.platform}][${integration.account_id.slice(0, 8)}]`

      try {
        // Get the current sync state from DB to read last_successful_sync
        const { data: syncState } = await admin
          .from('integration_sync_state')
          .select('*')
          .eq('account_id', integration.account_id)
          .eq('platform', integration.platform)
          .maybeSingle()

        // Check if this integration is due for sync (or manual bypass)
        const isDue = isManual || isDueForHourlySync(syncState?.last_successful_sync || null)

        if (!isDue) {
          console.log(`${logPrefix} Not due yet (last successful sync was at ${syncState?.last_successful_sync || 'never'})`)
          results.push({
            id: integration.id,
            platform: integration.platform,
            account_id: integration.account_id,
            status: 'skipped'
          })
          continue
        }

        // Check lock state
        if (syncState && syncState.sync_status === 'RUNNING') {
          const updatedAt = new Date(syncState.updated_at).getTime()
          const elapsedMinutes = (Date.now() - updatedAt) / (60 * 1000)
          // Lock is valid if it was updated less than 10 minutes ago
          if (elapsedMinutes < 10) {
            console.warn(`${logPrefix} Centralized lock: Already RUNNING (started ${Math.round(elapsedMinutes)}m ago). Skipping execution.`)
            results.push({
              id: integration.id,
              platform: integration.platform,
              account_id: integration.account_id,
              status: 'skipped',
              error: 'Overlapping sync job prevented by active lock'
            })
            continue
          }
        }

        console.log(`${logPrefix} Starting scheduled sync…`)

        // 3. Log start of sync in sync_logs
        const { data: logEntry, error: logEntryError } = await admin
          .from('sync_logs')
          .insert({
            account_id: integration.account_id,
            platform: integration.platform,
            status: 'RUNNING',
            started_at: startedAtStr
          })
          .select('id')
          .single()

        if (logEntryError) {
          console.error(`${logPrefix} Failed to create sync log entry:`, logEntryError)
        }

        const logId = logEntry?.id

        // 4. Run the platform-specific sync
        let syncResult = { syncedCount: 0, duplicateCount: 0 }
        const startTime = Date.now()

        if (integration.platform === 'INDIAMART') {
          syncResult = await IndiaMartService.syncLeads(integration.account_id, admin, integration)
        } else if (integration.platform === 'TRADEINDIA') {
          syncResult = await TradeIndiaService.syncLeads(integration.account_id, admin, integration)
        } else if (integration.platform === 'EXPORTERSINDIA') {
          syncResult = await ExportersIndiaService.syncLeads(integration.account_id, admin, integration)
        } else {
          console.warn(`${logPrefix} Unknown platform '${integration.platform}' — skipping`)
          
          if (logId) {
            await admin
              .from('sync_logs')
              .update({
                status: 'FAILED',
                finished_at: new Date().toISOString(),
                error_message: 'Unknown platform',
                duration: Date.now() - startTime
              })
              .eq('id', logId)
          }

          results.push({
            id: integration.id,
            platform: integration.platform,
            account_id: integration.account_id,
            status: 'skipped',
            error: 'Unknown platform'
          })
          continue
        }

        const duration = Date.now() - startTime
        console.log(
          `${logPrefix} Sync completed successfully in ${duration}ms. New: ${syncResult.syncedCount}, Duplicates: ${syncResult.duplicateCount}`
        )

        // 5. Update sync_logs to SUCCESS
        if (logId) {
          await admin
            .from('sync_logs')
            .update({
              status: 'SUCCESS',
              finished_at: new Date().toISOString(),
              records_imported: syncResult.syncedCount,
              duration
            })
            .eq('id', logId)
        }

        results.push({
          id: integration.id,
          platform: integration.platform,
          account_id: integration.account_id,
          status: 'success',
          syncedCount: syncResult.syncedCount,
          duplicateCount: syncResult.duplicateCount
        })
      } catch (err) {
        const msg: string = err instanceof Error ? err.message : String(err)
        const isRateLimited =
          msg.includes('429') ||
          msg.toLowerCase().includes('too many requests') ||
          msg.toLowerCase().includes('crossed this limit') ||
          msg.toLowerCase().includes('once in every 5 minutes')

        console.error(`${logPrefix} Sync ${isRateLimited ? 'rate limited' : 'failed'}:`, msg)

        // Mark as FAILED in sync state to release the lock, preventing stuck RUNNING state
        await admin
          .from('integration_sync_state')
          .upsert(
            {
              account_id: integration.account_id,
              platform: integration.platform,
              sync_status: 'FAILED',
              error_message: isRateLimited
                ? 'Rate limited — will retry after cooldown interval'
                : msg.slice(0, 500),
              updated_at: new Date().toISOString()
            },
            { onConflict: 'account_id,platform' }
          )
          .then()

        // Also update last_sync_at on b2b_integrations to prevent immediate retries and enforce cooldown
        await admin
          .from('b2b_integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', integration.id)
          .then()

        // 6. Update sync_logs to FAILED
        try {
          const { data: lastLog } = await admin
            .from('sync_logs')
            .select('id, started_at')
            .eq('account_id', integration.account_id)
            .eq('platform', integration.platform)
            .eq('status', 'RUNNING')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (lastLog) {
            const duration = Date.now() - new Date(lastLog.started_at).getTime()
            await admin
              .from('sync_logs')
              .update({
                status: 'FAILED',
                finished_at: new Date().toISOString(),
                error_message: isRateLimited ? '429 Rate limited' : msg.slice(0, 500),
                duration
              })
              .eq('id', lastLog.id)
          }
        } catch (logErr) {
          console.error(`${logPrefix} Failed to update error state in sync_logs:`, logErr)
        }

        results.push({
          id: integration.id,
          platform: integration.platform,
          account_id: integration.account_id,
          status: isRateLimited ? 'rate_limited' : 'failed',
          error: msg.slice(0, 200)
        })
      }
    }

    // 7. Build summary
    const successCount     = results.filter((r) => r.status === 'success').length
    const failedCount      = results.filter((r) => r.status === 'failed').length
    const skippedCount     = results.filter((r) => r.status === 'skipped').length
    const rateLimitedCount = results.filter((r) => r.status === 'rate_limited').length
    const totalSynced      = results.reduce((s, r) => s + (r.syncedCount ?? 0), 0)

    console.log(
      `[b2b-cron] Finished. success=${successCount} failed=${failedCount} skipped=${skippedCount} rate_limited=${rateLimitedCount} total_new_leads=${totalSynced}`
    )

    return NextResponse.json({
      success: true,
      started_at: startedAtStr,
      finished_at: new Date().toISOString(),
      summary: { successCount, failedCount, skippedCount, rateLimitedCount, totalSynced },
      details: results
    })
  } catch (error) {
    console.error('[b2b-cron] Fatal cron error:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMsg ?? 'Cron server error' },
      { status: 500 }
    )
  }
}
