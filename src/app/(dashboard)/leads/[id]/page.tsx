'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFollowups, type FollowupTask, type CreateFollowupInput } from '@/hooks/use-followups'
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  Package,
  Hash,
  MessageSquare,
  Calendar,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
  ExternalLink,
  Clock,
  User,
  StickyNote,
  Flame,
  RotateCcw,
  ChevronRight,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import type { Quotation } from '@/types'
import { isValidUUID } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Assignee {
  id: string
  full_name: string
  avatar_url: string | null
}

interface B2BLead {
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
  assignee?: Assignee | null
}

interface StaffMember {
  id: string
  full_name: string
  avatar_url: string | null
}

// ─── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', icon: Clock },
  assigned: { label: 'Assigned', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: UserCheck },
  contacted: { label: 'Contacted', color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20', icon: MessageSquare },
  converted: { label: 'Converted', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'text-rose-400', bg: 'bg-rose-400/10 border-rose-400/20', icon: XCircle },
}

const PLATFORM_COLORS = {
  INDIAMART: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  TRADEINDIA: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  EXPORTERSINDIA: 'text-teal-400 bg-teal-400/10 border-teal-400/30',
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const leadId = params.id as string

  const [lead, setLead] = useState<B2BLead | null>(null)
  const [loading, setLoading] = useState(true)
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showFollowupModal, setShowFollowupModal] = useState(false)
  const [followupInput, setFollowupInput] = useState<CreateFollowupInput>({ title: '' })

  const {
    tasks,
    loading: tasksLoading,
    createTask,
    updateTaskStatus,
    refetch: refetchTasks,
  } = useFollowups({ leadId, includeCompleted: true })

  const [quotations, setQuotations] = useState<Pick<Quotation, 'id' | 'quotation_no' | 'entry_date' | 'grand_total' | 'status'>[]>([])
  const [loadingQuotations, setLoadingQuotations] = useState(false)

  const fetchQuotations = useCallback(async () => {
    setLoadingQuotations(true)
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('id, quotation_no, entry_date, grand_total, status')
        .eq('lead_id', leadId)
        .is('deleted_at', null)
        .order('entry_date', { ascending: false })
      if (error) throw error
      setQuotations(data || [])
    } catch (err) {
      console.error('Failed to fetch quotations:', err)
    } finally {
      setLoadingQuotations(false)
    }
  }, [leadId, supabase])

  useEffect(() => {
    fetchQuotations()
  }, [fetchQuotations])

  // ─── Data Loading ───────────────────────────────────────────────────────────

  const fetchLead = useCallback(async () => {
    if (!isValidUUID(leadId)) {
      setLoading(false)
      setLead(null)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('b2b_leads')
        .select(`
          *,
          assignee:profiles!assigned_to (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('id', leadId)
        .is('deleted_at', null)
        .single()

      if (error || !data) {
        console.error('[LeadDetail] Lead not found:', error)
        router.push('/leads')
        return
      }

      setLead(data as B2BLead)
      setNotes(data.notes || '')
    } catch (err) {
      console.error('[LeadDetail] Failed to fetch lead:', err)
    } finally {
      setLoading(false)
    }
  }, [leadId, supabase, router])

  const leadAccountId = lead?.account_id

  const fetchStaff = useCallback(async () => {
    if (!leadAccountId) return
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('account_id', leadAccountId)
      .eq('is_active', true)
      .order('full_name')

    setStaffList((data as StaffMember[]) ?? [])
  }, [leadAccountId, supabase])

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchLead()
    })
  }, [fetchLead])
  useEffect(() => {
    Promise.resolve().then(() => {
      fetchStaff()
    })
  }, [fetchStaff])

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleStatusChange = async (
    newStatus: 'assigned' | 'contacted' | 'converted',
    extra?: Record<string, string>
  ) => {
    if (!lead) return
    setStatusChanging(true)
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, ...extra }),
      })
      await fetchLead()
    } catch (err) {
      console.error('[LeadDetail] Status change failed:', err)
    } finally {
      setStatusChanging(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) return
    setStatusChanging(true)
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejection_reason: rejectionReason }),
      })
      setShowRejectModal(false)
      setRejectionReason('')
      await fetchLead()
    } catch (err) {
      console.error('[LeadDetail] Reject failed:', err)
    } finally {
      setStatusChanging(false)
    }
  }

  const handleAssign = async (staffId: string) => {
    if (!lead) return
    setAssigning(true)
    try {
      await fetch(`/api/leads/${leadId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId }),
      })
      await fetchLead()
    } catch (err) {
      console.error('[LeadDetail] Assign failed:', err)
    } finally {
      setAssigning(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!lead) return
    setSavingNotes(true)
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      setLead((prev) => prev ? { ...prev, notes } : prev)
    } catch (err) {
      console.error('[LeadDetail] Notes save failed:', err)
    } finally {
      setSavingNotes(false)
    }
  }

  const handleCreateFollowup = async () => {
    if (!followupInput.title.trim()) return
    const created = await createTask(followupInput)
    if (created) {
      setShowFollowupModal(false)
      setFollowupInput({ title: '' })
    }
  }

  // ─── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-6 bg-slate-900 border border-slate-800 rounded-xl my-8 max-w-2xl mx-auto w-full select-none">
        <h2 className="text-xl font-semibold text-white mb-2">No Lead Found</h2>
        <p className="text-sm text-slate-400 mb-6 max-w-md">
          The requested lead could not be loaded. It may have been deleted, or the URL may be invalid.
        </p>
        <Link
          href="/leads"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leads List
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[lead.status]
  const StatusIcon = statusCfg.icon
  const platformColor = PLATFORM_COLORS[lead.platform] || ''

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="mt-1 h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${platformColor}`}>
              {lead.platform}
            </span>
            <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusCfg.bg} ${statusCfg.color}`}>
              <StatusIcon className="h-3 w-3" />
              {statusCfg.label}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground truncate">
            {lead.buyer_name || lead.mobile || 'Unknown Buyer'}
          </h1>
          {lead.company_name && (
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {lead.company_name}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* LEFT COLUMN — Lead Info + Actions */}
        <div className="space-y-4 lg:col-span-2">

          {/* Lead Info Card */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Lead Information</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {lead.mobile && (
                <InfoRow icon={Phone} label="Mobile" value={lead.mobile} />
              )}
              {lead.alternate_mobile && (
                <InfoRow icon={Phone} label="Alternate Mobile" value={lead.alternate_mobile} />
              )}
              {lead.email && (
                <InfoRow icon={Mail} label="Email" value={lead.email} />
              )}
              {(lead.city || lead.state || lead.country) && (
                <InfoRow
                  icon={MapPin}
                  label="Location"
                  value={[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}
                />
              )}
              {lead.product_name && (
                <InfoRow icon={Package} label="Product" value={lead.product_name} />
              )}
              {lead.quantity && (
                <InfoRow icon={Hash} label="Quantity" value={lead.quantity} />
              )}
              <InfoRow
                icon={Calendar}
                label="Inquiry Date"
                value={lead.inquiry_at ? new Date(lead.inquiry_at).toLocaleString() : '--'}
              />
              <InfoRow
                icon={Hash}
                label="Lead ID"
                value={lead.external_lead_id}
              />
            </div>

            {/* Message */}
            {lead.message && (
              <div className="mt-2 rounded-lg bg-muted/30 border border-border p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Buyer Message
                </p>
                <p className="text-sm text-foreground leading-relaxed">{lead.message}</p>
              </div>
            )}

            {/* Rejection Reason */}
            {lead.status === 'rejected' && lead.rejection_reason && (
              <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-1.5 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Rejection Reason
                </p>
                <p className="text-sm text-foreground">{lead.rejection_reason}</p>
              </div>
            )}
          </div>

          {/* Status Actions */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Update Status</h2>
            <div className="flex flex-wrap gap-2">
              {lead.status !== 'contacted' && lead.status !== 'converted' && lead.status !== 'rejected' && (
                <ActionButton
                  icon={MessageSquare}
                  label="Mark as Contacted"
                  onClick={() => handleStatusChange('contacted')}
                  disabled={statusChanging}
                  color="purple"
                />
              )}
              {lead.status !== 'converted' && lead.status !== 'rejected' && (
                <ActionButton
                  icon={CheckCircle2}
                  label="Mark as Converted"
                  onClick={() => handleStatusChange('converted')}
                  disabled={statusChanging}
                  color="emerald"
                />
              )}
              {lead.status !== 'rejected' && lead.status !== 'converted' && (
                <ActionButton
                  icon={XCircle}
                  label="Reject Lead"
                  onClick={() => setShowRejectModal(true)}
                  disabled={statusChanging}
                  color="rose"
                />
              )}
              {lead.status === 'rejected' && (
                <ActionButton
                  icon={RotateCcw}
                  label="Reopen Lead"
                  onClick={() => handleStatusChange('contacted')}
                  disabled={statusChanging}
                  color="amber"
                />
              )}
            </div>
          </div>

          {/* Agent Notes */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              Agent Notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes about this lead..."
              rows={4}
              className="w-full resize-none rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 h-8 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition"
              >
                {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Save Notes
              </button>
            </div>
          </div>

          {/* Follow-up Tasks */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-400" />
                Follow-up Tasks
                {tasks.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {tasks.length}
                  </span>
                )}
              </h2>
              <button
                onClick={() => setShowFollowupModal(true)}
                className="flex items-center gap-1 text-xs font-semibold h-7 px-2.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Task
              </button>
            </div>

            {tasksLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No follow-up tasks yet.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <FollowupTaskRow
                    key={task.id}
                    task={task}
                    onComplete={() => updateTaskStatus(task.id, 'completed')}
                    onCancel={() => updateTaskStatus(task.id, 'cancelled')}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Linked Quotations Card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-400" />
                Linked Quotations
                {quotations.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {quotations.length}
                  </span>
                )}
              </h2>
              <button
                onClick={() => {
                  const params = new URLSearchParams({
                    company_name:   lead.company_name || lead.buyer_name || '',
                    contact_person: lead.buyer_name     ?? '',
                    mobile:         lead.mobile         ?? '',
                    alt_mobile:     lead.alternate_mobile ?? '',
                    email:          lead.email          ?? '',
                    address:        [lead.city, lead.state, lead.country].filter(Boolean).join(', '),
                    state:          lead.state          ?? '',
                    source:         lead.platform === 'INDIAMART' ? 'IndiaMART' : lead.platform === 'TRADEINDIA' ? 'TradeIndia' : lead.platform === 'EXPORTERSINDIA' ? 'ExportersIndia' : lead.platform || '',
                    lead_id:        lead.id,
                    subject:        lead.product_name   ? `Quotation for ${lead.product_name}` : '',
                    product_name:   lead.product_name   ?? '',
                  })
                  router.push(`/quotations/new?${params.toString()}`)
                }}
                className="flex items-center gap-1 text-xs font-semibold h-7 px-2.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Quotation
              </button>
            </div>

            {loadingQuotations ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : quotations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No quotations created for this lead yet.</p>
            ) : (
              <div className="space-y-2">
                {quotations.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/20 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/quotations/${q.id}`}
                        className="text-sm font-semibold text-primary hover:underline flex items-center gap-1.5"
                      >
                        {q.quotation_no}
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {q.entry_date} · <span className="font-semibold text-foreground">₹{Number(q.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </p>
                    </div>
                    <div className="shrink-0 ml-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                        q.status === 'draft' ? "bg-slate-500/10 text-slate-400 border-slate-500/20" :
                        q.status === 'sent' ? "bg-sky-500/10 text-sky-400 border-sky-500/20" :
                        q.status === 'accepted' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        q.status === 'rejected' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                        "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}>
                        {q.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN — Assignment + WhatsApp */}
        <div className="space-y-4">

          {/* Assignment Card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Assignment
            </h2>

            {lead.assignee ? (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {lead.assignee.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{lead.assignee.full_name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Assigned</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mb-4">Not yet assigned</p>
            )}

            {staffList.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {lead.assignee ? 'Re-assign to' : 'Assign to'}
                </p>
                {staffList.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => handleAssign(staff.id)}
                    disabled={assigning || lead.assigned_to === staff.id}
                    className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-xs font-semibold transition ${
                      lead.assigned_to === staff.id
                        ? 'bg-primary/10 text-primary border border-primary/30 cursor-default'
                        : 'border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
                    }`}
                  >
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {staff.full_name?.charAt(0).toUpperCase()}
                    </div>
                    {staff.full_name}
                    {lead.assigned_to === staff.id && (
                      <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions Card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {lead.mobile && (
                <Link
                  href={`/inbox?phone=${encodeURIComponent(lead.mobile)}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition group"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-emerald-400" />
                    Open WhatsApp Chat
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
                </Link>
              )}
              {lead.mobile && (
                <a
                  href={`tel:${lead.mobile}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition group"
                >
                  <span className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-400" />
                    Call Buyer
                  </span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition group"
                >
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-purple-400" />
                    Send Email
                  </span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                onClick={() => setShowFollowupModal(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition group"
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-amber-400" />
                  Schedule Follow-up
                </span>
                <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </button>
              <button
                onClick={() => {
                  const params = new URLSearchParams({
                    company_name:   lead.company_name || lead.buyer_name || '',
                    contact_person: lead.buyer_name     ?? '',
                    mobile:         lead.mobile         ?? '',
                    alt_mobile:     lead.alternate_mobile ?? '',
                    email:          lead.email          ?? '',
                    address:        [lead.city, lead.state, lead.country].filter(Boolean).join(', '),
                    state:          lead.state          ?? '',
                    source:         lead.platform === 'INDIAMART' ? 'IndiaMART' : lead.platform === 'TRADEINDIA' ? 'TradeIndia' : lead.platform === 'EXPORTERSINDIA' ? 'ExportersIndia' : lead.platform || '',
                    lead_id:        lead.id,
                    subject:        lead.product_name   ? `Quotation for ${lead.product_name}` : '',
                    product_name:   lead.product_name   ?? '',
                  })
                  router.push(`/quotations/new?${params.toString()}`)
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition group"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-400" />
                  Create Quotation
                </span>
                <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          </div>

          {/* WA Greeting Status */}
          {lead.wa_greeting_sent_at && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                WhatsApp Greeting Sent
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(lead.wa_greeting_sent_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <Modal onClose={() => setShowRejectModal(false)} title="Reject Lead">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejecting this lead. This will be saved for reporting.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Outside our service area, Budget mismatch, Duplicate enquiry..."
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-rose-500/50"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 h-8 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || statusChanging}
                className="flex items-center gap-1.5 px-4 h-8 rounded-lg bg-rose-500 text-white text-xs font-semibold disabled:opacity-50 hover:bg-rose-600 transition"
              >
                {statusChanging ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Confirm Reject
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Follow-up Modal */}
      {showFollowupModal && (
        <Modal onClose={() => setShowFollowupModal(false)} title="New Follow-up Task">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Title *
              </label>
              <input
                type="text"
                value={followupInput.title}
                onChange={(e) => setFollowupInput((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g., Send quotation, Follow up on sample"
                className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Due Date
              </label>
              <input
                type="datetime-local"
                value={followupInput.due_at || ''}
                onChange={(e) => setFollowupInput((p) => ({ ...p, due_at: e.target.value || null }))}
                className="mt-1 w-full rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Notes
              </label>
              <textarea
                value={followupInput.description || ''}
                onChange={(e) => setFollowupInput((p) => ({ ...p, description: e.target.value }))}
                placeholder="Additional context..."
                rows={2}
                className="mt-1 w-full resize-none rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowFollowupModal(false)}
                className="px-4 h-8 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFollowup}
                disabled={!followupInput.title.trim()}
                className="flex items-center gap-1.5 px-4 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 hover:bg-primary/90 transition"
              >
                <Plus className="h-3 w-3" />
                Create Task
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  color,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  disabled?: boolean
  color: 'purple' | 'emerald' | 'rose' | 'amber'
}) {
  const colors = {
    purple: 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10',
    emerald: 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10',
    rose: 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10',
    amber: 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 text-xs font-semibold h-8 px-3.5 rounded-lg border transition disabled:opacity-50 ${colors[color]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function FollowupTaskRow({
  task,
  onComplete,
  onCancel,
}: {
  task: FollowupTask
  onComplete: () => void
  onCancel: () => void
}) {
  const isOverdue = task.due_at && new Date(task.due_at) < new Date() && task.status === 'pending'
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      task.status === 'completed' ? 'border-emerald-500/10 bg-emerald-500/5 opacity-60' :
      task.status === 'cancelled' ? 'border-border opacity-40' :
      isOverdue ? 'border-rose-500/20 bg-rose-500/5' : 'border-border bg-muted/10'
    }`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.title}
        </p>
        {task.due_at && (
          <p className={`text-[10px] flex items-center gap-1 mt-0.5 ${isOverdue ? 'text-rose-400' : 'text-muted-foreground'}`}>
            <Clock className="h-2.5 w-2.5" />
            {new Date(task.due_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            {isOverdue && ' — Overdue'}
          </p>
        )}
        {task.assignee && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Assigned to {task.assignee.full_name}
          </p>
        )}
      </div>
      {task.status === 'pending' && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onComplete}
            className="h-6 w-6 flex items-center justify-center rounded text-emerald-400 hover:bg-emerald-500/10 transition"
            title="Complete"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
          <button
            onClick={onCancel}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition"
            title="Cancel"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
