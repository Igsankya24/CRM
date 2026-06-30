"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Calendar,
  CheckCircle2,
  Phone,
  MessageSquare,
  Clock,
  Loader2
} from 'lucide-react'
import type { FollowupTaskItem } from '@/lib/dashboard/types'
import { Button } from '@/components/ui/button'

interface FollowupCenterProps {
  tasks: FollowupTaskItem[]
  onRefresh: () => void
}

type TabType = 'today' | 'missed' | 'upcoming' | 'completed'

export function FollowupCenter({ tasks, onRefresh }: FollowupCenterProps) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<TabType>('today')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  
  // Reschedule form state
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')

  // Categorize tasks
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const categorizedTasks = {
    today: tasks.filter((t) => {
      if (t.status !== 'pending' || !t.dueAt) return false
      const due = new Date(t.dueAt)
      return due >= todayStart && due <= todayEnd
    }),
    missed: tasks.filter((t) => {
      if (t.status !== 'pending' || !t.dueAt) return false
      const due = new Date(t.dueAt)
      return due < todayStart
    }),
    upcoming: tasks.filter((t) => {
      if (t.status !== 'pending' || !t.dueAt) return false
      const due = new Date(t.dueAt)
      return due > todayEnd
    }),
    completed: tasks.filter((t) => t.status === 'completed')
  }

  const activeTasks = categorizedTasks[activeTab]

  // Handle Mark as Completed
  const handleComplete = async (taskId: string) => {
    setUpdatingId(taskId)
    try {
      const { error } = await supabase
        .from('followup_tasks')
        .update({ status: 'completed' })
        .eq('id', taskId)

      if (error) throw error

      toast.success('Task marked as completed!')
      onRefresh()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      toast.error(errorMsg || 'Failed to update task status')
    } finally {
      setUpdatingId(null)
    }
  }

  // Handle Reschedule
  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rescheduleTaskId || !rescheduleDate) return
    setUpdatingId(rescheduleTaskId)

    try {
      const { error } = await supabase
        .from('followup_tasks')
        .update({ due_at: new Date(rescheduleDate).toISOString() })
        .eq('id', rescheduleTaskId)

      if (error) throw error

      toast.success('Task rescheduled successfully!')
      setRescheduleTaskId(null)
      setRescheduleDate('')
      onRefresh()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      toast.error(errorMsg || 'Failed to reschedule task')
    } finally {
      setUpdatingId(null)
    }
  }

  const formatDue = (dateStr: string | null) => {
    if (!dateStr) return 'No due date'
    const d = new Date(dateStr)
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const tabOptions: { label: string; value: TabType; count: number; badgeColor: string }[] = [
    { label: "Today's", value: 'today', count: categorizedTasks.today.length, badgeColor: 'bg-primary/20 text-primary' },
    { label: 'Missed', value: 'missed', count: categorizedTasks.missed.length, badgeColor: 'bg-rose-500/10 text-rose-500' },
    { label: 'Upcoming', value: 'upcoming', count: categorizedTasks.upcoming.length, badgeColor: 'bg-sky-500/10 text-sky-500' },
    { label: 'Completed', value: 'completed', count: categorizedTasks.completed.length, badgeColor: 'bg-emerald-500/10 text-emerald-500' }
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Follow-up Center</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Manage schedule reminders and call tasks</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border self-start">
          {tabOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setActiveTab(opt.value)}
              className={`text-[10px] font-bold h-7 px-2.5 rounded-md flex items-center gap-1.5 transition-all ${
                activeTab === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
              {opt.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${opt.badgeColor}`}>
                  {opt.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
        {activeTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground italic">No follow-up tasks in this category.</p>
          </div>
        ) : (
          activeTasks.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-border bg-muted/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-muted-foreground/25"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-foreground">{t.title}</span>
                  {t.buyerName && t.buyerName !== 'N/A' && (
                    <span className="text-[10px] text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">
                      Buyer: {t.buyerName}
                    </span>
                  )}
                </div>
                {t.description && (
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{t.description}</p>
                )}
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDue(t.dueAt)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 self-end sm:self-center">
                {/* Dial */}
                {t.mobile && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(`tel:${t.mobile}`, '_self')}
                    className="h-7 w-7 p-0 hover:bg-sky-500/10 text-sky-500"
                    title="Call Contact"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </Button>
                )}

                {/* WhatsApp */}
                {t.mobile && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/inbox?phone=${encodeURIComponent(t.mobile || '')}&name=${encodeURIComponent(t.buyerName || '')}&docType=enquiry&docId=${t.leadId}`)}
                    className="h-7 w-7 p-0 hover:bg-emerald-500/10 text-emerald-500"
                    title="WhatsApp Message"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </Button>
                )}

                {/* Reschedule Calendar */}
                {t.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRescheduleTaskId(t.id)
                      setRescheduleDate(t.dueAt ? t.dueAt.slice(0, 16) : '')
                    }}
                    className="h-7 px-2 text-[10px] border border-border hover:bg-muted text-muted-foreground"
                  >
                    Reschedule
                  </Button>
                )}

                {/* Complete checklist */}
                {t.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={updatingId === t.id}
                    onClick={() => handleComplete(t.id)}
                    className="h-7 w-7 p-0 hover:bg-emerald-500/10 text-emerald-500"
                    title="Mark Completed"
                  >
                    {updatingId === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reschedule calendar dialog */}
      {rescheduleTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              Reschedule Task
            </h3>
            
            <form onSubmit={handleReschedule} className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  New Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRescheduleTaskId(null)}
                  className="text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updatingId === rescheduleTaskId}
                  className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {updatingId === rescheduleTaskId ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Confirm Reschedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
