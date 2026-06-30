'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  ChevronDown,
  ChevronUp,
  User,
  Building,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  Clock,
  Eye,
  FileText,
  Pencil,
  Trash2,
  RotateCcw,
  UserPlus,
  Check,
  Loader2,
  ArrowUpDown,
  ExternalLink,
  Flame,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import type { B2BLead, Profile } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type SortField = 'inquiry_at' | 'buyer_name' | 'company_name' | 'status' | 'platform' | 'product_name'
type SortDir = 'asc' | 'desc'

export interface ColumnVisibility {
  platform: boolean
  customer: boolean
  product: boolean
  inquiryDate: boolean
  status: boolean
  assignedTo: boolean
  actions: boolean
}

interface LeadsTableProps {
  leads: B2BLead[]
  staff: Profile[]
  statusOptions: Array<{ value: string; label: string; badgeColor: string }>
  getUIStatus: (lead: B2BLead) => string
  getStatusBadge: (status: string) => string
  getStatusLabel: (status: string) => string
  onViewLead: (lead: B2BLead) => void
  onEditLead: (lead: B2BLead) => void
  onDeleteLead: (leadId: string) => void
  onRestoreLead: (leadId: string) => void
  onAssignLead: (leadId: string, staffId: string | null) => void
  onStatusChange: (leadId: string, status: string, notes: string | null) => void
  mapUIStatusToDB: (uiStatus: string, currentNotes: string | null | undefined) => { status: any; notes: string | null }
  loading?: boolean
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  let relative = ''
  if (diffMins < 1) relative = 'just now'
  else if (diffMins < 60) relative = `${diffMins}m ago`
  else if (diffHours < 24) relative = `${diffHours}h ago`
  else if (diffDays === 1) relative = 'Yesterday'
  else relative = `${diffDays}d ago`
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return { date, relative }
}

const PLATFORM_BADGE: Record<string, string> = {
  INDIAMART: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  TRADEINDIA: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  EXPORTERSINDIA: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
}

