'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import {
  TrendingUp,
  Percent,
  MapPin,
  Layers,
  Loader2,
  Database,
  Calendar,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useB2BSync } from '@/hooks/use-b2b-sync'
import type { B2BLead, B2BPlatform, B2BLeadStatus, Profile } from '@/types'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImportWizard } from '@/components/shared/import-wizard'
import { ImportExportHistoryDialog } from '@/components/shared/import-export-history-dialog'
import { exportToExcel, exportToCSV, exportToPDF, downloadTemplate } from '@/lib/client-export-helper'
import { usePermissions } from '@/hooks/use-permissions'
import * as XLSX from 'xlsx'

// Sub-components
import { LeadsToolbar, type ViewMode, type LeadFilters } from '@/components/leads/leads-toolbar'
import { LeadsTable } from '@/components/leads/leads-table'
import { LeadsCardGrid } from '@/components/leads/leads-card-grid'
import { LeadDetailPanel } from '@/components/leads/lead-detail-panel'

interface B2BLeadsDashboardProps {
  defaultPlatform?: B2BPlatform | 'all'
  showOnlyAssignedToMe?: boolean
  showOnlyReports?: boolean
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'New', badgeColor: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  { value: 'assigned', label: 'Assigned', badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { value: 'contacted', label: 'Contacted', badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { value: 'quoted', label: 'Quoted', badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
  { value: 'converted', label: 'Converted', badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { value: 'rejected', label: 'Rejected', badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  { value: 'lost', label: 'Lost', badgeColor: 'bg-red-900/20 text-red-400 border-red-900/30' },
]

const VIEW_MODE_KEY = 'wacrm.leads.viewMode'

export function B2BLeadsDashboard({
  defaultPlatform = 'all',
  showOnlyAssignedToMe = false,
  showOnlyReports = false,
}: B2BLeadsDashboardProps = {}) {
  const supabase = createClient()
  const { accountId, profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<B2BLead[]>([])
  const [staff, setStaff] = useState<Profile[]>([])
  const [syncingPlatform, setSyncingPlatform] = useState<B2BPlatform | null>(null)
  const [isSyncingAll, setIsSyncingAll] = useState(false)

  // View mode persisted in localStorage
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [importOpen, setImportOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Filters
  const [filters, setFilters] = useState<LeadFilters>({
    search: '',
    platform: defaultPlatform,
    status: 'all',
    assignedTo: 'all',
    dateRange: 'all',
    showDeleted: false,
  })

  // Right-side panel state
  const [selectedLead, setSelectedLead] = useState<B2BLead | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  // Edit modal state (kept for editing)
  const [activeLead, setActiveLead] = useState<B2BLead | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editBuyerName, setEditBuyerName] = useState('')
  const [editCompanyName, setEditCompanyName] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editProduct, setEditProduct] = useState('')
  const [editQuantity, setEditQuantity] = useState('')
  const [editMessage, setEditMessage] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editState, setEditState] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editAssignedTo, setEditAssignedTo] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // Load view mode from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY)
      if (stored === 'card' || stored === 'table') setViewMode(stored)
    } catch {}
  }, [])

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    try { localStorage.setItem(VIEW_MODE_KEY, mode) } catch {}
  }

  // ─── Status helpers ───────────────────────────────────────────────────────

  const getUIStatus = useCallback((lead: B2BLead): string => {
    if (lead.status === 'contacted' && lead.notes?.startsWith('[QUOTED]')) return 'quoted'
    if (lead.status === 'rejected' && lead.notes?.startsWith('[LOST]')) return 'lost'
    return lead.status
  }, [])

  const getCleanNotes = useCallback((notes: string | null | undefined): string => {
    if (!notes) return ''
    if (notes.startsWith('[QUOTED]')) return notes.slice('[QUOTED]'.length).trim()
    if (notes.startsWith('[LOST]')) return notes.slice('[LOST]'.length).trim()
    return notes
  }, [])

  const mapUIStatusToDB = useCallback(
    (uiStatus: string, currentNotes: string | null | undefined): { status: B2BLeadStatus; notes: string | null } => {
      let cleanNotes = currentNotes || ''
      if (cleanNotes.startsWith('[QUOTED]')) cleanNotes = cleanNotes.slice('[QUOTED]'.length).trim()
      else if (cleanNotes.startsWith('[LOST]')) cleanNotes = cleanNotes.slice('[LOST]'.length).trim()
      if (uiStatus === 'quoted') return { status: 'contacted', notes: cleanNotes ? `[QUOTED] ${cleanNotes}` : '[QUOTED]' }
      if (uiStatus === 'lost') return { status: 'rejected', notes: cleanNotes ? `[LOST] ${cleanNotes}` : '[LOST]' }
      return { status: uiStatus as B2BLeadStatus, notes: cleanNotes || null }
    },
    []
  )

  const getStatusBadge = useCallback((statusVal: string) => {
    const option = STATUS_OPTIONS.find((opt) => opt.value === statusVal)
    return option ? option.badgeColor : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
  }, [])

  const getStatusLabel = useCallback((statusVal: string) => {
    const option = STATUS_OPTIONS.find((opt) => opt.value === statusVal)
    return option ? option.label : statusVal
  }, [])

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!accountId) return
    try {
      let query = supabase
        .from('b2b_leads')
        .select(`*, assignee:profiles!b2b_leads_assigned_to_fkey(*)`)
        .eq('account_id', accountId)

      if (defaultPlatform !== 'all') {
        query = query.eq('platform', defaultPlatform)
      }

      if (!filters.showDeleted) {
        query = query.is('deleted_at', null)
      }

      const { data: leadsData, error: leadsError } = await query
        .order('inquiry_at', { ascending: false, nullsFirst: false })

      if (leadsError) throw leadsError

      const { data: staffData, error: staffError } = await supabase
        .from('profiles')
        .select('*')
        .eq('account_id', accountId)
        .in('account_role', ['owner', 'admin', 'agent'])

      if (staffError) throw staffError

      setLeads((leadsData as B2BLead[]) || [])
      setStaff((staffData as Profile[]) || [])
    } catch (err) {
      console.error('Error fetching enquiries:', err)
      toast.error('Failed to load enquiries')
    } finally {
      setLoading(false)
    }
  }, [accountId, supabase, defaultPlatform, filters.showDeleted])

  // Auto-sync
  const { status: autoSyncStatus, lastSyncAt, isSyncing: isAutoSyncing, triggerManualSync } = useB2BSync({
    autoSync: !showOnlyReports,
    intervalMs: 5 * 60 * 1000,
    onNewLeads: (count) => {
      toast.success(`🔄 ${count} new enquir${count > 1 ? 'ies' : 'y'} pulled in!`)
      void fetchData()
    },
  })

  // Sync selectedFilters with defaults
  useEffect(() => {
    if (showOnlyAssignedToMe && profile?.id) {
      setFilters((f) => ({ ...f, assignedTo: profile.id }))
    }
  }, [showOnlyAssignedToMe, profile])

  useEffect(() => {
    setFilters((f) => ({ ...f, platform: defaultPlatform }))
  }, [defaultPlatform])

  useEffect(() => {
    if (!accountId) return
    fetchData()

    const channel = supabase
      .channel('b2b_leads_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_leads', filter: `account_id=eq.${accountId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newLead = payload.new as B2BLead
          if (defaultPlatform !== 'all' && newLead?.platform !== defaultPlatform) return
          toast(`🔔 New ${newLead?.platform} Enquiry`, { description: `${newLead?.buyer_name ?? 'New Buyer'} • ${newLead?.product_name ?? 'Enquiry received'}`, duration: 5000 })
        }
        void fetchData()
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [accountId, fetchData, supabase, defaultPlatform])

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleOpenEdit = useCallback((lead: B2BLead) => {
    setActiveLead(lead)
    setEditBuyerName(lead.buyer_name || '')
    setEditCompanyName(lead.company_name || '')
    setEditMobile(lead.mobile || '')
    setEditEmail(lead.email || '')
    setEditProduct(lead.product_name || '')
    setEditQuantity(lead.quantity || '')
    setEditMessage(lead.message || '')
    setEditCity(lead.city || '')
    setEditState(lead.state || '')
    setEditStatus(getUIStatus(lead))
    setEditAssignedTo(lead.assigned_to || '')
    setEditNotes(getCleanNotes(lead.notes))
    setIsModalOpen(true)
  }, [getUIStatus, getCleanNotes])

  const handleSaveLead = useCallback(async () => {
    if (!activeLead) return
    try {
      const { status: dbStatus, notes: dbNotes } = mapUIStatusToDB(editStatus, editNotes)
      const payload = {
        buyer_name: editBuyerName || null,
        company_name: editCompanyName || null,
        mobile: editMobile || null,
        email: editEmail || null,
        product_name: editProduct || null,
        quantity: editQuantity || null,
        message: editMessage || null,
        city: editCity || null,
        state: editState || null,
        status: dbStatus,
        notes: dbNotes,
        assigned_to: editAssignedTo || null,
      }
      const res = await fetch(`/api/leads/${activeLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
      toast.success('Enquiry updated')
      setIsModalOpen(false)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update lead')
    }
  }, [activeLead, editBuyerName, editCompanyName, editMobile, editEmail, editProduct, editQuantity, editMessage, editCity, editState, editStatus, editNotes, editAssignedTo, mapUIStatusToDB, fetchData])

  const handleSoftDelete = useCallback(async (leadId: string) => {
    if (!confirm('Soft delete this lead?')) return
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
      toast.success('Enquiry deleted')
      setPanelOpen(false)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [fetchData])

  const handleRestoreLead = useCallback(async (leadId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted_at: null }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
      toast.success('Lead restored')
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore')
    }
  }, [fetchData])

  const handleAssignLead = useCallback(async (leadId: string, staffId: string | null) => {
    try {
      const res = await fetch('/api/integrations/leads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, staffId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success(data.message || 'Assignment updated')
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign')
    }
  }, [fetchData])

  const handleStatusChange = useCallback(async (leadId: string, dbStatus: any, dbNotes: string | null) => {
    try {
      const { error } = await supabase
        .from('b2b_leads')
        .update({ status: dbStatus, notes: dbNotes })
        .eq('id', leadId)
      if (error) throw error
      toast.success('Status updated')
      await fetchData()
    } catch {
      toast.error('Failed to update status')
    }
  }, [supabase, fetchData])

  const handleManualSync = async (platform: B2BPlatform) => {
    setSyncingPlatform(platform)
    try {
      const res = await fetch(`/api/integrations/${platform.toLowerCase()}/sync`, { method: 'POST' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Sync failed') }
      const d = await res.json()
      toast.success(d.message || `Synced ${platform}!`)
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Sync failed`)
    } finally {
      setSyncingPlatform(null)
    }
  }

  const handleSyncAll = async () => {
    setIsSyncingAll(true)
    try {
      await triggerManualSync()
      toast.success('All platforms synced!')
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setIsSyncingAll(false)
    }
  }

  const { hasPermission } = usePermissions();
  const canImport = hasPermission("data_management", "import");
  const canExport = hasPermission("data_management", "export");
  const canTemplates = hasPermission("data_management", "templates");
  const canViewHistory = hasPermission("data_management", "logs_view");

  const exportHeaders = [
    "SR NO", "DATE/TIME", "COMPANY NAME", "SENDER", "CONTACT NO", "EMAIL ID", "SOURCE", "REQUIREMENT", "LOCATION", "CITY", "PINCODE", "STATE", "COUNTRY", "STATUS", "ASSIGNED TO", "FOLLOW-UP DATE", "NEXT ACTION", "REMARKS"
  ];
  const exportColWidths = [
    "5%", "12%", "15%", "12%", "10%", "12%", "10%", "20%", "15%", "10%", "8%", "10%", "8%", "8%", "12%", "10%", "10%", "15%"
  ];

  const getExportData = () => {
    return filteredLeads.map((l, idx) => [
      idx + 1,
      l.inquiry_at ? new Date(l.inquiry_at).toLocaleString() : "",
      l.company_name || "",
      l.buyer_name || "",
      l.mobile || "",
      l.email || "",
      l.platform || "",
      l.message || "",
      [l.city, l.state].filter(Boolean).join(', ') || "",
      l.city || "",
      "", // Pincode
      l.state || "",
      l.country || "",
      l.status,
      l.assignee?.full_name || "—",
      "", // Followup date
      "", // Next action
      l.notes || "",
    ]);
  };

  const handleExportCSV = async () => {
    await exportToCSV({
      module: "enquiry",
      headers: exportHeaders,
      data: getExportData(),
      filtersUsed: filters,
      filenamePrefix: "enquiry_register",
    });
  };

  const handleExportExcel = async () => {
    await exportToExcel({
      module: "enquiry",
      title: "ENQUIRY REGISTER",
      headers: exportHeaders,
      colWidths: exportColWidths,
      data: getExportData(),
      filtersUsed: filters,
      filenamePrefix: "enquiry_register",
    });
  };

  const handleExportPDF = async () => {
    await exportToPDF({
      module: "enquiry",
      title: "ENQUIRY REGISTER",
      headers: exportHeaders,
      colWidths: exportColWidths,
      data: getExportData(),
      filtersUsed: filters,
      filenamePrefix: "enquiry_register",
    });
  };

  // ─── Filtered leads ───────────────────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase()
        const matchText = [
          lead.buyer_name, lead.company_name, lead.product_name,
          lead.message, lead.city, lead.state, lead.mobile,
          lead.email, lead.external_lead_id,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!matchText.includes(q)) return false
      }
      if (filters.platform !== 'all' && lead.platform !== filters.platform) return false
      if (filters.status !== 'all') {
        const uiStatus = getUIStatus(lead)
        if (uiStatus !== filters.status) return false
      }
      if (filters.assignedTo !== 'all') {
        if (filters.assignedTo === 'unassigned' && lead.assigned_to) return false
        if (filters.assignedTo !== 'unassigned' && lead.assigned_to !== filters.assignedTo) return false
      }
      if (filters.dateRange !== 'all') {
        if (!lead.inquiry_at) return false
        const d = new Date(lead.inquiry_at)
        const now = new Date()
        if (filters.dateRange === 'today') {
          if (d.toDateString() !== now.toDateString()) return false
        } else if (filters.dateRange === '7d') {
          if ((now.getTime() - d.getTime()) > 7 * 86400000) return false
        } else if (filters.dateRange === '30d') {
          if ((now.getTime() - d.getTime()) > 30 * 86400000) return false
        }
      }
      return true
    })
  }, [leads, filters, getUIStatus])

  // ─── Metrics ──────────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const todayStr = new Date().toDateString()
    return {
      total: leads.length,
      today: leads.filter((l) => l.inquiry_at && new Date(l.inquiry_at).toDateString() === todayStr).length,
      pending: leads.filter((l) => l.status === 'pending').length,
      assigned: leads.filter((l) => !!l.assigned_to).length,
      converted: leads.filter((l) => l.status === 'converted').length,
      indiamart: leads.filter((l) => l.platform === 'INDIAMART').length,
      tradeindia: leads.filter((l) => l.platform === 'TRADEINDIA').length,
      exportersindia: leads.filter((l) => l.platform === 'EXPORTERSINDIA').length,
    }
  }, [leads])

  // ─── Reports ──────────────────────────────────────────────────────────────

  const reports = useMemo(() => {
    const platforms: Record<string, number> = { INDIAMART: 0, TRADEINDIA: 0, EXPORTERSINDIA: 0 }
    const statusBreakdown: Record<string, number> = { pending: 0, assigned: 0, contacted: 0, converted: 0, rejected: 0 }
    const products: Record<string, number> = {}
    const cities: Record<string, number> = {}

    filteredLeads.forEach((lead) => {
      if (platforms[lead.platform] !== undefined) platforms[lead.platform]++
      if (statusBreakdown[lead.status] !== undefined) statusBreakdown[lead.status]++
      const prod = lead.product_name || 'Unspecified'
      products[prod] = (products[prod] || 0) + 1
      const city = lead.city || 'Unknown'
      cities[city] = (cities[city] || 0) + 1
    })

    return {
      platforms,
      status: statusBreakdown,
      products: Object.entries(products).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      cities: Object.entries(cities).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    }
  }, [filteredLeads])

  // ─── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <span className="ml-2.5 text-sm text-muted-foreground">Loading enquiries…</span>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* ── KPI Metrics Row ── */}
        <div className={cn(
          'grid gap-3',
          defaultPlatform === 'all'
            ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8'
            : 'grid-cols-2 sm:grid-cols-4'
        )}>
          {[
            { label: 'Total', value: metrics.total, color: 'text-foreground' },
            { label: 'Today', value: metrics.today, color: 'text-primary', badge: 'Live' },
            ...(defaultPlatform === 'all' ? [
              { label: 'IndiaMART', value: metrics.indiamart, color: 'text-sky-400' },
              { label: 'TradeIndia', value: metrics.tradeindia, color: 'text-amber-400' },
              { label: 'ExportersIndia', value: metrics.exportersindia, color: 'text-teal-400' },
            ] : []),
            { label: 'Pending', value: metrics.pending, color: 'text-amber-400' },
            { label: 'Assigned', value: metrics.assigned, color: 'text-blue-400' },
            { label: 'Converted', value: metrics.converted, color: 'text-emerald-400' },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-border bg-card px-3 py-3 flex flex-col gap-1 hover:border-muted-foreground/30 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m.label}</span>
              <div className="flex items-end gap-1.5">
                <span className={cn('text-xl font-bold leading-none', m.color)}>{m.value}</span>
                {m.badge && (
                  <span className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-1 py-0.5 rounded-full">
                    {m.badge}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Reports Section ── */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {/* Platform Share */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Platform Share</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(reports.platforms).map(([platform, count]) => {
                const total = filteredLeads.length || 1
                const percent = Math.round((count / total) * 100)
                const color = platform === 'INDIAMART' ? 'bg-sky-500' : platform === 'TRADEINDIA' ? 'bg-amber-500' : 'bg-teal-500'
                return (
                  <div key={platform} className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span className="font-medium">{platform}</span>
                      <span>{count} ({percent}%)</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Percent className="h-3.5 w-3.5 text-rose-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status Breakdown</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(reports.status).map(([status, count]) => {
                const total = filteredLeads.length || 1
                const percent = Math.round((count / total) * 100)
                const color = status === 'converted' ? 'bg-emerald-500' : status === 'rejected' ? 'bg-rose-500' : status === 'pending' ? 'bg-slate-500' : 'bg-blue-500'
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span className="capitalize font-medium">{status}</span>
                      <span>{count} ({percent}%)</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top Products */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-violet-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top Products</h3>
            </div>
            <div className="space-y-1.5">
              {reports.products.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">No data</span>
              ) : (
                reports.products.map((p, idx) => (
                  <div key={p.name} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground truncate pr-2 max-w-[160px]">
                      {idx + 1}. {p.name}
                    </span>
                    <span className="font-semibold text-foreground shrink-0">{p.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Cities */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-blue-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top Cities</h3>
            </div>
            <div className="space-y-1.5">
              {reports.cities.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">No data</span>
              ) : (
                reports.cities.map((c, idx) => (
                  <div key={c.name} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground truncate pr-2 max-w-[160px]">
                      {idx + 1}. {c.name}
                    </span>
                    <span className="font-semibold text-foreground shrink-0">{c.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Enquiries Browser ── */}
        {!showOnlyReports && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Toolbar */}
            <div className="border-b border-border p-3">
            <LeadsToolbar
                filters={filters}
                onFiltersChange={setFilters}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                totalCount={leads.length}
                filteredCount={filteredLeads.length}
                staff={staff}
                defaultPlatform={defaultPlatform}
                showOnlyAssignedToMe={showOnlyAssignedToMe}
                showOnlyReports={showOnlyReports}
                isAutoSyncing={isAutoSyncing}
                autoSyncStatus={autoSyncStatus}
                lastSyncAt={lastSyncAt}
                onSyncAll={handleSyncAll}
                onSyncPlatform={handleManualSync}
                syncingPlatform={syncingPlatform}
                isSyncingAll={isSyncingAll}
                onImportClick={canImport ? () => setImportOpen(true) : undefined}
                onExportCSV={canExport ? handleExportCSV : undefined}
                onExportExcel={canExport ? handleExportExcel : undefined}
                onExportPDF={canExport ? handleExportPDF : undefined}
                onTemplateClick={canTemplates ? () => downloadTemplate("enquiry") : undefined}
                onHistoryClick={canViewHistory ? () => setHistoryOpen(true) : undefined}
              />
            </div>

            {/* Content */}
            <div className={cn(viewMode === 'table' ? '' : 'p-3')}>
              {viewMode === 'table' ? (
                <LeadsTable
                  leads={filteredLeads}
                  staff={staff}
                  statusOptions={STATUS_OPTIONS}
                  getUIStatus={getUIStatus}
                  getStatusBadge={getStatusBadge}
                  getStatusLabel={getStatusLabel}
                  onViewLead={(lead) => { setSelectedLead(lead); setPanelOpen(true) }}
                  onEditLead={handleOpenEdit}
                  onDeleteLead={handleSoftDelete}
                  onRestoreLead={handleRestoreLead}
                  onAssignLead={handleAssignLead}
                  onStatusChange={handleStatusChange}
                  mapUIStatusToDB={mapUIStatusToDB}
                />
              ) : (
                <LeadsCardGrid
                  leads={filteredLeads}
                  staff={staff}
                  getUIStatus={getUIStatus}
                  getStatusBadge={getStatusBadge}
                  getStatusLabel={getStatusLabel}
                  onViewLead={(lead) => { setSelectedLead(lead); setPanelOpen(true) }}
                  onEditLead={handleOpenEdit}
                  onDeleteLead={handleSoftDelete}
                  onRestoreLead={handleRestoreLead}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Right-side detail panel ── */}
        <LeadDetailPanel
          lead={selectedLead}
          staff={staff}
          isOpen={panelOpen}
          onClose={() => { setPanelOpen(false); setSelectedLead(null) }}
          onRefresh={fetchData}
          onEdit={(lead) => { setPanelOpen(false); handleOpenEdit(lead) }}
          mapUIStatusToDB={mapUIStatusToDB}
          getUIStatus={getUIStatus}
          getStatusLabel={getStatusLabel}
          getStatusBadge={getStatusBadge}
        />

        {/* ── Edit Dialog ── */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                Edit Enquiry — {activeLead?.buyer_name || activeLead?.mobile || 'Unknown'}
              </DialogTitle>
            </DialogHeader>
            {activeLead && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-3">
                {[
                  { label: 'Buyer Name', value: editBuyerName, setter: setEditBuyerName },
                  { label: 'Company Name', value: editCompanyName, setter: setEditCompanyName },
                  { label: 'Mobile', value: editMobile, setter: setEditMobile },
                  { label: 'Email', value: editEmail, setter: setEditEmail },
                  { label: 'Product', value: editProduct, setter: setEditProduct },
                  { label: 'Quantity', value: editQuantity, setter: setEditQuantity },
                  { label: 'City', value: editCity, setter: setEditCity },
                  { label: 'State', value: editState, setter: setEditState },
                ].map((field) => (
                  <div key={field.label} className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">{field.label}</label>
                    <Input
                      value={field.value}
                      onChange={(e) => field.setter(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Assign To</label>
                  <select
                    value={editAssignedTo}
                    onChange={(e) => setEditAssignedTo(e.target.value)}
                    className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-full space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Message</label>
                  <textarea
                    rows={3}
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="col-span-full space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Notes</label>
                  <textarea
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Agent notes..."
                    className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button size="sm" variant="ghost" onClick={() => setIsModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveLead} className="text-xs">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ImportWizard
          open={importOpen}
          onOpenChange={setImportOpen}
          module="enquiry"
          onImportCompleted={fetchData}
        />
        <ImportExportHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          module="enquiry"
        />
      </div>
    </TooltipProvider>
  )
}
