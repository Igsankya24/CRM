'use client';

import { CrmActivity, CrmActivityType } from '@/types/crm';
import { formatDistanceToNow } from 'date-fns';
import {
  Bot,
  MessageSquare,
  Phone,
  Mail,
  Users,
  Video,
  StickyNote,
  ArrowRightLeft,
  UserCheck,
  FileText,
  CreditCard,
  Truck,
  MessageCircle,
  Cog,
} from 'lucide-react';

const ACTIVITY_ICONS: Record<CrmActivityType, { icon: typeof Bot; color: string; bg: string }> = {
  AI_MESSAGE: { icon: Bot, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  WHATSAPP_CHAT: { icon: MessageSquare, color: 'text-green-400', bg: 'bg-green-500/10' },
  CALL: { icon: Phone, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  EMAIL: { icon: Mail, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  MEETING: { icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  VIDEO_CALL: { icon: Video, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  NOTE: { icon: StickyNote, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  STAGE_CHANGE: { icon: ArrowRightLeft, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  ASSIGNMENT: { icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  QUOTATION: { icon: FileText, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  PAYMENT: { icon: CreditCard, color: 'text-lime-400', bg: 'bg-lime-500/10' },
  DELIVERY: { icon: Truck, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  FEEDBACK: { icon: MessageCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  SYSTEM: { icon: Cog, color: 'text-slate-400', bg: 'bg-slate-500/10' },
};

export function ActivityTimeline({
  activities,
  loading,
}: {
  activities: CrmActivity[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 rounded bg-slate-800" />
              <div className="h-2.5 w-1/2 rounded bg-slate-800/50" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-slate-500">
        No activities yet
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-slate-700 via-slate-800 to-transparent" />

      <div className="space-y-1">
        {activities.map((activity, index) => {
          const config = ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.SYSTEM;
          const Icon = config.icon;

          return (
            <div key={activity.id} className="group relative flex gap-3 py-2 pl-0">
              {/* Icon */}
              <div
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700/60 ${config.bg}`}
              >
                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                    {activity.title}
                  </p>
                  <time className="shrink-0 text-[10px] text-slate-500">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </time>
                </div>

                {activity.description && (
                  <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                    {activity.description}
                  </p>
                )}

                {activity.performer && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    by {activity.performer.full_name}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
