/**
 * useFollowups — follow-up task management for B2B leads.
 *
 * Two modes:
 *   1. Account-level: all pending follow-ups across all leads (dashboard widget)
 *   2. Lead-level: all tasks for a specific lead (lead detail page)
 *
 * Usage:
 *   // Account-level (dashboard)
 *   const { tasks, loading, refetch } = useFollowups()
 *
 *   // Lead-level (detail page)
 *   const { tasks, loading, createTask, updateTaskStatus, refetch } = useFollowups({ leadId })
 */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FollowupTask {
  id: string
  account_id: string
  lead_id: string
  title: string
  description: string | null
  due_at: string | null
  status: 'pending' | 'completed' | 'cancelled'
  assigned_to: string | null
  created_at: string
  updated_at: string
  assignee?: {
    id: string
    full_name: string
    avatar_url: string | null
  } | null
  lead?: {
    id: string
    buyer_name: string | null
    company_name: string | null
    platform: string
    product_name: string | null
  } | null
}

export interface CreateFollowupInput {
  title: string
  description?: string
  due_at?: string | null
  assigned_to?: string | null
}

export interface UseFollowupsOptions {
  /** If provided, only fetches tasks for this specific lead */
  leadId?: string
  /** If true, also fetches completed/cancelled tasks (account-level only) */
  includeCompleted?: boolean
}

export interface UseFollowupsReturn {
  tasks: FollowupTask[]
  loading: boolean
  refetch: () => void
  createTask: (input: CreateFollowupInput) => Promise<FollowupTask | null>
  updateTaskStatus: (taskId: string, status: 'completed' | 'cancelled') => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFollowups(options: UseFollowupsOptions = {}): UseFollowupsReturn {
  const { accountId } = useAuth()
  const supabase = createClient()
  const { leadId, includeCompleted = false } = options

  const [tasks, setTasks] = useState<FollowupTask[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    if (!accountId) return

    setLoading(true)
    try {
      let query = supabase
        .from('followup_tasks')
        .select(
          `
          id,
          account_id,
          lead_id,
          title,
          description,
          due_at,
          status,
          assigned_to,
          created_at,
          updated_at,
          assignee:profiles!assigned_to (
            id,
            full_name,
            avatar_url
          )
          ${!leadId ? `,
          lead:b2b_leads!lead_id (
            id,
            buyer_name,
            company_name,
            platform,
            product_name
          )` : ''}
        `
        )
        .eq('account_id', accountId)
        .order('due_at', { ascending: true, nullsFirst: false })

      if (leadId) {
        query = query.eq('lead_id', leadId)
      }

      if (!includeCompleted) {
        query = query.eq('status', 'pending')
      }

      const { data, error } = await query

      if (error) throw error

      setTasks((data as unknown as FollowupTask[]) ?? [])
    } catch (err) {
      console.error('[useFollowups] Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [accountId, leadId, includeCompleted, supabase])

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchTasks()
    })
  }, [fetchTasks])

  /**
   * Creates a new follow-up task for the current lead.
   * Only works in lead-level mode (leadId must be provided).
   */
  const createTask = useCallback(
    async (input: CreateFollowupInput): Promise<FollowupTask | null> => {
      if (!accountId || !leadId) {
        console.warn('[useFollowups] createTask requires a leadId')
        return null
      }

      try {
        const { data, error } = await supabase
          .from('followup_tasks')
          .insert({
            account_id: accountId,
            lead_id: leadId,
            title: input.title.trim(),
            description: input.description?.trim() || null,
            due_at: input.due_at ? new Date(input.due_at).toISOString() : null,
            assigned_to: input.assigned_to || null,
            status: 'pending',
          })
          .select(
            `
            id,
            account_id,
            lead_id,
            title,
            description,
            due_at,
            status,
            assigned_to,
            created_at,
            updated_at,
            assignee:profiles!assigned_to (
              id,
              full_name,
              avatar_url
            )
          `
          )
          .single()

        if (error) {
          toast.error(`Failed to create task: ${error.message}`)
          throw error
        }

        toast.success("Follow-up task created successfully")
        setTasks((prev) => [...prev, data as unknown as FollowupTask])
        return data as unknown as FollowupTask
      } catch (err) {
        console.error('[useFollowups] Failed to create task:', err)
        return null
      }
    },
    [accountId, leadId, supabase]
  )

  /**
   * Marks a task as completed or cancelled.
   */
  const updateTaskStatus = useCallback(
    async (taskId: string, status: 'completed' | 'cancelled') => {
      try {
        const { error } = await supabase
          .from('followup_tasks')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', taskId)
          .eq('account_id', accountId)

        if (error) {
          toast.error(`Failed to update task status: ${error.message}`)
          throw error
        }

        toast.success(`Task marked as ${status}`)
        setTasks((prev) =>
          includeCompleted
            ? prev.map((t) => (t.id === taskId ? { ...t, status } : t))
            : prev.filter((t) => t.id !== taskId) // remove from pending list
        )
      } catch (err) {
        console.error('[useFollowups] Failed to update task status:', err)
      }
    },
    [accountId, includeCompleted, supabase]
  )

  return { tasks, loading, refetch: fetchTasks, createTask, updateTaskStatus }
}
