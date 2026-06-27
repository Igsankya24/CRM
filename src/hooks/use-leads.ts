/**
 * useLeads — paginated B2B lead list with real-time updates.
 *
 * Fetches from the `b2b_leads` table with filters, pagination,
 * and an optional Supabase Realtime subscription for live updates.
 *
 * Usage:
 *   const { leads, loading, totalCount, page, setPage, refetch } = useLeads({ platform: 'INDIAMART' })
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeadFilters {
  /** Filter to a specific B2B platform (INDIAMART, TRADEINDIA, EXPORTERSINDIA) */
  platform?: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | null
  /** Lead status filter */
  status?: 'pending' | 'assigned' | 'contacted' | 'converted' | 'rejected' | null
  /** Free-text search across buyer_name, company_name, mobile, email */
  search?: string
  /** Start of date range (ISO string) */
  startDate?: string | null
  /** End of date range (ISO string) */
  endDate?: string | null
}

export interface LeadRow {
  id: string
  account_id: string
  platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA'
  external_lead_id: string
  buyer_name: string | null
  company_name: string | null
  mobile: string | null
  alternate_mobile: string | null
  email: string | null
  city: string | null
  state: string | null
  country: string | null
  product_name: string | null
  quantity: string | null
  message: string | null
  status: 'pending' | 'assigned' | 'contacted' | 'converted' | 'rejected'
  rejection_reason: string | null
  notes: string | null
  assigned_to: string | null
  wa_greeting_sent_at: string | null
  received_at: string
  inquiry_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Joined relation
  assignee?: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
}

export interface UseLeadsOptions {
  filters?: LeadFilters
  pageSize?: number
  /** If true, subscribes to Supabase Realtime for live lead updates */
  realtime?: boolean
}

export interface UseLeadsReturn {
  leads: LeadRow[]
  loading: boolean
  totalCount: number
  page: number
  pageSize: number
  setPage: (page: number) => void
  refetch: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20

export function useLeads(options: UseLeadsOptions = {}): UseLeadsReturn {
  const { accountId } = useAuth()
  const supabase = createClient()

  const { filters = {}, pageSize = DEFAULT_PAGE_SIZE, realtime = false } = options

  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)

  // Track current filter/page in a ref so the realtime callback can use them
  const filtersRef = useRef(filters)
  const pageRef = useRef(page)

  useEffect(() => {
    filtersRef.current = filters
    pageRef.current = page
  }, [filters, page])

  const fetchLeads = useCallback(async () => {
    if (!accountId) return

    setLoading(true)
    try {
      const from = pageRef.current * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from('b2b_leads')
        .select(
          `
          *,
          assignee:profiles!assigned_to (
            id,
            full_name,
            avatar_url
          )
        `,
          { count: 'exact' }
        )
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .order('inquiry_at', { ascending: false, nullsFirst: false })
        .range(from, to)

      const f = filtersRef.current

      if (f.platform) {
        query = query.eq('platform', f.platform)
      }
      if (f.status) {
        query = query.eq('status', f.status)
      }
      if (f.startDate) {
        query = query.gte('inquiry_at', f.startDate)
      }
      if (f.endDate) {
        query = query.lte('inquiry_at', f.endDate)
      }
      if (f.search?.trim()) {
        const term = `%${f.search.trim()}%`
        query = query.or(
          `buyer_name.ilike.${term},company_name.ilike.${term},mobile.ilike.${term},email.ilike.${term},product_name.ilike.${term}`
        )
      }

      const { data, count, error } = await query

      if (error) throw error

      setLeads((data as LeadRow[]) ?? [])
      setTotalCount(count ?? 0)
    } catch (err) {
      console.error('[useLeads] Failed to fetch leads:', err)
    } finally {
      setLoading(false)
    }
  }, [accountId, pageSize, supabase])

  // Refetch whenever page or filters change
  useEffect(() => {
    Promise.resolve().then(() => {
      fetchLeads()
    })
  }, [fetchLeads, page, filters.platform, filters.status, filters.search, filters.startDate, filters.endDate])

  // Reset to page 0 when filters change
  useEffect(() => {
    Promise.resolve().then(() => {
      setPage(0)
    })
  }, [filters.platform, filters.status, filters.search, filters.startDate, filters.endDate])

  // Optional Realtime subscription
  useEffect(() => {
    if (!realtime || !accountId) return

    const channel = supabase
      .channel(`b2b_leads:account:${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'b2b_leads',
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          // Refetch on any change — inserts, updates, deletes
          fetchLeads()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [realtime, accountId, supabase, fetchLeads])

  return {
    leads,
    loading,
    totalCount,
    page,
    pageSize,
    setPage,
    refetch: fetchLeads,
  }
}
