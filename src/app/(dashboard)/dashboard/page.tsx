"use client"

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  MessageSquare,
  Flame,
  Hourglass,
  Clock,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  ExternalLink,
  ChevronRight,
  Database,
  Building,
  MapPin,
  RefreshCw
} from 'lucide-react'

import {
  loadCrmOverview,
  loadB2BPlatformStats,
  loadWhatsAppStats,
  loadAIInsightsStats,
  loadManagerViewStats,
  loadAiWorkflowStats
} from '@/lib/dashboard/queries'

import type {
  KpiCardData,
  LeadSourceData,
  PipelineStageData,
  FollowupTaskItem,
  SystemNotificationItem,
  B2BPlatformStats,
  WhatsAppStatsData,
  AiInsightsData,
  AiWorkflowStats,
  ManagerLeaderboardItem
} from '@/lib/dashboard/types'

// Widgets imports
import { MetricCardSparkline } from '@/components/dashboard/metric-card-sparkline'
import { RealtimeLeadFeed } from '@/components/dashboard/realtime-lead-feed'
import { LeadSourceChart } from '@/components/dashboard/lead-source-chart'
import { SalesPipelineStages } from '@/components/dashboard/sales-pipeline-stages'
import { WhatsAppAnalyticsGrid } from '@/components/dashboard/whatsapp-analytics-grid'
import { AiInsightsWidget } from '@/components/dashboard/ai-insights-widget'
import { FollowupCenter } from '@/components/dashboard/followup-center'
import { StaffLeaderboard } from '@/components/dashboard/staff-leaderboard'
import { NotificationCenterWidget } from '@/components/dashboard/notification-center-widget'
import { Button } from '@/components/ui/button'

type TabType = 'crm' | 'b2b' | 'whatsapp' | 'ai' | 'manager'
const ACTIVE_TAB_STORAGE_KEY = 'wacrm.dashboard.active-tab'

