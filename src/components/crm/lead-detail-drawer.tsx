'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CrmLead,
  CrmActivity,
  CRM_STAGES,
  CRM_STAGE_LABELS,
  CRM_STAGE_COLORS,
  CRM_STAGE_TRANSITIONS,
  CrmStage,
} from '@/types/crm';
import { ActivityTimeline } from './activity-timeline';
import {
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ArrowRight,
  Flame,
  Snowflake,
  ThermometerSun,
  Bot,
  UserCheck,
  IndianRupee,
  Package,
  Clock,
  Star,
  MessageSquare,
  StickyNote,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export function LeadDetailDrawer({
  lead,
  open,
  onClose,
  onTransition,
  onUpdate,
}: {
  lead: CrmLead | null;
  open: boolean;
  onClose: () => void;
  onTransition: (leadId: string, toStage: CrmStage, reason?: string) => Promise<{ success: boolean; error: string | null }>;
  onUpdate: (leadId: string, data: Partial<CrmLead>) => Promise<void>;
}) {
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'details' | 'actions'>('timeline');
  const [noteText, setNoteText] = useState('');

  // Fetch activities when lead changes
  useEffect(() => {
    if (lead && open) {
      setActivitiesLoading(true);
      fetch(`/api/crm/leads/${lead.id}/activities`)
        .then((res) => res.json())
        .then((data) => setActivities(data.activities || []))
        .catch(() => setActivities([]))
        .finally(() => setActivitiesLoading(false));
    }
  }, [lead?.id, open]);

  const handleAddNote = useCallback(async () => {
    if (!lead || !noteText.trim()) return;

    await fetch(`/api/crm/leads/${lead.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activity_type: 'NOTE',
        title: 'Note Added',
        description: noteText.trim(),
      }),
    });

    setNoteText('');
    // Refetch activities
    const res = await fetch(`/api/crm/leads/${lead.id}/activities`);
    const data = await res.json();
    setActivities(data.activities || []);
  }, [lead, noteText]);

  if (!open || !lead) return null;

  const nextStages = CRM_STAGE_TRANSITIONS[lead.stage as CrmStage] || [];
  const stageIndex = CRM_STAGES.indexOf(lead.stage as CrmStage);
  const isOverdue = lead.next_followup_at && new Date(lead.next_followup_at) < new Date();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-white truncate">
                {lead.buyer_name || 'Unknown Lead'}
              </h2>
              {lead.lead_category && (
                <CategoryBadge category={lead.lead_category} />
              )}
            </div>
            {lead.company_name && (
              <div className="flex items-center gap-1.5 text-sm text-slate-400">
                <Building2 className="h-3.5 w-3.5" />
                {lead.company_name}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stage Progress Bar */}
        <div className="border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {CRM_STAGES.map((stage, i) => {
              const isActive = stage === lead.stage;
              const isPast = i < stageIndex;
              const color = CRM_STAGE_COLORS[stage];

              return (
                <div key={stage} className="flex items-center">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isActive
                        ? 'w-8'
                        : isPast
                          ? 'w-4'
                          : 'w-3'
                    }`}
                    style={{
                      backgroundColor: isActive || isPast ? color : '#334155',
                      opacity: isActive ? 1 : isPast ? 0.7 : 0.3,
                    }}
                    title={CRM_STAGE_LABELS[stage]}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span
              className="text-xs font-semibold"
              style={{ color: CRM_STAGE_COLORS[lead.stage as CrmStage] }}
            >
              {CRM_STAGE_LABELS[lead.stage as CrmStage]}
            </span>
            <span className="text-[10px] text-slate-500">
              Score: {lead.lead_score}/100
            </span>
          </div>
        </div>

        {/* Contact Info */}
        <div className="flex flex-wrap gap-3 border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-white transition-colors">
              <Phone className="h-3 w-3" />
              {lead.phone}
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-white transition-colors">
              <Mail className="h-3 w-3" />
              {lead.email}
            </a>
          )}
          {(lead.city || lead.state || lead.country) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}
            </span>
          )}
          {lead.product_name && (
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {lead.product_name}
              {lead.quantity && ` × ${lead.quantity}`}
            </span>
          )}
          {lead.expected_value && Number(lead.expected_value) > 0 && (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <IndianRupee className="h-3 w-3" />
              {Number(lead.expected_value).toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          {(['timeline', 'details', 'actions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {/* Add Note */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  placeholder="Add a note..."
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <StickyNote className="h-4 w-4" />
                </button>
              </div>

              {/* Overdue Warning */}
              {isOverdue && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
                  <Clock className="h-4 w-4" />
                  <div>
                    <p className="font-semibold">Follow-up overdue</p>
                    <p className="text-red-400/70">
                      Was due {formatDistanceToNow(new Date(lead.next_followup_at!), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )}

              {/* AI Summary */}
              {lead.ai_summary && (
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-400">
                    <Bot className="h-3.5 w-3.5" />
                    AI Summary
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {lead.ai_summary}
                  </p>
                </div>
              )}

              <ActivityTimeline activities={activities} loading={activitiesLoading} />
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
              <DetailSection title="Lead Information">
                <DetailRow label="Source" value={lead.source} />
                <DetailRow label="Created" value={lead.created_at ? format(new Date(lead.created_at), 'PPpp') : '-'} />
                <DetailRow label="Inquiry Date" value={lead.inquiry_at ? format(new Date(lead.inquiry_at), 'PPpp') : '-'} />
                <DetailRow label="Last Contacted" value={lead.last_contacted_at ? format(new Date(lead.last_contacted_at), 'PPpp') : 'Never'} />
                <DetailRow label="Next Follow-up" value={lead.next_followup_at ? format(new Date(lead.next_followup_at), 'PPpp') : 'Not set'} />
              </DetailSection>

              <DetailSection title="Qualification">
                <DetailRow label="Lead Score" value={`${lead.lead_score}/100`} />
                <DetailRow label="Category" value={lead.lead_category || 'Unqualified'} />
                <DetailRow label="Urgency" value={lead.urgency || 'Not set'} />
                <DetailRow label="Spam" value={lead.is_spam ? 'Yes ⚠️' : 'No'} />
              </DetailSection>

              <DetailSection title="AI Engagement">
                <DetailRow label="Status" value={lead.ai_engagement_status || 'Not started'} />
              </DetailSection>

              {lead.assigned_user && (
                <DetailSection title="Assignment">
                  <DetailRow label="Assigned To" value={lead.assigned_user.full_name} />
                  <DetailRow label="Assigned At" value={lead.assigned_at ? format(new Date(lead.assigned_at), 'PPpp') : '-'} />
                </DetailSection>
              )}

              {lead.close_reason && (
                <DetailSection title="Closure">
                  <DetailRow label="Reason" value={lead.close_reason} />
                  <DetailRow label="Closed At" value={lead.closed_at ? format(new Date(lead.closed_at), 'PPpp') : '-'} />
                </DetailSection>
              )}
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-4">
              {/* Stage Transitions */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Move to Stage
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {nextStages.map((stage) => (
                    <button
                      key={stage}
                      onClick={() => onTransition(lead.id, stage)}
                      className="flex items-center gap-2 rounded-lg border border-slate-700 p-2.5 text-xs font-medium text-slate-300 transition-all hover:border-slate-500 hover:bg-slate-800 hover:text-white"
                    >
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: CRM_STAGE_COLORS[stage] }}
                      />
                      <span className="truncate">{CRM_STAGE_LABELS[stage]}</span>
                      <ArrowRight className="ml-auto h-3 w-3 text-slate-500" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Quick Actions
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <QuickActionButton
                    icon={Phone}
                    label="Log Call"
                    onClick={() => logQuickActivity(lead.id, 'CALL', 'Call logged')}
                  />
                  <QuickActionButton
                    icon={MessageSquare}
                    label="WhatsApp"
                    onClick={() => {
                      if (lead.phone) {
                        window.open(`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`, '_blank');
                      }
                    }}
                  />
                  <QuickActionButton
                    icon={Mail}
                    label="Email"
                    onClick={() => {
                      if (lead.email) {
                        window.open(`mailto:${lead.email}`, '_blank');
                      }
                    }}
                  />
                  <QuickActionButton
                    icon={Calendar}
                    label="Schedule"
                    onClick={() => logQuickActivity(lead.id, 'MEETING', 'Meeting scheduled')}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──

function CategoryBadge({ category }: { category: string }) {
  const configs: Record<string, { icon: typeof Flame; color: string; bg: string }> = {
    HOT: { icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
    WARM: { icon: ThermometerSun, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    COLD: { icon: Snowflake, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  };
  const config = configs[category];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.bg} ${config.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {category}
    </span>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-300">{value}</span>
    </div>
  );
}

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Phone;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-slate-700 p-2.5 text-xs font-medium text-slate-300 transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

async function logQuickActivity(leadId: string, type: string, title: string) {
  await fetch(`/api/crm/leads/${leadId}/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activity_type: type, title }),
  });
}
