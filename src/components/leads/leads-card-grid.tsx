'use client'

import {
  User,
  Building,
  Phone,
  MapPin,
  MessageSquare,
  Clock,
  Eye,
  Pencil,
  Trash2,
  RotateCcw,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { B2BLead, Profile } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface LeadsCardGridProps {
  leads: B2BLead[]
  staff: Profile[]
  getUIStatus: (lead: B2BLead) => string
  getStatusBadge: (status: string) => string
  getStatusLabel: (status: string) => string
  onViewLead: (lead: B2BLead) => void
  onEditLead: (lead: B2BLead) => void
  onDeleteLead: (leadId: string) => void
  onRestoreLead: (leadId: string) => void
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

function formatRelativeTime(dateStr: string | null | undefined) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays}d ago`
}

export function LeadsCardGrid({
  leads,
  staff,
  getUIStatus,
  getStatusBadge,
  getStatusLabel,
  onViewLead,
  onEditLead,
  onDeleteLead,
  onRestoreLead,
}: LeadsCardGridProps) {
  if (leads.length === 0) {
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {leads.map((lead) => {
        const uiStatus = getUIStatus(lead)
        const statusBadge = getStatusBadge(uiStatus)
        const statusLabel = getStatusLabel(uiStatus)
        const platformBadge = PLATFORM_BADGE[lead.platform] || ''
        const relTime = formatRelativeTime(lead.inquiry_at || lead.received_at)
        const isDeleted = !!lead.deleted_at

        return (
          <div
            key={lead.id}
            onClick={() => onViewLead(lead)}
            className={cn(
              'group relative rounded-xl border border-border bg-card p-4 cursor-pointer',
              'hover:border-border/80 hover:shadow-md transition-all duration-200',
              'hover:-translate-y-0.5',
              isDeleted && 'opacity-60 border-l-2 border-l-rose-500'
            )}
          >
            {/* Top: Platform + Status */}
            <div className="flex items-center justify-between mb-3">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  platformBadge
                )}
              >
                {PLATFORM_LABELS[lead.platform] || lead.platform}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                  statusBadge
                )}
              >
                {statusLabel}
              </span>
            </div>

            {/* Buyer info */}
            <div className="mb-3 space-y-1">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {lead.buyer_name || 'Unknown Buyer'}
              </h3>
              {lead.company_name && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                  <Building className="h-3 w-3 shrink-0" />
                  {lead.company_name}
                </p>
              )}
              {lead.mobile && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" />
                  {lead.mobile}
                </p>
              )}
              {(lead.city || lead.state) && (
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  {[lead.city, lead.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>

            {/* Product */}
            {lead.product_name && (
              <div className="mb-3 rounded-lg bg-muted/40 px-2.5 py-1.5 border border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Product
                </p>
                <p className="text-xs font-medium text-foreground line-clamp-2">
                  {lead.product_name}
                </p>
                {lead.quantity && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Qty: {lead.quantity}
                  </p>
                )}
              </div>
            )}

            {/* Message preview */}
            {lead.message && (
              <p className="mb-3 text-[11px] text-muted-foreground/70 line-clamp-2 italic bg-muted/20 rounded-lg px-2 py-1.5 border border-border/30">
                &ldquo;{lead.message}&rdquo;
              </p>
            )}

            {/* Footer: Assignee + Date + Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  {lead.assignee?.avatar_url && (
                    <AvatarImage src={lead.assignee.avatar_url} />
                  )}
                  <AvatarFallback className="text-[8px] font-bold">
                    {lead.assignee?.full_name?.substring(0, 2) ?? 'UN'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                  {lead.assignee?.full_name || 'Unassigned'}
                </span>
              </div>
              {relTime && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <Clock className="h-2.5 w-2.5" />
                  {relTime}
                </div>
              )}
            </div>

            {/* Hover actions */}
            <div
              className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 rounded-b-xl bg-card/95 px-3 py-2 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => onViewLead(lead)}
                className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Eye className="h-3 w-3" />
                View
              </button>
              <button
                type="button"
                onClick={() => onEditLead(lead)}
                className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
              {lead.mobile && (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `https://wa.me/${lead.mobile?.replace(/\D/g, '') || ''}`,
                      '_blank'
                    )
                  }
                  className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                >
                  <MessageSquare className="h-3 w-3" />
                  WA
                </button>
              )}
              {isDeleted ? (
                <button
                  type="button"
                  onClick={() => onRestoreLead(lead.id)}
                  className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onDeleteLead(lead.id)}
                  className="flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
