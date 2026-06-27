'use client';

import { useDraggable } from '@dnd-kit/core';
import { CrmLead, CRM_STAGE_COLORS, CrmStage } from '@/types/crm';
import {
  Building2,
  Phone,
  MapPin,
  Flame,
  Snowflake,
  ThermometerSun,
  Clock,
  User,
  IndianRupee,
  Package,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const CATEGORY_CONFIG = {
  HOT: { icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', label: 'Hot' },
  WARM: { icon: ThermometerSun, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Warm' },
  COLD: { icon: Snowflake, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Cold' },
  LOST: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', label: 'Lost' },
} as const;

export function LeadCard({
  lead,
  onClick,
  isDragging,
}: {
  lead: CrmLead;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: lead.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const category = lead.lead_category ? CATEGORY_CONFIG[lead.lead_category] : null;
  const CategoryIcon = category?.icon;
  const isOverdue =
    lead.next_followup_at && new Date(lead.next_followup_at) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`group cursor-pointer rounded-lg border p-3 transition-all duration-150 ${
        isDragging
          ? 'border-primary/50 bg-slate-800/90 shadow-xl shadow-primary/20 ring-1 ring-primary/30'
          : 'border-slate-700/60 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800/80 hover:shadow-md'
      } ${lead.is_spam ? 'opacity-50' : ''}`}
    >
      {/* Top Row: Name + Category Badge */}
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-tight text-slate-200 group-hover:text-white">
          {lead.buyer_name || 'Unknown'}
        </h4>
        {category && CategoryIcon && (
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${category.bg} ${category.color}`}
          >
            <CategoryIcon className="h-2.5 w-2.5" />
            {category.label}
          </span>
        )}
      </div>

      {/* Company */}
      {lead.company_name && (
        <div className="mb-1 flex items-center gap-1 text-xs text-slate-400">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.company_name}</span>
        </div>
      )}

      {/* Product */}
      {lead.product_name && (
        <div className="mb-1.5 flex items-center gap-1 text-xs text-slate-500">
          <Package className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.product_name}</span>
        </div>
      )}

      {/* Bottom Row: Meta info */}
      <div className="mt-2 flex items-center justify-between border-t border-slate-700/40 pt-2">
        <div className="flex items-center gap-2">
          {/* Location */}
          {(lead.city || lead.country) && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
              <MapPin className="h-2.5 w-2.5" />
              {lead.city || lead.country}
            </span>
          )}

          {/* Score */}
          <span
            className="rounded-sm px-1 text-[10px] font-bold"
            style={{
              backgroundColor: `${CRM_STAGE_COLORS[lead.stage as CrmStage]}20`,
              color: CRM_STAGE_COLORS[lead.stage as CrmStage],
            }}
          >
            {lead.lead_score}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Value */}
          {lead.expected_value && Number(lead.expected_value) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400">
              <IndianRupee className="h-2.5 w-2.5" />
              {formatCompact(Number(lead.expected_value))}
            </span>
          )}

          {/* Assigned user avatar */}
          {lead.assigned_user && (
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-[9px] font-bold text-white"
              title={lead.assigned_user.full_name}
            >
              {lead.assigned_user.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
        </div>
      </div>

      {/* Overdue indicator */}
      {isOverdue && (
        <div className="mt-1.5 flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">
          <Clock className="h-2.5 w-2.5" />
          Follow-up overdue
          {lead.next_followup_at &&
            ` (${formatDistanceToNow(new Date(lead.next_followup_at), { addSuffix: true })})`}
        </div>
      )}
    </div>
  );
}

function formatCompact(value: number): string {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}