export default function DashboardPage() {
  const supabase = createClient()
  const { accountId } = useAuth()

  const [activeTab, setActiveTab] = useState<TabType>('crm')
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90 | 365>(30)

  // Caching states per tab
  const [crmData, setCrmData] = useState<{
    kpis: Record<string, KpiCardData>
    leadSources: LeadSourceData[]
    followups: FollowupTaskItem[]
    notifications: SystemNotificationItem[]
  } | null>(null)
  const [crmLoading, setCrmLoading] = useState(true)

  const [b2bStats, setB2bStats] = useState<B2BPlatformStats[] | null>(null)
  const [b2bLoading, setB2bLoading] = useState(true)
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null)

  const [whatsappStats, setWhatsappStats] = useState<WhatsAppStatsData | null>(null)
  const [whatsappLoading, setWhatsappLoading] = useState(true)

  const [aiInsights, setAiInsights] = useState<AiInsightsData | null>(null)
  const [aiWorkflow, setAiWorkflow] = useState<AiWorkflowStats | null>(null)
  const [aiLoading, setAiLoading] = useState(true)

  const [managerData, setManagerData] = useState<{ leaderboard: ManagerLeaderboardItem[] } | null>(null)
  const [managerLoading, setManagerLoading] = useState(true)

  // Initialize active tab from localStorage to remember selected tab
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const stored = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)
        if (stored && ['crm', 'b2b', 'whatsapp', 'ai', 'manager'].includes(stored)) {
          setActiveTab(stored as TabType)
        }
      } catch {}
    })
  }, [])

  // Save selected tab choice
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab)
    } catch {}
  }

  // --- Data Fetching Operations ---

  const fetchCrmData = useCallback(async () => {
    if (!accountId) return
    setCrmLoading(true)
    try {
      const data = await loadCrmOverview(supabase, accountId, rangeDays)
      setCrmData(data)
    } catch (err) {
      console.error('[Dashboard] CRM overview load failed:', err)
    } finally {
      setCrmLoading(false)
    }
  }, [accountId, rangeDays, supabase])

  const fetchB2bStats = useCallback(async () => {
    if (!accountId) return
    setB2bLoading(true)
    try {
      const data = await loadB2BPlatformStats(supabase, accountId)
      setB2bStats(data)
    } catch (err) {
      console.error('[Dashboard] B2B stats load failed:', err)
    } finally {
      setB2bLoading(false)
    }
  }, [accountId, supabase])

  const fetchWhatsappStats = useCallback(async () => {
    if (!accountId) return
    setWhatsappLoading(true)
    try {
      const data = await loadWhatsAppStats(supabase, accountId)
      setWhatsappStats(data)
    } catch (err) {
      console.error('[Dashboard] WhatsApp stats load failed:', err)
    } finally {
      setWhatsappLoading(false)
    }
  }, [accountId, supabase])

  const fetchAiData = useCallback(async () => {
    if (!accountId) return
    setAiLoading(true)
    try {
      const [insights, workflow] = await Promise.all([
        loadAIInsightsStats(supabase, accountId),
        loadAiWorkflowStats(supabase, accountId),
      ])
      setAiInsights(insights)
      setAiWorkflow(workflow)
    } catch (err) {
      console.error('[Dashboard] AI insights load failed:', err)
    } finally {
      setAiLoading(false)
    }
  }, [accountId, supabase])

  const fetchManagerData = useCallback(async () => {
    if (!accountId) return
    setManagerLoading(true)
    try {
      const data = await loadManagerViewStats(supabase, accountId)
      setManagerData(data)
    } catch (err) {
      console.error('[Dashboard] Manager data load failed:', err)
    } finally {
      setManagerLoading(false)
    }
  }, [accountId, supabase])

  // Triggers loading when activeTab changes
  useEffect(() => {
    Promise.resolve().then(() => {
      if (activeTab === 'crm') {
        fetchCrmData()
      } else if (activeTab === 'b2b') {
        fetchB2bStats()
      } else if (activeTab === 'whatsapp') {
        fetchWhatsappStats()
      } else if (activeTab === 'ai') {
        fetchAiData()
      } else if (activeTab === 'manager') {
        fetchManagerData()
      }
    })
  }, [activeTab, fetchCrmData, fetchB2bStats, fetchWhatsappStats, fetchAiData, fetchManagerData])

  // Handle Sync Sweeper manually
  const handleManualSync = async (platform: string) => {
    setSyncingPlatform(platform)
    try {
      const res = await fetch(`/api/integrations/${platform.toLowerCase()}/sync`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Sync failed')
      fetchB2bStats()
    } catch (err) {
      console.error('Manual sync failed:', err)
    } finally {
      setSyncingPlatform(null)
    }
  }

  // --- Rendering Helpers ---

  const renderLoader = (message: string) => (
    <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-card">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <span className="mt-2.5 text-xs text-muted-foreground font-semibold">{message}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header (Keep existing structure) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">CRM Command Dashboard</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Unified control center displaying live leads flow, staff metrics, and AI recommendations.
          </p>
        </div>

        {/* Dashboard Tabs Selector */}
        <div className="flex flex-wrap gap-1 bg-muted border border-border p-1 rounded-lg self-start">
          {(['crm', 'b2b', 'whatsapp', 'ai', 'manager'] as TabType[]).map((tab) => {
            const labels = {
              crm: 'CRM Overview',
              b2b: 'B2B Marketplace',
              whatsapp: 'WhatsApp',
              ai: 'AI Insights',
              manager: 'Manager View'
            }
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`text-[10px] uppercase tracking-wider font-bold h-7 px-3.5 rounded-md transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {labels[tab]}
              </button>
            )
          })}
        </div>
      </div>

      {/* TABS CONTAINER */}

      {/* 1. CRM OVERVIEW TAB */}
      {activeTab === 'crm' && (
        crmLoading && !crmData ? (
          renderLoader('Loading CRM Overview metrics...')
        ) : crmData ? (
          <div className="space-y-6">
            {/* ROW 1: EXECUTIVE SUMMARY KPI CARDS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <MetricCardSparkline
                title="Total Leads"
                value={crmData.kpis.totalLeads.value}
                icon={Database}
                deltaPercent={crmData.kpis.totalLeads.deltaPercent}
                todayChange={crmData.kpis.totalLeads.todayChange}
                sparkline={crmData.kpis.totalLeads.sparkline}
                status={crmData.kpis.totalLeads.status}
              />
              <MetricCardSparkline
                title="Today's Leads"
                value={crmData.kpis.todayLeads.value}
                icon={Sparkles}
                deltaPercent={crmData.kpis.todayLeads.deltaPercent}
                todayChange={crmData.kpis.todayLeads.todayChange}
                sparkline={crmData.kpis.todayLeads.sparkline}
                status={crmData.kpis.todayLeads.status}
              />
              <MetricCardSparkline
                title="Open Leads"
                value={crmData.kpis.openLeads.value}
                icon={Hourglass}
                sparkline={crmData.kpis.openLeads.sparkline}
                status={crmData.kpis.openLeads.status}
              />
              <MetricCardSparkline
                title="Hot Leads"
                value={crmData.kpis.hotLeads.value}
                icon={Flame}
                sparkline={crmData.kpis.hotLeads.sparkline}
                status={crmData.kpis.hotLeads.status}
              />
              <MetricCardSparkline
                title="Converted Leads"
                value={crmData.kpis.convertedLeads.value}
                icon={ShieldCheck}
                sparkline={crmData.kpis.convertedLeads.sparkline}
                status={crmData.kpis.convertedLeads.status}
              />
              <MetricCardSparkline
                title="Expected Revenue"
                value={crmData.kpis.expectedRevenue.value}
                icon={TrendingUp}
                sparkline={crmData.kpis.expectedRevenue.sparkline}
                status={crmData.kpis.expectedRevenue.status}
              />
            </div>

            {/* ROW 4 & ROW 5: CHARTS & SALES PIPELINE */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="lg:col-span-2 w-full min-w-0 overflow-hidden">
                <LeadSourceChart
                  data={crmData.leadSources}
                  onRangeChange={(r) => {
                    setRangeDays(r)
                  }}
                />
              </div>
              <div className="lg:col-span-3">
                {/* Mock or fetch proper pipeline stages structure */}
                <SalesPipelineStages
                  stagesData={[
                    { stage: 'New', count: crmData.kpis.openLeads.todayChange || 4, revenue: 45000, conversionRate: 15, color: 'bg-sky-500' },
                    { stage: 'Qualified', count: crmData.kpis.hotLeads.todayChange || 3, revenue: 85000, conversionRate: 30, color: 'bg-indigo-500' },
                    { stage: 'Quotation Sent', count: 5, revenue: 120000, conversionRate: 50, color: 'bg-amber-500' },
                    { stage: 'Negotiation', count: 2, revenue: 60000, conversionRate: 75, color: 'bg-purple-500' },
                    { stage: 'Won', count: crmData.kpis.convertedLeads.todayChange || 8, revenue: 320000, conversionRate: 100, color: 'bg-emerald-500' }
                  ]}
                />
              </div>
            </div>

            {/* ROW 8 & ROW 10: FOLLOW-UP CENTER & NOTIFICATION CENTER */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FollowupCenter
                tasks={crmData.followups}
                onRefresh={fetchCrmData}
              />
              <NotificationCenterWidget
                notifications={crmData.notifications}
              />
            </div>
          </div>
        ) : null
      )}

      {/* 2. B2B MARKETPLACE TAB */}
      {activeTab === 'b2b' && (
        b2bLoading && !b2bStats ? (
          renderLoader('Loading B2B Lead Marketplace...')
        ) : b2bStats ? (
          <div className="space-y-6">
            {/* ROW 2: B2B MARKETPLACE CARDS */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {b2bStats.map((plat) => {
                const colors = {
                  INDIAMART: 'border-sky-500/30 text-sky-500',
                  TRADEINDIA: 'border-amber-500/30 text-amber-500',
                  EXPORTERSINDIA: 'border-teal-500/30 text-teal-500'
                }
                const activeColor = colors[plat.platform] || 'border-slate-800'
                
                return (
                  <div key={plat.platform} className={`rounded-xl border border-border bg-card p-5 space-y-4 hover:border-muted-foreground/30 transition`}>
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <span className={`text-xs font-bold uppercase tracking-wider ${activeColor}`}>
                        {plat.platform}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {/* Status Light */}
                        <span className={`h-2 w-2 rounded-full ${
                          plat.apiStatus === 'healthy' ? 'bg-emerald-500 animate-pulse' :
                          plat.apiStatus === 'delayed' ? 'bg-amber-500' : 'bg-rose-500'
                        }`} />
                        <span className="text-[10px] text-muted-foreground font-semibold capitalize">
                          {plat.apiStatus}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/30 p-2 rounded">
                        <div className="text-[9px] text-muted-foreground font-bold uppercase">Total</div>
                        <div className="text-sm font-bold text-foreground mt-0.5">{plat.totalLeads}</div>
                      </div>
                      <div className="bg-muted/30 p-2 rounded">
                        <div className="text-[9px] text-muted-foreground font-bold uppercase">Today</div>
                        <div className="text-sm font-bold text-foreground mt-0.5">{plat.todayLeads}</div>
                      </div>
                      <div className="bg-muted/30 p-2 rounded">
                        <div className="text-[9px] text-muted-foreground font-bold uppercase">Pending</div>
                        <div className="text-sm font-bold text-foreground mt-0.5">{plat.pendingLeads}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 font-semibold">
                      <span>Conversion Rate:</span>
                      <span className="font-bold text-foreground">{plat.conversionRate.toFixed(1)}%</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="text-[9px] text-muted-foreground">
                        Last Sync: {plat.lastSyncTime ? new Date(plat.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleManualSync(plat.platform)}
                        disabled={syncingPlatform === plat.platform}
                        className="text-[9px] h-6 px-2 border border-border text-muted-foreground flex items-center gap-1"
                      >
                        {syncingPlatform === plat.platform ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-2.5 w-2.5" />
                        )}
                        Sync Now
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ROW 3: REAL-TIME LEAD FEED */}
            <RealtimeLeadFeed />
          </div>
        ) : null
      )}

      {/* 3. WHATSAPP TAB */}
      {activeTab === 'whatsapp' && (
        whatsappLoading && !whatsappStats ? (
          renderLoader('Loading WhatsApp Analytics...')
        ) : whatsappStats ? (
          <div className="space-y-6">
            {/* ROW 6: WHATSAPP ANALYTICS GRID & ACTIONS */}
            <WhatsAppAnalyticsGrid data={whatsappStats} />
          </div>
        ) : null
      )}

      {/* 4. AI INSIGHTS TAB */}
      {activeTab === 'ai' && (
        aiLoading && !aiInsights ? (
          renderLoader('Analyzing AI insights...')
        ) : aiInsights ? (
          <div className="space-y-6">
            {/* AI WORKFLOW STATS (from sales agent pipeline) */}
            {aiWorkflow && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
                <AiStatCard label="AI Active Chats" value={aiWorkflow.aiActiveConversations} icon={<MessageSquare className="h-4 w-4" />} color="text-sky-400" />
                <AiStatCard label="AI Resolved" value={aiWorkflow.aiResolvedLeads} icon={<ShieldCheck className="h-4 w-4" />} color="text-emerald-400" />
                <AiStatCard label="Waiting for Human" value={aiWorkflow.waitingForHuman} icon={<Hourglass className="h-4 w-4" />} color="text-amber-400" highlight={aiWorkflow.waitingForHuman > 0} />
                <AiStatCard label="Hot Leads" value={aiWorkflow.hotLeads} icon={<Flame className="h-4 w-4" />} color="text-rose-400" highlight={aiWorkflow.hotLeads > 5} />
              </div>
            )}
            {/* ROW 7: AI RECOMMENDATION WIDGET */}
            <AiInsightsWidget data={aiInsights} />
          </div>
        ) : null
      )}

      {/* 5. MANAGER VIEW TAB */}
      {activeTab === 'manager' && (
        managerLoading && !managerData ? (
          renderLoader('Loading Manager dashboard...')
        ) : managerData ? (
          <div className="space-y-6">
            {/* ROW 9: STAFF PERFORMANCE LEADERBOARD */}
            <StaffLeaderboard leaderboard={managerData.leaderboard} />
          </div>
        ) : null
      )}
    </div>
  )
}

/** Compact AI stat card for the AI Insights tab */
function AiStatCard({ label, value, icon, color, highlight }: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl border bg-card p-4 transition-colors ${highlight ? 'border-amber-500/40 bg-amber-500/5' : 'border-border'}`}>
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 ${color}`}>
          {icon}
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-xl font-bold text-foreground">{value}</div>
        </div>
      </div>
    </div>
  )
}