export function LeadsTable({
  leads,
  staff,
  statusOptions,
  getUIStatus,
  getStatusBadge,
  getStatusLabel,
  onViewLead,
  onEditLead,
  onDeleteLead,
  onRestoreLead,
  onAssignLead,
  onStatusChange,
  mapUIStatusToDB,
  loading,
}: LeadsTableProps) {
  const [sortField, setSortField] = useState<SortField>('inquiry_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const router = useRouter()

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortDir('desc')
      }
    },
    [sortField]
  )

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      let aVal: string | null | undefined
      let bVal: string | null | undefined
      if (sortField === 'inquiry_at') {
        aVal = a.inquiry_at || a.received_at || a.created_at
        bVal = b.inquiry_at || b.received_at || b.created_at
      } else {
        aVal = (a as Record<string, any>)[sortField]
        bVal = (b as Record<string, any>)[sortField]
      }
      const cmp = (aVal ?? '').localeCompare(bVal ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [leads, sortField, sortDir])

  function SortButton({ field, label }: { field: SortField; label: string }) {
    const isActive = sortField === field
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 group"
      >
        <span>{label}</span>
        {isActive ? (
          sortDir === 'asc' ? (
            <ChevronUp className="h-3 w-3 text-primary" />
          ) : (
            <ChevronDown className="h-3 w-3 text-primary" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
        )}
      </button>
    )
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (sortedLeads.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <User className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">No leads found</p>
        <p className="text-xs">Try adjusting your search or filters</p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-2.5 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <SortButton field="platform" label="Platform" />
              </span>
            </th>
            <th className="px-4 py-2.5 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <SortButton field="buyer_name" label="Customer" />
              </span>
            </th>
            <th className="px-4 py-2.5 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <SortButton field="product_name" label="Product" />
              </span>
            </th>
            <th className="px-4 py-2.5 text-left whitespace-nowrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <SortButton field="inquiry_at" label="Inquiry" />
              </span>
            </th>
            <th className="px-4 py-2.5 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <SortButton field="status" label="Status" />
              </span>
            </th>
            <th className="px-4 py-2.5 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Assigned To
              </span>
            </th>
            <th className="px-4 py-2.5 text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Actions
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {sortedLeads.map((lead) => {
            const uiStatus = getUIStatus(lead)
            const statusBadge = getStatusBadge(uiStatus)
            const statusLabel = getStatusLabel(uiStatus)
            const platformBadge = PLATFORM_BADGE[lead.platform] || ''
            const dateInfo = formatDate(lead.inquiry_at || lead.received_at)
            const isDeleted = !!lead.deleted_at

            return (
              <tr
                key={lead.id}
                onClick={() => onViewLead(lead)}
                className={cn(
                  'group cursor-pointer transition-colors hover:bg-muted/40',
                  isDeleted && 'opacity-60'
                )}
              >
                {/* Platform */}
                <td className="px-4 py-2.5">
                  <div className="flex flex-col items-start gap-1">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap',
                        platformBadge
                      )}
                    >
                      {lead.platform === 'INDIAMART'
                        ? 'IM'
                        : lead.platform === 'TRADEINDIA'
                        ? 'TI'
                        : 'EI'}
                    </span>
                    {isDeleted && (
                      <span className="text-[9px] font-bold uppercase text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded px-1 py-0.5">
                        Deleted
                      </span>
                    )}
                  </div>
                </td>

                {/* Customer */}
                <td className="px-4 py-2.5 max-w-[220px]">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {lead.buyer_name || 'N/A'}
                      </p>
                    </div>
                    {lead.company_name && (
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                        <Building className="h-2.5 w-2.5 shrink-0" />
                        {lead.company_name}
                      </p>
                    )}
                    {lead.mobile && (
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Phone className="h-2.5 w-2.5 shrink-0" />
                        {lead.mobile}
                      </p>
                    )}
                    {(lead.city || lead.state) && (
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        {[lead.city, lead.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </td>

                {/* Product */}
                <td className="px-4 py-2.5 max-w-[180px]">
                  <p className="text-xs font-medium text-foreground line-clamp-2">
                    {lead.product_name || '—'}
                  </p>
                  {lead.quantity && (
                    <span className="mt-0.5 inline-block text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                      Qty: {lead.quantity}
                    </span>
                  )}
                </td>

                {/* Inquiry Date */}
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {dateInfo ? (
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-foreground">{dateInfo.date}</p>
                      <p className="text-[10px] text-muted-foreground">{dateInfo.relative}</p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>

                {/* Status — inline dropdown */}
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold outline-none transition-all hover:brightness-110',
                        statusBadge
                      )}
                    >
                      {statusLabel}
                      <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="min-w-[140px] bg-card border-border"
                    >
                      {statusOptions.map((opt) => (
                        <DropdownMenuItem
                          key={opt.value}
                          onClick={async () => {
                            if (uiStatus === opt.value) return
                            const { status: dbStatus, notes: dbNotes } =
                              mapUIStatusToDB(opt.value, lead.notes)
                            onStatusChange(lead.id, dbStatus, dbNotes)
                          }}
                          className="flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full',
                                opt.badgeColor.split(' ')[0]
                              )}
                            />
                            {opt.label}
                          </span>
                          {uiStatus === opt.value && (
                            <Check className="h-3 w-3 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>

                {/* Assigned To — inline dropdown */}
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs outline-none hover:bg-muted/60 transition-colors max-w-[140px]">
                      <Avatar className="h-4 w-4 shrink-0">
                        {lead.assignee?.avatar_url && (
                          <AvatarImage src={lead.assignee.avatar_url} />
                        )}
                        <AvatarFallback className="text-[8px] font-bold">
                          {lead.assignee?.full_name?.substring(0, 2) ?? 'UN'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-muted-foreground">
                        {lead.assignee?.full_name || 'Unassigned'}
                      </span>
                      <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-40" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="max-h-52 overflow-y-auto min-w-[160px] bg-card border-border"
                    >
                      <DropdownMenuItem
                        onClick={() => onAssignLead(lead.id, null)}
                        className="flex items-center justify-between text-xs cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-[8px]">UN</AvatarFallback>
                          </Avatar>
                          Unassigned
                        </span>
                        {!lead.assigned_to && <Check className="h-3 w-3 text-primary" />}
                      </DropdownMenuItem>
                      {staff.map((s) => (
                        <DropdownMenuItem
                          key={s.id}
                          onClick={() => onAssignLead(lead.id, s.id)}
                          className="flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <Avatar className="h-4 w-4 shrink-0">
                              {s.avatar_url && (
                                <AvatarImage src={s.avatar_url} />
                              )}
                              <AvatarFallback className="text-[8px] font-bold uppercase">
                                {s.full_name?.substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{s.full_name}</span>
                          </span>
                          {lead.assigned_to === s.id && (
                            <Check className="h-3 w-3 text-primary shrink-0" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>

                {/* Actions — shown on hover */}
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => onViewLead(lead)}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          />
                        }
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>View Details</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => onEditLead(lead)}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          />
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>Edit Lead</TooltipContent>
                    </Tooltip>
                    {lead.mobile && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              onClick={() => {
                                const phone = lead.mobile || '';
                                router.push(`/inbox?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(lead.buyer_name || '')}&docType=enquiry&docId=${lead.id}`);
                              }}
                              className="h-7 w-7 flex items-center justify-center rounded-md text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            />
                          }
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </TooltipTrigger>
                        <TooltipContent>WhatsApp</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger
                        render={
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
                            className="h-7 w-7 flex items-center justify-center rounded-md text-violet-400 hover:bg-violet-500/10 transition-colors"
                          />
                        }
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent>Create Quotation</TooltipContent>
                    </Tooltip>
                    {isDeleted ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              onClick={() => onRestoreLead(lead.id)}
                              className="h-7 w-7 flex items-center justify-center rounded-md text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                            />
                          }
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </TooltipTrigger>
                        <TooltipContent>Restore</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              onClick={() => onDeleteLead(lead.id)}
                              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            />
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

