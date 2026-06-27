// Shared result shapes the dashboard components consume. Centralised
// here so each component stays thin and the page-level loader wires
// them up without type gymnastics.

export interface MetricDelta {
  current: number
  previous: number
}

export interface MetricsBundle {
  activeConversations: MetricDelta
  newContactsToday: MetricDelta
  openDealsValue: number
  openDealsCount: number
  messagesSentToday: MetricDelta
}

export interface ConversationsSeriesPoint {
  day: string // YYYY-MM-DD local
  incoming: number
  outgoing: number
}

export interface PipelineStageSlice {
  id: string
  name: string
  color: string
  dealCount: number
  totalValue: number
}

export interface PipelineDonutData {
  stages: PipelineStageSlice[]
  totalValue: number
}

export interface ResponseTimeBucket {
  /** 0 = Mon … 6 = Sun (Monday-first). */
  dow: number
  /** Average first-response time in minutes. Null means no samples. */
  avgMinutes: number | null
  samples: number
}

export interface ResponseTimeSummary {
  buckets: ResponseTimeBucket[]
  thisWeekAvg: number | null
  lastWeekAvg: number | null
}

export type ActivityKind =
  | 'message'
  | 'deal'
  | 'broadcast'
  | 'automation'
  | 'contact'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  /** Primary line of text rendered in the feed. Pre-formatted. */
  text: string
  /** ISO timestamp the item happened at, drives relative-time + sort. */
  at: string
  /** Optional deep-link for the whole row (not all items have a target). */
  href?: string
}

// --- REDESIGNED DASHBOARD MODULE TYPES ---

export interface SparklinePoint {
  day: string
  value: number
}

export interface KpiCardData {
  title: string
  value: string
  deltaPercent: number
  todayChange: number
  sparkline: SparklinePoint[]
  status: 'positive' | 'warning' | 'critical'
}

export interface LeadSourceData {
  source: string
  count: number
  percentage: number
}

export interface PipelineStageData {
  stage: string
  count: number
  revenue: number
  conversionRate: number
  color: string
}

export interface FollowupTaskItem {
  id: string
  leadId: string
  buyerName: string
  title: string
  description: string | null
  dueAt: string | null
  status: 'pending' | 'completed' | 'cancelled'
  mobile?: string | null
}

export interface SystemNotificationItem {
  id: string
  type: 'lead' | 'message' | 'assignment' | 'ai' | 'system'
  message: string
  timestamp: string
  unread: boolean
}

export interface B2BPlatformStats {
  platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA'
  totalLeads: number
  todayLeads: number
  pendingLeads: number
  convertedLeads: number
  conversionRate: number
  lastSyncTime: string | null
  apiStatus: 'healthy' | 'delayed' | 'failed'
}

export interface WhatsAppStatsData {
  activeConversations: number
  unreadChats: number
  messagesToday: number
  responseRate: number
  pendingReplies: number
  broadcastStats: {
    sent: number
    delivered: number
    read: number
  }
  avgResponseTime: number
}

export interface AiSuggestionItem {
  id: string
  text: string
  category: 'hot' | 'inactive' | 'urgent' | 'high_conversion'
  confidence: number
}

export interface AiInsightsData {
  hotLeadsCount: number
  inactiveLeadsCount: number
  urgentFollowUpsCount: number
  highConversionLeadsCount: number
  suggestions: AiSuggestionItem[]
}

/** AI Workflow stats from the sales agent pipeline (Part 12) */
export interface AiWorkflowStats {
  aiActiveConversations: number
  aiResolvedLeads: number
  waitingForHuman: number
  assignedLeads: number
  hotLeads: number
  unreadMessages: number
  todaysOrders: number
  conversionRate: number
}

export interface ManagerLeaderboardItem {
  userId: string
  name: string
  avatarUrl: string | null
  assignedLeads: number
  whatsappConversations: number
  conversions: number
  responseTimeMinutes: number
  revenue: number
  isTopPerformer: boolean
}

