'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  X,
  Phone,
  Mail,
  MapPin,
  Package,
  Building2,
  Hash,
  MessageSquare,
  Calendar,
  User,
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Plus,
  StickyNote,
  ExternalLink,
  Flame,
  ChevronRight,
  RotateCcw,
  Pencil,
  Copy,
  Check,
  Globe,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { B2BLead, Profile, Quotation } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useFollowups } from '@/hooks/use-followups'
import type { CreateFollowupInput } from '@/hooks/use-followups'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface LeadDetailPanelProps {
  lead: B2BLead | null
  staff: Profile[]
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
  onEdit: (lead: B2BLead) => void
  mapUIStatusToDB: (uiStatus: string, currentNotes: string | null | undefined) => { status: any; notes: string | null }
  getUIStatus: (lead: B2BLead) => string
  getStatusLabel: (status: string) => string
  getStatusBadge: (status: string) => string
}

const PLATFORM_BADGE: Record<string, string> = {
  INDIAMART: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  TRADEINDIA: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  EXPORTERSINDIA: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
}

const PLATFORM_LABELS: Record<string, string> = {
  INDIAMART: 'IndiaMART',
  TRADEINDIA: 'TradeIndia',
  EXPORTERSINDIA: 'ExportersIndia',
}

type PanelTab = 'overview' | 'notes' | 'followups' | 'quotations'

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-auto flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title={`Copy ${label}`}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

