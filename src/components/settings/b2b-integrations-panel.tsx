'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  Save,
  Trash2,
  Plus,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Bell,
  RefreshCw,
  Clock,
  ArrowLeft,
  ArrowRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { B2BIntegration, B2BPlatform, B2BSyncInterval, NotificationRecipient, IntegrationSyncState, SyncLog } from '@/types'

const MASKED_SECRET = '••••••••'

export function B2BIntegrationsPanel() {
  const supabase = createClient()
  const { user, accountId, loading: authLoading, profileLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([])

  // Centralized Sync Logs / History State
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [logsCount, setLogsCount] = useState(0)
  const [logsLimit] = useState(10)
  const [logsOffset, setLogsOffset] = useState(0)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsPlatformFilter, setLogsPlatformFilter] = useState<'ALL' | B2BPlatform>('ALL')

  const fetchSyncLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const platformParam = logsPlatformFilter === 'ALL' ? '' : `&platform=${logsPlatformFilter}`
      const res = await fetch(`/api/integrations/sync-logs?limit=${logsLimit}&offset=${logsOffset}${platformParam}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setLogsCount(data.count || 0)
      } else {
        throw new Error('Failed to fetch sync logs')
      }
    } catch (err) {
      console.error(err)
      toast.error('Could not load sync history')
    } finally {
      setLogsLoading(false)
    }
  }, [logsLimit, logsOffset, logsPlatformFilter])

  useEffect(() => {
    if (accountId) {
      fetchSyncLogs()
    }
  }, [accountId, fetchSyncLogs])
  const [newRecipientName, setNewRecipientName] = useState('')
  const [newRecipientMobile, setNewRecipientMobile] = useState('')
  const [addingRecipient, setAddingRecipient] = useState(false)

  // Configurations for each platform
  const [configs, setConfigs] = useState<Record<B2BPlatform, B2BIntegration | null>>({
    INDIAMART: null,
    TRADEINDIA: null,
    EXPORTERSINDIA: null,
    ALIBABA: null
  })

  // Local state for forms
  const [indiamartForm, setIndiamartForm] = useState({
    enabled: false,
    api_url: '',
    api_key: '',
    username: '',
    sync_interval: '15m' as B2BSyncInterval
  })

  const [tradeindiaForm, setTradeindiaForm] = useState({
    enabled: false,
    api_url: '',
    api_key: '',
    client_id: '',
    username: '',
    sync_interval: '15m' as B2BSyncInterval
  })

  const [exportersindiaForm, setExportersindiaForm] = useState({
    enabled: false,
    api_url: '',
    api_key: '',
    username: '',
    sync_interval: '15m' as B2BSyncInterval
  })

  // Visibility states
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({
    indiamart_key: false,
    tradeindia_key: false,
    exportersindia_key: false
  })

  // Action loading states
  const [actionLoading, setActionLoading] = useState<Record<string, 'save' | 'test' | 'sync' | null>>({
    INDIAMART: null,
    TRADEINDIA: null,
    EXPORTERSINDIA: null
  })

  const [syncStates, setSyncStates] = useState<Record<string, IntegrationSyncState | null>>({
    INDIAMART: null,
    TRADEINDIA: null,
    EXPORTERSINDIA: null
  })
  const [historicalSyncing, setHistoricalSyncing] = useState<Record<string, boolean>>({
    INDIAMART: false,
    TRADEINDIA: false,
    EXPORTERSINDIA: false
  })
  const [countdowns, setCountdowns] = useState<Record<string, number | null>>({
    INDIAMART: null,
    TRADEINDIA: null,
    EXPORTERSINDIA: null
  })
  const [leadsImported, setLeadsImported] = useState<Record<string, number>>({
    INDIAMART: 0,
    TRADEINDIA: 0,
    EXPORTERSINDIA: 0
  })
  const [leadsSkipped, setLeadsSkipped] = useState<Record<string, number>>({
    INDIAMART: 0,
    TRADEINDIA: 0,
    EXPORTERSINDIA: 0
  })
  const [leadsFailed, setLeadsFailed] = useState<Record<string, number>>({
    INDIAMART: 0,
    TRADEINDIA: 0,
    EXPORTERSINDIA: 0
  })
  const [retryAttempts, setRetryAttempts] = useState<Record<string, number>>({
    INDIAMART: 0,
    TRADEINDIA: 0,
    EXPORTERSINDIA: 0
  })
  const [currentError, setCurrentError] = useState<Record<string, string | null>>({
    INDIAMART: null,
    TRADEINDIA: null,
    EXPORTERSINDIA: null
  })

  // Date selection states for starting historical imports
  const [selectedDateFilter, setSelectedDateFilter] = useState<Record<string, string>>({
    INDIAMART: '30d',
    TRADEINDIA: '30d',
    EXPORTERSINDIA: '30d'
  })
  const [customDates, setCustomDates] = useState<Record<string, { startDate: string; endDate: string }>>({
    INDIAMART: { startDate: '', endDate: '' },
    TRADEINDIA: { startDate: '', endDate: '' },
    EXPORTERSINDIA: { startDate: '', endDate: '' }
  })
  const [showDateSelector, setShowDateSelector] = useState<Record<string, boolean>>({
    INDIAMART: false,
    TRADEINDIA: false,
    EXPORTERSINDIA: false
  })

  // Refs for tracking active loops and timers securely without side-effects in state updaters
  const activeSyncsRef = useRef<Record<string, boolean>>({
    INDIAMART: false,
    TRADEINDIA: false,
    EXPORTERSINDIA: false
  })
  const timersRef = useRef<Record<string, NodeJS.Timeout | null>>({
    INDIAMART: null,
    TRADEINDIA: null,
    EXPORTERSINDIA: null
  })
  const retryAttemptsRef = useRef<Record<string, number>>({
    INDIAMART: 0,
    TRADEINDIA: 0,
    EXPORTERSINDIA: 0
  })
  const executeSyncStepRef = useRef<((platform: B2BPlatform) => Promise<void>) | null>(null)

  const clearTimer = useCallback((platform: B2BPlatform) => {
    if (timersRef.current[platform]) {
      clearInterval(timersRef.current[platform]!)
      timersRef.current[platform] = null
    }
  }, [])

  const fetchSyncState = useCallback(async (platform: B2BPlatform) => {
    try {
      const res = await fetch(`/api/integrations/${platform.toLowerCase()}/sync`)
      if (res.ok) {
        const data = await res.json()
        if (data.syncState) {
          setSyncStates((prev) => ({ ...prev, [platform]: data.syncState }))
          if (data.syncState.sync_status === 'RUNNING') {
            // Auto resume syncing if page loads while running
            setHistoricalSyncing((prev) => ({ ...prev, [platform]: true }))
          }
        }
      }
    } catch (err) {
      console.error(`Failed to fetch ${platform} sync state:`, err)
    }
  }, [])

  const getBackoffTime = useCallback((attempt: number) => {
    switch (attempt) {
      case 1: return 2000
      case 2: return 4000
      case 3: return 8000
      case 4: return 16000
      case 5: return 30000
      default: return 30000
    }
  }, [])

  const getClientTotalPages = useCallback((
    platform: B2BPlatform,
    dateFilter: string | null | undefined,
    customStart?: string | null,
    customEnd?: string | null
  ) => {
    const filter = dateFilter || '365d'
    const now = new Date()
    let endDateBound = now
    let startDateBound = new Date(now)

    if (filter === '7d') {
      startDateBound.setDate(startDateBound.getDate() - 7)
    } else if (filter === '30d') {
      startDateBound.setDate(startDateBound.getDate() - 30)
    } else if (filter === '90d') {
      startDateBound.setDate(startDateBound.getDate() - 90)
    } else if (filter === '180d') {
      startDateBound.setDate(startDateBound.getDate() - 180)
    } else if (filter === '365d' || filter === 'all') {
      const maxDays = platform === 'EXPORTERSINDIA' ? 60 : 365
      startDateBound.setDate(startDateBound.getDate() - maxDays)
    } else if (filter === 'custom' && customStart && customEnd) {
      startDateBound = new Date(customStart)
      endDateBound = new Date(customEnd)
      if (isNaN(startDateBound.getTime())) startDateBound = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      if (isNaN(endDateBound.getTime())) endDateBound = now
    } else {
      const maxDays = platform === 'EXPORTERSINDIA' ? 60 : 365
      startDateBound.setDate(startDateBound.getDate() - maxDays)
    }

    if (platform === 'EXPORTERSINDIA') {
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
      if (startDateBound.getTime() < sixtyDaysAgo.getTime()) {
        startDateBound = sixtyDaysAgo
      }
    }

    const batchSizeDays = platform === 'TRADEINDIA' ? 1 : 7
    const totalTimeDiff = endDateBound.getTime() - startDateBound.getTime()
    const totalDays = Math.max(1, Math.ceil(totalTimeDiff / (24 * 60 * 60 * 1000)))
    return Math.ceil(totalDays / batchSizeDays)
  }, [])

  const fetchCurrentRunStats = useCallback(async (platform: B2BPlatform, acctId: string) => {
    try {
      const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('platform', platform)
        .eq('account_id', acctId)
        .order('started_at', { ascending: false })
        .limit(100)

      if (error) throw error

      let totalImported = 0
      let totalSkipped = 0
      let totalFailed = 0

      if (logs && logs.length > 0) {
        for (const log of logs) {
          const meta = log.error_message?.includes('Metadata:')
            ? JSON.parse(log.error_message.split('Metadata:')[1])
            : null

          const imp = log.imported ?? meta?.imported ?? log.records_imported ?? 0
          const skp = log.skipped ?? meta?.skipped ?? 0
          const fail = log.failed ?? meta?.failed ?? (log.status === 'FAILED' ? 1 : 0)

          totalImported += imp
          totalSkipped += skp
          totalFailed += fail

          const pageNum = log.last_successful_page ?? meta?.last_successful_page ?? 1
          if (pageNum === 1) {
            break
          }
        }
      }

      return { imported: totalImported, skipped: totalSkipped, failed: totalFailed }
    } catch (err) {
      console.error('Error fetching current run stats:', err)
      return { imported: 0, skipped: 0, failed: 0 }
    }
  }, [supabase])

  const triggerStartImport = (platform: B2BPlatform) => {
    const filter = selectedDateFilter[platform] || '30d'
    const custom = customDates[platform]

    if (filter === 'custom' && (!custom.startDate || !custom.endDate)) {
      toast.error('Please specify both Start Date and End Date for custom range.')
      return
    }

    setShowDateSelector(prev => ({ ...prev, [platform]: false }))
    handleRestart(platform, filter, custom.startDate, custom.endDate)
  }

  const executeSyncStep = useCallback(async (platform: B2BPlatform) => {
    if (!activeSyncsRef.current[platform]) return

    try {
      const res = await fetch(`/api/integrations/${platform.toLowerCase()}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'historical' })
      })

      if (!activeSyncsRef.current[platform]) return

      const data = await res.json()

      if (res.ok) {
        setSyncStates((prev) => ({ ...prev, [platform]: data.syncState }))
        setLeadsImported((prev) => ({ ...prev, [platform]: prev[platform] + (data.imported || 0) }))
        setLeadsSkipped((prev) => ({ ...prev, [platform]: prev[platform] + (data.skipped || 0) }))
        setLeadsFailed((prev) => ({ ...prev, [platform]: prev[platform] + (data.failed || 0) }))
        setCurrentError((prev) => ({ ...prev, [platform]: null }))
        
        retryAttemptsRef.current[platform] = 0
        setRetryAttempts((prev) => ({ ...prev, [platform]: 0 }))

        if (data.syncState.sync_status === 'COMPLETED') {
          toast.success(`${platform} historical leads import completed successfully!`)
          activeSyncsRef.current[platform] = false
          setHistoricalSyncing((prev) => ({ ...prev, [platform]: false }))
          return
        }

        // Wait 3 seconds before next batch
        clearTimer(platform)
        const timer = setTimeout(() => {
          timersRef.current[platform] = null
          executeSyncStepRef.current?.(platform)
        }, 3000)
        timersRef.current[platform] = timer
        // Handle error response
        const rawError = data.error
        const errorString = typeof rawError === 'string'
          ? rawError
          : (rawError && typeof rawError === 'object'
              ? ((rawError as any).message || JSON.stringify(rawError))
              : 'Sync failed')

        const isRetryable =
          res.status === 429 ||
          res.status === 500 ||
          errorString.toLowerCase().includes('timeout') ||
          errorString.toLowerCase().includes('fetch failed') ||
          errorString.toLowerCase().includes('network')

        setSyncStates((prev) => ({ ...prev, [platform]: data.syncState || prev[platform] }))
        setCurrentError((prev) => ({ ...prev, [platform]: errorString }))

        if (isRetryable) {
          const attempt = retryAttemptsRef.current[platform] + 1
          retryAttemptsRef.current[platform] = attempt
          setRetryAttempts((prev) => ({ ...prev, [platform]: attempt }))

          if (attempt <= 5) {
            const backoffTime = getBackoffTime(attempt)
            toast.error(`${platform} sync page failed. Retrying (attempt ${attempt}/5) in ${backoffTime / 1000}s...`)
            
            let secondsLeft = Math.round(backoffTime / 1000)
            setCountdowns((prev) => ({ ...prev, [platform]: secondsLeft }))
            
            clearTimer(platform)
            const timer = setInterval(() => {
              secondsLeft--
              if (!activeSyncsRef.current[platform]) {
                clearInterval(timer)
                if (timersRef.current[platform] === timer) {
                  timersRef.current[platform] = null
                }
                setCountdowns((prev) => ({ ...prev, [platform]: null }))
                return
              }
              if (secondsLeft <= 0) {
                clearInterval(timer)
                if (timersRef.current[platform] === timer) {
                  timersRef.current[platform] = null
                }
                setCountdowns((prev) => ({ ...prev, [platform]: null }))
                executeSyncStepRef.current?.(platform)
              } else {
                setCountdowns((prev) => ({ ...prev, [platform]: secondsLeft }))
              }
            }, 1000)
            timersRef.current[platform] = timer
          } else {
            toast.error(data.error || `Historical sync failed for ${platform} after 5 retries.`)
            activeSyncsRef.current[platform] = false
            setHistoricalSyncing((prev) => ({ ...prev, [platform]: false }))
          }
        } else {
          // Immediately stop on non-retryable error
          toast.error(data.error || `Historical sync failed for ${platform}.`)
          activeSyncsRef.current[platform] = false
          setHistoricalSyncing((prev) => ({ ...prev, [platform]: false }))
        }
      }
    } catch (err) {
      if (!activeSyncsRef.current[platform]) return

      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setCurrentError((prev) => ({ ...prev, [platform]: errorMsg }))

      const attempt = retryAttemptsRef.current[platform] + 1
      retryAttemptsRef.current[platform] = attempt
      setRetryAttempts((prev) => ({ ...prev, [platform]: attempt }))

      if (attempt <= 5) {
        const backoffTime = getBackoffTime(attempt)
        toast.error(`Network error syncing ${platform}. Retrying (attempt ${attempt}/5) in ${backoffTime / 1000}s...`)
        
        let secondsLeft = Math.round(backoffTime / 1000)
        setCountdowns((prev) => ({ ...prev, [platform]: secondsLeft }))
        
        clearTimer(platform)
        const timer = setInterval(() => {
          secondsLeft--
          if (!activeSyncsRef.current[platform]) {
            clearInterval(timer)
            if (timersRef.current[platform] === timer) {
              timersRef.current[platform] = null
            }
            setCountdowns((prev) => ({ ...prev, [platform]: null }))
            return
          }
          if (secondsLeft <= 0) {
            clearInterval(timer)
            if (timersRef.current[platform] === timer) {
              timersRef.current[platform] = null
            }
            setCountdowns((prev) => ({ ...prev, [platform]: null }))
            executeSyncStepRef.current?.(platform)
          } else {
            setCountdowns((prev) => ({ ...prev, [platform]: secondsLeft }))
          }
        }, 1000)
        timersRef.current[platform] = timer
      } else {
        toast.error(errorMsg || `Historical sync failed for ${platform} due to network error.`)
        activeSyncsRef.current[platform] = false
        setHistoricalSyncing((prev) => ({ ...prev, [platform]: false }))
      }
    }
  }, [clearTimer, getBackoffTime, getClientTotalPages, selectedDateFilter, customDates])

  useEffect(() => {
    executeSyncStepRef.current = executeSyncStep
  }, [executeSyncStep])

  // Single effect to trigger sync execution and coordinate with Ref
  useEffect(() => {
    ;(Object.keys(historicalSyncing) as B2BPlatform[]).forEach((platform) => {
      if (historicalSyncing[platform]) {
        if (!activeSyncsRef.current[platform]) {
          activeSyncsRef.current[platform] = true
          executeSyncStepRef.current?.(platform)
        }
      } else {
        activeSyncsRef.current[platform] = false
        clearTimer(platform)
        setCountdowns((prev) => ({ ...prev, [platform]: null }))
      }
    })
  }, [historicalSyncing, executeSyncStep, clearTimer])

  // Cleanup effect on unmount
  useEffect(() => {
    return () => {
      ;(Object.keys(activeSyncsRef.current) as B2BPlatform[]).forEach((platform) => {
        activeSyncsRef.current[platform] = false
        clearTimer(platform)
      })
    }
  }, [clearTimer])

  const handlePause = async (platform: B2BPlatform) => {
    activeSyncsRef.current[platform] = false
    clearTimer(platform)
    setCountdowns((prev) => ({ ...prev, [platform]: null }))
    setHistoricalSyncing((prev) => ({ ...prev, [platform]: false }))

    const currentSyncState = syncStates[platform]
    if (currentSyncState && currentSyncState.id) {
      try {
        const { error } = await supabase
          .from('integration_sync_state')
          .update({ sync_status: 'IDLE' })
          .eq('id', currentSyncState.id)
        
        if (error) throw error
        setSyncStates((prev) => {
          const current = prev[platform]
          return {
            ...prev,
            [platform]: current ? { ...current, sync_status: 'IDLE' } : null
          }
        })
        toast.success(`${platform} historical import paused.`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        toast.error(`Failed to pause ${platform} sync: ` + message)
      }
    }
  }

  const handleResume = (platform: B2BPlatform) => {
    clearTimer(platform)
    setCountdowns((prev) => ({ ...prev, [platform]: null }))
    
    retryAttemptsRef.current[platform] = 0
    setRetryAttempts((prev) => ({ ...prev, [platform]: 0 }))
    
    setHistoricalSyncing((prev) => ({ ...prev, [platform]: true }))
  }

  const handleRestart = async (
    platform: B2BPlatform,
    dateFilter?: string,
    startDate?: string,
    endDate?: string
  ) => {
    activeSyncsRef.current[platform] = false
    clearTimer(platform)
    setCountdowns((prev) => ({ ...prev, [platform]: null }))
    setLeadsImported((prev) => ({ ...prev, [platform]: 0 }))
    setLeadsSkipped((prev) => ({ ...prev, [platform]: 0 }))
    setLeadsFailed((prev) => ({ ...prev, [platform]: 0 }))
    setCurrentError((prev) => ({ ...prev, [platform]: null }))
    
    retryAttemptsRef.current[platform] = 0
    setRetryAttempts((prev) => ({ ...prev, [platform]: 0 }))
    setHistoricalSyncing((prev) => ({ ...prev, [platform]: false }))

    try {
      const res = await fetch(`/api/integrations/${platform.toLowerCase()}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'historical',
          restart: true,
          dateFilter,
          startDate,
          endDate
        })
      })

      const data = await res.json()
      if (res.ok) {
        setSyncStates((prev) => ({ ...prev, [platform]: data.syncState }))
        toast.success(`Reset ${platform} historical import to page 1. Starting...`)
        setHistoricalSyncing((prev) => ({ ...prev, [platform]: true }))
      } else {
        const rawError = data.error
        const errorString = typeof rawError === 'string'
          ? rawError
          : (rawError && typeof rawError === 'object'
              ? ((rawError as any).message || JSON.stringify(rawError))
              : 'Failed to restart')
        throw new Error(errorString)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Failed to restart ${platform} sync: ` + message)
    }
  }

  const renderHistoricalSyncPanel = (platform: B2BPlatform, maxPages: number, batchDesc: string, estTimePerPageSeconds: number) => {
    const isEnabled = configs[platform]?.enabled
    if (!isEnabled) return null

    const syncState = syncStates[platform]
    const syncing = historicalSyncing[platform]
    const countdown = countdowns[platform]
    const imported = leadsImported[platform]
    const attempts = retryAttempts[platform]

    const currentPage = syncState ? syncState.current_page : 1
    const totalPages = getClientTotalPages(
      platform,
      syncState?.current_date_filter || selectedDateFilter[platform],
      syncState?.custom_start_date || customDates[platform]?.startDate,
      syncState?.custom_end_date || customDates[platform]?.endDate
    ) || maxPages
    const status = syncState ? syncState.sync_status : 'IDLE'
    const progressPercent = status === 'COMPLETED' ? 100 : Math.round(((currentPage - 1) / totalPages) * 100)

    const estTimeLeftMinutes = Math.round(((totalPages - currentPage + 1) * estTimePerPageSeconds) / 60)

    return (
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">Historical Lead Import</h4>
            <p className="text-xs text-slate-400 text-[10px] leading-tight">{batchDesc}</p>
          </div>
          {syncState && (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
              syncing || status === 'RUNNING' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
              status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
              status === 'FAILED' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
              'bg-slate-800/50 text-slate-400 border-slate-700'
            }`}>
              {syncing ? 'RUNNING' : status}
            </span>
          )}
        </div>

        {/* Real-time Progress Section */}
        {syncState && status !== 'IDLE' && (
          <div className="space-y-3 p-3 rounded border border-slate-900 bg-slate-950/60">
            {status === 'COMPLETED' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Historical Import Completed</span>
                </div>
                <div className="space-y-1 text-xs text-slate-300 pl-7">
                  <div>Imported: <span className="font-semibold text-white">{imported}</span></div>
                  <div>Skipped: <span className="font-semibold text-white">{leadsSkipped[platform]}</span></div>
                  <div>Failed: <span className="font-semibold text-white">{leadsFailed[platform]}</span></div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Page {currentPage} of {totalPages}</span>
                  <span>{progressPercent}% Complete</span>
                </div>
                
                <div className="h-1.5 w-full rounded-full bg-slate-850 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      status === 'FAILED' ? 'bg-rose-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="space-y-1 text-xs text-slate-300">
                  <div>Imported: <span className="font-semibold text-white">{imported}</span></div>
                  <div>Skipped: <span className="font-semibold text-white">{leadsSkipped[platform]}</span></div>
                  <div>Failed: <span className="font-semibold text-white">{leadsFailed[platform]}</span></div>
                </div>

                <div className="grid grid-cols-1 gap-1 pt-2 text-[11px] text-slate-400 border-t border-slate-900/60 font-medium">
                  {countdown !== null ? (
                    <div className="text-amber-400 animate-pulse">
                      {currentError[platform] ? `${currentError[platform]}. ` : ''}
                      Retrying (attempt {attempts}/5) in {countdown}s...
                    </div>
                  ) : syncing ? (
                    <div className="text-amber-400 flex items-center gap-1.5 animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processing...
                    </div>
                  ) : null}
                  {status === 'FAILED' && countdown === null && (
                    <div className="text-rose-400 leading-normal font-semibold">
                      Error: {syncState.error_message || currentError[platform] || 'Sync failed'} {syncState.retry_count > 0 && `(Failed retries: ${syncState.retry_count})`}
                    </div>
                  )}
                  {status !== 'FAILED' && (
                    <div className="text-slate-400">Est. Time Left: <span className="font-semibold text-white">{estTimeLeftMinutes} min</span></div>
                  )}
                  {syncState.last_lead_timestamp && (
                    <div className="text-slate-400">Last Imported Lead: <span className="font-semibold text-white">{
                      new Date(syncState.last_lead_timestamp).toLocaleString()
                    }</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Date Selector Form */}
        {showDateSelector[platform] && (
          <div className="space-y-3 p-3 rounded border border-slate-800 bg-slate-905/40">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300 font-semibold">Select Import Date Range</Label>
              <select
                value={selectedDateFilter[platform] || '30d'}
                onChange={(e) => setSelectedDateFilter(prev => ({ ...prev, [platform]: e.target.value }))}
                className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-xs text-white focus:border-primary focus:outline-none"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="180d">Last 180 Days</option>
                <option value="365d">Last 365 Days</option>
                <option value="custom">Custom Date Range</option>
                <option value="all">Entire Available History</option>
              </select>
            </div>

            {selectedDateFilter[platform] === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400">Start Date</Label>
                  <Input
                    type="date"
                    value={customDates[platform]?.startDate || ''}
                    onChange={(e) => setCustomDates(prev => ({
                      ...prev,
                      [platform]: { ...prev[platform], startDate: e.target.value }
                    }))}
                    className="h-8 border-slate-700 bg-slate-950 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400">End Date</Label>
                  <Input
                    type="date"
                    value={customDates[platform]?.endDate || ''}
                    onChange={(e) => setCustomDates(prev => ({
                      ...prev,
                      [platform]: { ...prev[platform], endDate: e.target.value }
                    }))}
                    className="h-8 border-slate-700 bg-slate-950 text-xs text-white"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                onClick={() => setShowDateSelector(prev => ({ ...prev, [platform]: false }))}
                variant="ghost"
                className="border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-7 px-2.5"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => triggerStartImport(platform)}
                className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold text-xs h-7 px-2.5"
              >
                Start Import
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!showDateSelector[platform] && (
          <div className="flex gap-2 justify-end">
            {syncing ? (
              <Button
                type="button"
                onClick={() => handlePause(platform)}
                variant="ghost"
                className="border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs px-2.5 h-7"
              >
                Pause Import
              </Button>
            ) : (
              <>
                {syncState && (currentPage > 1 || status === 'FAILED') && status !== 'COMPLETED' && (
                  <Button
                    type="button"
                    onClick={() => setShowDateSelector(prev => ({ ...prev, [platform]: true }))}
                    variant="ghost"
                    className="border border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/10 text-xs font-semibold px-2.5 h-7"
                  >
                    Restart (Page 1)
                  </Button>
                )}
                
                <Button
                  type="button"
                  onClick={() => {
                    const canResume = syncState && currentPage > 1 && status !== 'COMPLETED'
                    if (canResume) {
                      handleResume(platform)
                    } else {
                      setShowDateSelector(prev => ({ ...prev, [platform]: true }))
                    }
                  }}
                  disabled={actionLoading[platform] !== null}
                  variant="ghost"
                  className="border border-amber-500/30 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 text-xs font-semibold px-2.5 h-7"
                >
                  {syncState && currentPage > 1 && status !== 'COMPLETED'
                    ? 'Resume Historical Import'
                    : 'Import Historical Leads'
                  }
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  const fetchPlatformConfig = useCallback(async (platform: B2BPlatform) => {
    try {
      const res = await fetch(`/api/integrations/${platform.toLowerCase()}/config`)
      if (res.ok) {
        const data = await res.json()
        if (data.config) {
          setConfigs((prev) => ({ ...prev, [platform]: data.config }))
          const formVals = {
            enabled: data.config.enabled,
            api_url: data.config.api_url || '',
            api_key: data.config.api_key || '',
            username: data.config.username || '',
            sync_interval: data.config.sync_interval || '15m'
          }

          if (platform === 'INDIAMART') {
            setIndiamartForm(formVals)
          } else if (platform === 'TRADEINDIA') {
            setTradeindiaForm({
              ...formVals,
              client_id: data.config.client_id || ''
            })
          } else if (platform === 'EXPORTERSINDIA') {
            setExportersindiaForm(formVals)
          }
        }
      }
    } catch (err) {
      console.error(`Failed to load ${platform} config:`, err)
    }
  }, [])

  const fetchRecipients = useCallback(async (acctId: string) => {
    try {
      const supabaseClient = createClient()
      const { data, error } = await supabaseClient
        .from('notification_recipients')
        .select('*')
        .eq('account_id', acctId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setRecipients(data || [])
    } catch (err) {
      console.error('Failed to load recipients:', err)
    }
  }, [])

  const loadAllData = useCallback(async (acctId: string) => {
    setLoading(true)
    const getPlatformStats = async (platform: B2BPlatform) => {
      const stats = await fetchCurrentRunStats(platform, acctId)
      setLeadsImported(prev => ({ ...prev, [platform]: stats.imported }))
      setLeadsSkipped(prev => ({ ...prev, [platform]: stats.skipped }))
      setLeadsFailed(prev => ({ ...prev, [platform]: stats.failed }))
    }

    await Promise.all([
      fetchPlatformConfig('INDIAMART'),
      fetchPlatformConfig('TRADEINDIA'),
      fetchPlatformConfig('EXPORTERSINDIA'),
      fetchRecipients(acctId),
      fetchSyncState('INDIAMART'),
      fetchSyncState('TRADEINDIA'),
      fetchSyncState('EXPORTERSINDIA'),
      getPlatformStats('INDIAMART'),
      getPlatformStats('TRADEINDIA'),
      getPlatformStats('EXPORTERSINDIA')
    ])
    setLoading(false)
  }, [fetchPlatformConfig, fetchRecipients, fetchSyncState, fetchCurrentRunStats])

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!user || !accountId) {
      Promise.resolve().then(() => {
        setLoading(false)
      })
      return
    }
    Promise.resolve().then(() => {
      loadAllData(accountId)
    })
  }, [authLoading, profileLoading, user, accountId, loadAllData])

  const handleSave = async (platform: B2BPlatform) => {
    setActionLoading((prev) => ({ ...prev, [platform]: 'save' }))
    try {
      let body: Record<string, unknown> = {}
      if (platform === 'INDIAMART') {
        body = indiamartForm
      } else if (platform === 'TRADEINDIA') {
        body = tradeindiaForm
      } else if (platform === 'EXPORTERSINDIA') {
        body = exportersindiaForm
      }

      const res = await fetch(`/api/integrations/${platform.toLowerCase()}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save config')

      toast.success(`${platform} configuration saved successfully!`)
      await fetchPlatformConfig(platform)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(message || `Error saving ${platform} config`)
    } finally {
      setActionLoading((prev) => ({ ...prev, [platform]: null }))
    }
  }

  const handleTest = async (platform: B2BPlatform) => {
    setActionLoading((prev) => ({ ...prev, [platform]: 'test' }))
    try {
      let body: Record<string, unknown> = {}
      if (platform === 'INDIAMART') {
        body = indiamartForm
      } else if (platform === 'TRADEINDIA') {
        body = tradeindiaForm
      } else if (platform === 'EXPORTERSINDIA') {
        body = exportersindiaForm
      }

      const res = await fetch(`/api/integrations/${platform.toLowerCase()}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Success: ${data.message}`)
      } else {
        toast.error(`Failed: ${data.message || 'Unknown error'}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(message || `Test failed for ${platform}`)
    } finally {
      setActionLoading((prev) => ({ ...prev, [platform]: null }))
    }
  }

  const handleSyncNow = async (platform: B2BPlatform) => {
    setActionLoading((prev) => ({ ...prev, [platform]: 'sync' }))
    try {
      const res = await fetch(`/api/integrations/${platform.toLowerCase()}/sync`, {
        method: 'POST'
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')

      toast.success(data.message || `Successfully synced leads from ${platform}!`)
      fetchSyncLogs()

      if (data.syncState) {
        setSyncStates((prev) => ({ ...prev, [platform]: data.syncState }))
        if (data.syncState.sync_status === 'RUNNING') {
          setHistoricalSyncing((prev) => ({ ...prev, [platform]: true }))
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(message || `Sync failed for ${platform}`)
    } finally {
      setActionLoading((prev) => ({ ...prev, [platform]: null }))
    }
  }

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId) return

    if (!newRecipientName.trim() || !newRecipientMobile.trim()) {
      toast.error('Name and Mobile Number are required')
      return
    }

    setAddingRecipient(true)
    try {
      // Clean mobile format
      const cleanedMobile = newRecipientMobile.replace(/[^0-9+]/g, '')

      const { data, error } = await supabase
        .from('notification_recipients')
        .insert({
          account_id: accountId,
          name: newRecipientName.trim(),
          mobile: cleanedMobile,
          enabled: true
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Recipient added successfully')
      setRecipients((prev) => [...prev, data])
      setNewRecipientName('')
      setNewRecipientMobile('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(message || 'Failed to add recipient')
    } finally {
      setAddingRecipient(false)
    }
  }

  const handleDeleteRecipient = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notification_recipients')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Recipient removed')
      setRecipients((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(message || 'Failed to delete recipient')
    }
  }

  const handleToggleRecipient = async (id: string, currentVal: boolean) => {
    try {
      const { error } = await supabase
        .from('notification_recipients')
        .update({ enabled: !currentVal })
        .eq('id', id)

      if (error) throw error

      setRecipients((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: !currentVal } : r))
      )
      toast.success(`Recipient ${!currentVal ? 'enabled' : 'disabled'}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(message || 'Failed to toggle recipient status')
    }
  }

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-slate-400">Loading B2B integrations configurations...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* -------------------- INDIAMART CARD -------------------- */}
      <Card className="border border-slate-700 bg-slate-900/60 text-white shadow-xl backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-bold text-white">IndiaMART Integration</CardTitle>
            <CardDescription className="text-slate-400">
              Fetch enquiries directly from IndiaMART using their Pull API.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 p-2 hover:bg-slate-800"
            onClick={() => setIndiamartForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
          >
            {indiamartForm.enabled ? (
              <>
                <ToggleRight className="h-7 w-7 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-400">Enabled</span>
              </>
            ) : (
              <>
                <ToggleLeft className="h-7 w-7 text-slate-500" />
                <span className="text-xs font-semibold text-slate-400">Disabled</span>
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="im_url">API URL (Leave blank for default)</Label>
              <Input
                id="im_url"
                placeholder="https://mapi.indiamart.com/wservc/enquiry/op/get/"
                value={indiamartForm.api_url}
                onChange={(e) => setIndiamartForm((prev) => ({ ...prev, api_url: e.target.value }))}
                className="border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="im_mobile">GLUSR_MOBILE (Registered Mobile Number)</Label>
              <Input
                id="im_mobile"
                placeholder="e.g. 919999999999"
                value={indiamartForm.username}
                onChange={(e) => setIndiamartForm((prev) => ({ ...prev, username: e.target.value }))}
                className="border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="im_key">GLUSR_MOBILE_KEY (API Key)</Label>
              <div className="relative">
                <Input
                  id="im_key"
                  type={showKeys.indiamart_key ? 'text' : 'password'}
                  placeholder="Enter IndiaMART API key"
                  value={indiamartForm.api_key}
                  onChange={(e) => setIndiamartForm((prev) => ({ ...prev, api_key: e.target.value }))}
                  className="border-slate-700 bg-slate-900 pr-10 text-white placeholder-slate-500 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys((prev) => ({ ...prev, indiamart_key: !prev.indiamart_key }))}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                >
                  {showKeys.indiamart_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="im_interval">Sync Interval</Label>
              <select
                id="im_interval"
                value={indiamartForm.sync_interval}
                onChange={(e) =>
                  setIndiamartForm((prev) => ({ ...prev, sync_interval: e.target.value as B2BSyncInterval }))
                }
                className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm text-white focus:border-primary focus:outline-none"
              >
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="30m">30 Minutes</option>
                <option value="1h">1 Hour</option>
              </select>
            </div>
          </div>

          {/* IndiaMART Historical Sync Panel */}
          {renderHistoricalSyncPanel('INDIAMART', 53, 'Import up to 365 days of old leads from IndiaMART in 7-day batches.', 5)}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              {configs.INDIAMART?.last_sync_at ? (
                <span>Last Sync: {new Date(configs.INDIAMART.last_sync_at).toLocaleString()}</span>
              ) : (
                <span>Never synced</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => handleTest('INDIAMART')}
                disabled={actionLoading.INDIAMART !== null}
                className="border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                {actionLoading.INDIAMART === 'test' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Connection
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleSyncNow('INDIAMART')}
                disabled={actionLoading.INDIAMART !== null || !configs.INDIAMART || !configs.INDIAMART.enabled}
                className="border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                {actionLoading.INDIAMART === 'sync' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sync Now
              </Button>
              <Button
                onClick={() => handleSave('INDIAMART')}
                disabled={actionLoading.INDIAMART !== null}
                className="bg-primary text-white hover:bg-primary/90"
              >
                {actionLoading.INDIAMART === 'save' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* -------------------- TRADEINDIA CARD -------------------- */}
      <Card className="border border-slate-700 bg-slate-900/60 text-white shadow-xl backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-bold text-white">TradeIndia Integration</CardTitle>
            <CardDescription className="text-slate-400">
              Fetch inquiries from TradeIndia using their inquiry Pull URL.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 p-2 hover:bg-slate-800"
            onClick={() => setTradeindiaForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
          >
            {tradeindiaForm.enabled ? (
              <>
                <ToggleRight className="h-7 w-7 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-400">Enabled</span>
              </>
            ) : (
              <>
                <ToggleLeft className="h-7 w-7 text-slate-500" />
                <span className="text-xs font-semibold text-slate-400">Disabled</span>
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ti_url">API URL (Leave blank for default)</Label>
              <Input
                id="ti_url"
                placeholder="https://www.tradeindia.com/utils/my_inquiry.html"
                value={tradeindiaForm.api_url}
                onChange={(e) => setTradeindiaForm((prev) => ({ ...prev, api_url: e.target.value }))}
                className="border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ti_userid">User ID (username)</Label>
              <Input
                id="ti_userid"
                placeholder="Enter TradeIndia User ID"
                value={tradeindiaForm.username}
                onChange={(e) => setTradeindiaForm((prev) => ({ ...prev, username: e.target.value }))}
                className="border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ti_profile">Profile ID (client_id)</Label>
              <Input
                id="ti_profile"
                placeholder="Enter TradeIndia Profile ID"
                value={tradeindiaForm.client_id}
                onChange={(e) => setTradeindiaForm((prev) => ({ ...prev, client_id: e.target.value }))}
                className="border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ti_key">API Key (profile key)</Label>
              <div className="relative">
                <Input
                  id="ti_key"
                  type={showKeys.tradeindia_key ? 'text' : 'password'}
                  placeholder="Enter TradeIndia profile API key"
                  value={tradeindiaForm.api_key}
                  onChange={(e) => setTradeindiaForm((prev) => ({ ...prev, api_key: e.target.value }))}
                  className="border-slate-700 bg-slate-900 pr-10 text-white placeholder-slate-500 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys((prev) => ({ ...prev, tradeindia_key: !prev.tradeindia_key }))}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                >
                  {showKeys.tradeindia_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ti_interval">Sync Interval</Label>
              <select
                id="ti_interval"
                value={tradeindiaForm.sync_interval}
                onChange={(e) =>
                  setTradeindiaForm((prev) => ({ ...prev, sync_interval: e.target.value as B2BSyncInterval }))
                }
                className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm text-white focus:border-primary focus:outline-none"
              >
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="30m">30 Minutes</option>
                <option value="1h">1 Hour</option>
              </select>
            </div>
          </div>

          {/* TradeIndia Historical Sync Panel */}
          {renderHistoricalSyncPanel('TRADEINDIA', 365, 'Import up to 365 days of old leads from TradeIndia in 1-day batches.', 3)}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              {configs.TRADEINDIA?.last_sync_at ? (
                <span>Last Sync: {new Date(configs.TRADEINDIA.last_sync_at).toLocaleString()}</span>
              ) : (
                <span>Never synced</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => handleTest('TRADEINDIA')}
                disabled={actionLoading.TRADEINDIA !== null}
                className="border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                {actionLoading.TRADEINDIA === 'test' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Connection
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleSyncNow('TRADEINDIA')}
                disabled={actionLoading.TRADEINDIA !== null || !configs.TRADEINDIA || !configs.TRADEINDIA.enabled}
                className="border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                {actionLoading.TRADEINDIA === 'sync' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sync Now
              </Button>
              <Button
                onClick={() => handleSave('TRADEINDIA')}
                disabled={actionLoading.TRADEINDIA !== null}
                className="bg-primary text-white hover:bg-primary/90"
              >
                {actionLoading.TRADEINDIA === 'save' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* -------------------- EXPORTERSINDIA CARD -------------------- */}
      <Card className="border border-slate-700 bg-slate-900/60 text-white shadow-xl backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-bold text-white">ExportersIndia Integration</CardTitle>
            <CardDescription className="text-slate-400">
              Fetch enquiries from ExportersIndia API endpoint.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 p-2 hover:bg-slate-800"
            onClick={() => setExportersindiaForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
          >
            {exportersindiaForm.enabled ? (
              <>
                <ToggleRight className="h-7 w-7 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-400">Enabled</span>
              </>
            ) : (
              <>
                <ToggleLeft className="h-7 w-7 text-slate-500" />
                <span className="text-xs font-semibold text-slate-400">Disabled</span>
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ei_url">API URL (Leave blank for default)</Label>
              <Input
                id="ei_url"
                placeholder="https://api.exportersindia.com/enquiry/"
                value={exportersindiaForm.api_url}
                onChange={(e) => setExportersindiaForm((prev) => ({ ...prev, api_url: e.target.value }))}
                className="border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ei_username">Username</Label>
              <Input
                id="ei_username"
                placeholder="Enter ExportersIndia Username"
                value={exportersindiaForm.username}
                onChange={(e) => setExportersindiaForm((prev) => ({ ...prev, username: e.target.value }))}
                className="border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ei_key">API Key (Token)</Label>
              <div className="relative">
                <Input
                  id="ei_key"
                  type={showKeys.exportersindia_key ? 'text' : 'password'}
                  placeholder="Enter ExportersIndia token/API key"
                  value={exportersindiaForm.api_key}
                  onChange={(e) => setExportersindiaForm((prev) => ({ ...prev, api_key: e.target.value }))}
                  className="border-slate-700 bg-slate-900 pr-10 text-white placeholder-slate-500 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys((prev) => ({ ...prev, exportersindia_key: !prev.exportersindia_key }))}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                >
                  {showKeys.exportersindia_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ei_interval">Sync Interval</Label>
              <select
                id="ei_interval"
                value={exportersindiaForm.sync_interval}
                onChange={(e) =>
                  setExportersindiaForm((prev) => ({ ...prev, sync_interval: e.target.value as B2BSyncInterval }))
                }
                className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-sm text-white focus:border-primary focus:outline-none"
              >
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="30m">30 Minutes</option>
                <option value="1h">1 Hour</option>
              </select>
            </div>
          </div>

          {/* ExportersIndia Historical Sync Panel */}
          {renderHistoricalSyncPanel('EXPORTERSINDIA', 9, 'Import up to 60 days of old leads from ExportersIndia in 7-day batches.', 4)}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              {configs.EXPORTERSINDIA?.last_sync_at ? (
                <span>Last Sync: {new Date(configs.EXPORTERSINDIA.last_sync_at).toLocaleString()}</span>
              ) : (
                <span>Never synced</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => handleTest('EXPORTERSINDIA')}
                disabled={actionLoading.EXPORTERSINDIA !== null}
                className="border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                {actionLoading.EXPORTERSINDIA === 'test' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Connection
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleSyncNow('EXPORTERSINDIA')}
                disabled={actionLoading.EXPORTERSINDIA !== null || !configs.EXPORTERSINDIA || !configs.EXPORTERSINDIA.enabled}
                className="border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                {actionLoading.EXPORTERSINDIA === 'sync' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sync Now
              </Button>
              <Button
                onClick={() => handleSave('EXPORTERSINDIA')}
                disabled={actionLoading.EXPORTERSINDIA !== null}
                className="bg-primary text-white hover:bg-primary/90"
              >
                {actionLoading.EXPORTERSINDIA === 'save' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* -------------------- WHATSAPP RECIPIENTS SECTION -------------------- */}
      <Card className="border border-slate-700 bg-slate-900/60 text-white shadow-xl backdrop-blur">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle className="text-xl font-bold text-white">WhatsApp Notifications</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Configure mobile numbers to receive instant WhatsApp alerts when new enquiries are received from B2B marketplaces.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddRecipient} className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-end bg-slate-950/40 p-4 rounded-lg border border-slate-850">
            <div className="space-y-2">
              <Label htmlFor="rep_name">Staff Name</Label>
              <Input
                id="rep_name"
                placeholder="e.g. Sales Manager"
                value={newRecipientName}
                onChange={(e) => setNewRecipientName(e.target.value)}
                className="border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rep_mobile">Mobile Number (with country code)</Label>
              <Input
                id="rep_mobile"
                placeholder="e.g. 919876543210"
                value={newRecipientMobile}
                onChange={(e) => setNewRecipientMobile(e.target.value)}
                className="border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-primary"
              />
            </div>
            <div>
              <Button
                type="submit"
                disabled={addingRecipient}
                className="w-full bg-primary text-white hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                {addingRecipient ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add Recipient
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Staff Name</th>
                  <th className="px-4 py-3">Mobile Number</th>
                  <th className="px-4 py-3 text-center">Enabled</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/20">
                {recipients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No recipients configured. Add a staff number above to start receiving alerts.
                    </td>
                  </tr>
                ) : (
                  recipients.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/20">
                      <td className="px-4 py-3 font-medium text-white">{r.name}</td>
                      <td className="px-4 py-3 text-slate-400">{r.mobile}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRecipient(r.id, r.enabled)}
                          className="mx-auto block"
                        >
                          {r.enabled ? (
                            <ToggleRight className="h-6 w-6 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-slate-600" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteRecipient(r.id)}
                          className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* -------------------- SYNC HISTORY SECTION -------------------- */}
      <Card className="border border-slate-700 bg-slate-900/60 text-white shadow-xl backdrop-blur">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-bold text-white">Sync History</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Audit logs of automatic and manual B2B marketplace synchronization attempts.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={logsPlatformFilter}
              onChange={(e) => {
                setLogsPlatformFilter(e.target.value as any)
                setLogsOffset(0)
              }}
              className="rounded-md border border-slate-700 bg-slate-950 p-1.5 text-xs text-white focus:border-primary focus:outline-none"
            >
              <option value="ALL">All Platforms</option>
              <option value="INDIAMART">IndiaMART</option>
              <option value="TRADEINDIA">TradeIndia</option>
              <option value="EXPORTERSINDIA">ExportersIndia</option>
              <option value="ALIBABA">Alibaba</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSyncLogs}
              disabled={logsLoading}
              className="border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-1.5 px-2.5 h-8 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Started At</th>
                  <th className="px-4 py-3">Finished At</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3 text-center">New Leads</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Error / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/20">
                {logsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary mb-2" />
                      Loading logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No synchronization logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const startLocal = new Date(log.started_at).toLocaleString()
                    const finishLocal = log.finished_at ? new Date(log.finished_at).toLocaleString() : '—'
                    
                    const formatDuration = (ms: number | null | undefined) => {
                      if (ms === null || ms === undefined) return '—'
                      if (ms < 1000) return `${ms}ms`
                      return `${(ms / 1000).toFixed(1)}s`
                    }

                    return (
                      <tr key={log.id} className="hover:bg-slate-800/20 text-xs">
                        <td className="px-4 py-3 font-semibold text-white">{log.platform}</td>
                        <td className="px-4 py-3 text-slate-400">{startLocal}</td>
                        <td className="px-4 py-3 text-slate-400">{finishLocal}</td>
                        <td className="px-4 py-3 text-slate-400">{formatDuration(log.duration)}</td>
                        <td className="px-4 py-3 text-center font-medium">
                          {log.records_imported > 0 ? (
                            <span className="text-emerald-400 font-bold">+{log.records_imported}</span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                            log.status === 'SUCCESS' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                            log.status === 'FAILED' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
                            'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[200px] truncate text-slate-400" title={log.error_message || ''}>
                          {log.error_message || '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {logsCount > logsLimit && (
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
              <span>
                Showing <span className="font-semibold text-white">{logsOffset + 1}</span> to{' '}
                <span className="font-semibold text-white">
                  {Math.min(logsOffset + logsLimit, logsCount)}
                </span>{' '}
                of <span className="font-semibold text-white">{logsCount}</span> entries
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={logsOffset === 0}
                  onClick={() => setLogsOffset((prev) => Math.max(0, prev - logsLimit))}
                  className="border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1 px-2.5 h-8 text-xs font-semibold"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={logsOffset + logsLimit >= logsCount}
                  onClick={() => setLogsOffset((prev) => prev + logsLimit)}
                  className="border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1 px-2.5 h-8 text-xs font-semibold"
                >
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