export function LeadDetailPanel({
  lead,
  staff,
  isOpen,
  onClose,
  onRefresh,
  onEdit,
  mapUIStatusToDB,
  getUIStatus,
  getStatusLabel,
  getStatusBadge,
}: LeadDetailPanelProps) {
  const supabase = createClient()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<PanelTab>('overview')
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [showFollowupForm, setShowFollowupForm] = useState(false)
  const [followupInput, setFollowupInput] = useState<CreateFollowupInput>({ title: '' })

  const [quotations, setQuotations] = useState<Pick<Quotation, 'id' | 'quotation_no' | 'entry_date' | 'grand_total' | 'status'>[]>([])
  const [loadingQuotations, setLoadingQuotations] = useState(false)

  const fetchQuotations = useCallback(async () => {
    if (!lead?.id) return
    setLoadingQuotations(true)
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('id, quotation_no, entry_date, grand_total, status')
        .eq('lead_id', lead.id)
        .is('deleted_at', null)
        .order('entry_date', { ascending: false })
      if (error) throw error
      setQuotations(data || [])
    } catch (err) {
      console.error('Failed to fetch quotations:', err)
    } finally {
      setLoadingQuotations(false)
    }
  }, [lead?.id, supabase])

  const {
    tasks,
    loading: tasksLoading,
    createTask,
    updateTaskStatus,
  } = useFollowups({ leadId: lead?.id ?? '', includeCompleted: true })

  useEffect(() => {
    if (lead) {
      setNotes(lead.notes || '')
      setActiveTab('overview')
      setQuotations([])
    }
  }, [lead?.id])

  useEffect(() => {
    if (lead?.id && activeTab === 'quotations') {
      fetchQuotations()
    }
  }, [lead?.id, activeTab, fetchQuotations])

  // Close on escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const handleSaveNotes = async () => {
    if (!lead) return
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error('Failed to save notes')
      toast.success('Notes saved')
      onRefresh()
    } catch {
      toast.error('Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  const handleStatusChange = async (newUiStatus: string) => {
    if (!lead) return
    setStatusChanging(true)
    try {
      const { status: dbStatus, notes: dbNotes } = mapUIStatusToDB(newUiStatus, lead.notes)
      const { error } = await supabase
        .from('b2b_leads')
        .update({ status: dbStatus, notes: dbNotes })
        .eq('id', lead.id)
      if (error) throw error
      toast.success(`Status updated to ${getStatusLabel(newUiStatus)}`)
      onRefresh()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setStatusChanging(false)
    }
  }

  const handleAssign = async (staffId: string | null) => {
    if (!lead) return
    setAssigning(true)
    try {
      const res = await fetch('/api/integrations/leads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, staffId }),
      })
      if (!res.ok) throw new Error('Failed to assign')
      toast.success(staffId ? 'Enquiry assigned' : 'Enquiry unassigned')
      onRefresh()
    } catch {
      toast.error('Failed to assign lead')
    } finally {
      setAssigning(false)
    }
  }

  const handleCreateFollowup = async () => {
    if (!followupInput.title.trim()) return
    const created = await createTask(followupInput)
    if (created) {
      setShowFollowupForm(false)
      setFollowupInput({ title: '' })
    }
  }

  if (!lead) return null

  const uiStatus = getUIStatus(lead)
  const statusBadge = getStatusBadge(uiStatus)
  const statusLabel = getStatusLabel(uiStatus)
  const platformBadge = PLATFORM_BADGE[lead.platform] || ''
  const platformLabel = PLATFORM_LABELS[lead.platform] || lead.platform

  const STATUS_ACTIONS = [
    { value: 'contacted', label: 'Mark Contacted', color: 'text-purple-400 border-purple-500/30 hover:bg-purple-500/10' },
    { value: 'quoted', label: 'Mark Quoted', color: 'text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10' },
    { value: 'converted', label: 'Convert', color: 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10' },
    { value: 'rejected', label: 'Reject', color: 'text-rose-400 border-rose-500/30 hover:bg-rose-500/10' },
  ].filter((a) => a.value !== uiStatus)

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-full max-w-[480px] bg-card border-l border-border flex flex-col shadow-2xl',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border p-4 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  platformBadge
                )}
              >
                {platformLabel}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                  statusBadge
                )}
              >
                {statusLabel}
              </span>
              {lead.deleted_at && (
                <span className="text-[9px] font-bold uppercase text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-full px-2 py-0.5">
                  Deleted
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-foreground truncate">
              {lead.buyer_name || lead.mobile || 'Unknown Buyer'}
            </h2>
            {lead.company_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                <Building2 className="h-3 w-3 shrink-0" />
                {lead.company_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(lead)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Edit Lead"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0 overflow-x-auto">
          {lead.mobile && (
            <a
              href={`/inbox?phone=${encodeURIComponent(lead.mobile)}`}
              className="flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
            >
              <MessageSquare className="h-3 w-3" />
              WhatsApp
            </a>
          )}
          {lead.mobile && (
            <a
              href={`tel:${lead.mobile}`}
              className="flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-colors whitespace-nowrap"
            >
              <Phone className="h-3 w-3" />
              Call
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-colors whitespace-nowrap"
            >
              <Mail className="h-3 w-3" />
              Email
            </a>
          )}
          <button
            type="button"
            onClick={() => { setActiveTab('followups'); setShowFollowupForm(true) }}
            className="flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
          >
            <Plus className="h-3 w-3" />
            Follow-up
          </button>
          <button
            type="button"
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
            className="flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/30 hover:bg-violet-500/20 transition-colors whitespace-nowrap"
          >
            <FileText className="h-3 w-3" />
            Quotation
          </button>
          <a
            href={`/leads/${lead.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors whitespace-nowrap ml-auto"
          >
            <ExternalLink className="h-3 w-3" />
            Full Page
          </a>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {(['overview', 'notes', 'followups', 'quotations'] as PanelTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 px-3 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2',
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab}
              {tab === 'followups' && tasks.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold">
                  {tasks.filter((t) => t.status === 'pending').length}
                </span>
              )}
              {tab === 'quotations' && quotations.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold">
                  {quotations.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="p-4 space-y-4">
              {/* Contact Info */}
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Contact Information
                </p>
                {lead.mobile && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-foreground flex-1">{lead.mobile}</span>
                    <CopyButton text={lead.mobile} label="mobile" />
                  </div>
                )}
                {lead.alternate_mobile && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground flex-1">{lead.alternate_mobile}</span>
                    <CopyButton text={lead.alternate_mobile} label="alt mobile" />
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground flex-1 truncate">{lead.email}</span>
                    <CopyButton text={lead.email} label="email" />
                  </div>
                )}
                {(lead.city || lead.state || lead.country) && (
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground flex-1">
                      {[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Product/Inquiry Info */}
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Inquiry Details
                </p>
                {lead.product_name && (
                  <div className="flex items-start gap-2.5">
                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-xs font-medium text-foreground">{lead.product_name}</span>
                  </div>
                )}
                {lead.quantity && (
                  <div className="flex items-center gap-2.5">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground">Qty: {lead.quantity}</span>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground">
                    {lead.inquiry_at
                      ? new Date(lead.inquiry_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {lead.external_lead_id}
                  </span>
                </div>
              </div>

              {/* Message */}
              {lead.message && (
                <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3" />
                    Buyer Message
                  </p>
                  <p className="text-xs text-foreground leading-relaxed">{lead.message}</p>
                </div>
              )}



              {/* Status Actions */}
              <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Update Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ACTIONS.slice(0, 3).map((action) => (
                    <button
                      key={action.value}
                      type="button"
                      onClick={() => handleStatusChange(action.value)}
                      disabled={statusChanging}
                      className={cn(
                        'flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold border transition-colors disabled:opacity-50',
                        action.color
                      )}
                    >
                      {statusChanging ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      {action.label}
                    </button>
                  ))}
                  {uiStatus === 'rejected' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('contacted')}
                      disabled={statusChanging}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reopen
                    </button>
                  )}
                </div>
              </div>

              {/* Assignment */}
              <div className="rounded-xl border border-border bg-muted/20 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Assignment
                </p>
                {lead.assignee ? (
                  <div className="flex items-center gap-2.5 mb-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <Avatar className="h-7 w-7">
                      {lead.assignee.avatar_url && (
                        <AvatarImage src={lead.assignee.avatar_url} />
                      )}
                      <AvatarFallback className="text-xs font-bold text-primary bg-primary/10">
                        {lead.assignee.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{lead.assignee.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">Currently Assigned</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mb-3">Not yet assigned</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {!lead.assigned_to && (
                    <span className="text-[10px] text-muted-foreground py-1">Assign to:</span>
                  )}
                  {lead.assigned_to && (
                    <button
                      type="button"
                      onClick={() => handleAssign(null)}
                      disabled={assigning}
                      className="h-7 px-2.5 rounded-full text-[10px] font-semibold border border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Unassign
                    </button>
                  )}
                  {staff.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleAssign(s.id)}
                      disabled={assigning || lead.assigned_to === s.id}
                      className={cn(
                        'h-7 px-2.5 rounded-full text-[10px] font-semibold border transition-colors disabled:opacity-60',
                        lead.assigned_to === s.id
                          ? 'border-primary/30 bg-primary/10 text-primary cursor-default'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
                      )}
                    >
                      {assigning ? <Loader2 className="h-3 w-3 animate-spin" /> : s.full_name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* NOTES TAB */}
          {activeTab === 'notes' && (
            <div className="p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <StickyNote className="h-3 w-3" />
                Agent Notes
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add internal notes about this lead..."
                rows={8}
                className="w-full resize-none rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Save Notes
                </button>
              </div>
            </div>
          )}

          {/* FOLLOW-UPS TAB */}
          {activeTab === 'followups' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Flame className="h-3 w-3 text-amber-400" />
                  Follow-up Tasks
                </p>
                <button
                  type="button"
                  onClick={() => setShowFollowupForm(!showFollowupForm)}
                  className="flex items-center gap-1 h-6 px-2.5 rounded-md border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add Task
                </button>
              </div>

              {/* New followup form */}
              {showFollowupForm && (
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
                  <input
                    type="text"
                    value={followupInput.title}
                    onChange={(e) => setFollowupInput((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Task title…"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="datetime-local"
                    value={followupInput.due_at || ''}
                    onChange={(e) => setFollowupInput((p) => ({ ...p, due_at: e.target.value || null }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <textarea
                    value={followupInput.description || ''}
                    onChange={(e) => setFollowupInput((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Notes (optional)…"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowFollowupForm(false)}
                      className="h-7 px-3 rounded-md border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateFollowup}
                      disabled={!followupInput.title.trim()}
                      className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
                    >
                      Create Task
                    </button>
                  </div>
                </div>
              )}

              {/* Tasks list */}
              {tasksLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No follow-up tasks yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const isOverdue =
                      task.due_at &&
                      new Date(task.due_at) < new Date() &&
                      task.status === 'pending'
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border p-3',
                          task.status === 'completed'
                            ? 'border-emerald-500/10 bg-emerald-500/5 opacity-60'
                            : task.status === 'cancelled'
                            ? 'border-border opacity-40'
                            : isOverdue
                            ? 'border-rose-500/20 bg-rose-500/5'
                            : 'border-border bg-muted/20'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-xs font-semibold',
                              task.status === 'completed'
                                ? 'line-through text-muted-foreground'
                                : 'text-foreground'
                            )}
                          >
                            {task.title}
                          </p>
                          {task.due_at && (
                            <p
                              className={cn(
                                'text-[10px] flex items-center gap-1 mt-0.5',
                                isOverdue ? 'text-rose-400' : 'text-muted-foreground'
                              )}
                            >
                              <Clock className="h-2.5 w-2.5" />
                              {new Date(task.due_at).toLocaleString([], {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                              {isOverdue && ' — Overdue'}
                            </p>
                          )}
                        </div>
                        {task.status === 'pending' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateTaskStatus(task.id, 'completed')}
                              className="h-6 w-6 flex items-center justify-center rounded text-emerald-400 hover:bg-emerald-500/10"
                              title="Complete"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateTaskStatus(task.id, 'cancelled')}
                              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                              title="Cancel"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* QUOTATIONS TAB */}
          {activeTab === 'quotations' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Linked Quotations
                </p>
                <button
                  type="button"
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
                  className="flex items-center gap-1 h-6 px-2.5 rounded-md border border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Create Quotation
                </button>
              </div>

              {loadingQuotations ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : quotations.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No quotations created for this lead yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {quotations.map((q) => (
                    <div
                      key={q.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/quotations/${q.id}`}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
                        >
                          {q.quotation_no}
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </Link>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {q.entry_date} · <span className="font-semibold text-slate-300">₹{Number(q.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </p>
                      </div>
                      <div className="shrink-0 ml-2">
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
                          q.status === 'draft' ? "bg-slate-500/10 text-slate-400 border-slate-500/20" :
                          q.status === 'sent' ? "bg-sky-500/10 text-sky-400 border-sky-500/20" :
                          q.status === 'accepted' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          q.status === 'rejected' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                          "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        )}>
                          {q.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
