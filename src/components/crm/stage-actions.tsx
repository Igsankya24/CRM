'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CrmLead,
  CrmStage,
  CRM_STAGE_LABELS,
  CRM_STAGE_COLORS,
  CRM_STAGE_TRANSITIONS,
  CrmActivityType,
} from '@/types/crm';
import {
  ArrowRight,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  Video,
  StickyNote,
  FileText,
  Package,
  CreditCard,
  Truck,
  Star,
  Bot,
  UserPlus,
  XCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface StageActionsProps {
  lead: CrmLead;
  onTransition: (toStage: CrmStage, reason?: string) => Promise<{ success: boolean; error: string | null }>;
  onLogActivity: (type: CrmActivityType, title: string, description?: string) => Promise<void>;
  onUpdate: (data: Partial<CrmLead>) => Promise<void>;
}

/** Context-aware action panel — shows relevant actions based on the current stage. */
export function StageActions({ lead, onTransition, onLogActivity, onUpdate }: StageActionsProps) {
  const router = useRouter();
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const nextStages = CRM_STAGE_TRANSITIONS[lead.stage as CrmStage] || [];

  const handleTransition = async (stage: CrmStage) => {
    setTransitioning(stage);
    await onTransition(stage);
    setTransitioning(null);
  };

  return (
    <div className="space-y-5">
      {/* Current Stage Context */}
      <StageContextActions lead={lead} onLogActivity={onLogActivity} onUpdate={onUpdate} />

      {/* Stage Transitions */}
      <div>
        <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Move to Stage
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {nextStages.map((stage) => (
            <button
              key={stage}
              onClick={() => handleTransition(stage)}
              disabled={transitioning !== null}
              className="group flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800 hover:text-white"
            >
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: CRM_STAGE_COLORS[stage] }}
              />
              <span className="truncate">{CRM_STAGE_LABELS[stage]}</span>
              {transitioning === stage ? (
                <div className="ml-auto h-3 w-3 animate-spin rounded-full border border-t-transparent border-current" />
              ) : (
                <ArrowRight className="ml-auto h-3 w-3 text-slate-600 group-hover:text-slate-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Quick Actions
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon={Phone}
            label="Log Call"
            color="text-blue-400"
            onClick={() => onLogActivity('CALL', 'Call logged')}
          />
          <ActionButton
            icon={MessageSquare}
            label="WhatsApp"
            color="text-green-400"
            onClick={() => {
              if (lead.phone) {
                router.push(`/inbox?phone=${encodeURIComponent(lead.phone)}&name=${encodeURIComponent(lead.buyer_name || '')}&docType=enquiry&docId=${lead.id}`);
              }
              onLogActivity('WHATSAPP_CHAT', 'WhatsApp message sent');
            }}
          />
          <ActionButton
            icon={Mail}
            label="Send Email"
            color="text-cyan-400"
            onClick={() => {
              if (lead.email) window.open(`mailto:${lead.email}`, '_blank');
              onLogActivity('EMAIL', 'Email sent');
            }}
          />
          <ActionButton
            icon={Calendar}
            label="Schedule Meeting"
            color="text-amber-400"
            onClick={() => onLogActivity('MEETING', 'Meeting scheduled')}
          />
          <ActionButton
            icon={Video}
            label="Video Call"
            color="text-pink-400"
            onClick={() => onLogActivity('VIDEO_CALL', 'Video call made')}
          />
          <ActionButton
            icon={StickyNote}
            label="Add Note"
            color="text-yellow-400"
            onClick={() => onLogActivity('NOTE', 'Note added')}
          />
        </div>
      </div>
    </div>
  );
}

/** Stage-specific context actions based on the current stage */
function StageContextActions({
  lead,
  onLogActivity,
  onUpdate,
}: {
  lead: CrmLead;
  onLogActivity: (type: CrmActivityType, title: string, description?: string) => Promise<void>;
  onUpdate: (data: Partial<CrmLead>) => Promise<void>;
}) {
  const stage = lead.stage as CrmStage;

  switch (stage) {
    case 'Customer':
      return (
        <ContextCard
          icon={Bot}
          iconColor="text-violet-400"
          iconBg="bg-violet-500/10"
          title="Customer Stage"
          description="Identify new requirements, verify profiles, or re-engage with customer for new enquiries."
        >
          <SmallButton
            label="Schedule Consultation"
            color="bg-blue-500 hover:bg-blue-600"
            onClick={() => onLogActivity('MEETING', 'Consultation scheduled')}
          />
        </ContextCard>
      );

    case 'Enquiry Design Estimate':
      return (
        <ContextCard
          icon={FileText}
          iconColor="text-teal-400"
          iconBg="bg-teal-500/10"
          title="Enquiry, Design & Estimate"
          description="Prepare design, estimate specifications and draw up quotation proposals."
        >
          <SmallButton
            label="Log Design Completion"
            color="bg-teal-500 hover:bg-teal-600"
            onClick={() => onLogActivity('QUOTATION', 'Design and Estimate completed')}
          />
        </ContextCard>
      );

    case 'PO / Advance':
      return (
        <ContextCard
          icon={CreditCard}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10"
          title="PO / Advance Received"
          description="Ensure Purchase Order is uploaded and/or Advance payment is collected."
        >
          <SmallButton
            label="Verify PO / Advance"
            color="bg-purple-500 hover:bg-purple-600"
            onClick={() => onLogActivity('PAYMENT', 'PO / Advance verified')}
          />
        </ContextCard>
      );

    case 'Bill of Material':
      return (
        <ContextCard
          icon={Package}
          iconColor="text-orange-400"
          iconBg="bg-orange-500/10"
          title="Bill of Material (BOM)"
          description="Verify components and raw materials needed for production."
        >
          <SmallButton
            label="Generate BOM"
            color="bg-orange-500 hover:bg-orange-600"
            onClick={() => onLogActivity('SYSTEM', 'BOM generated and pushed to production')}
          />
        </ContextCard>
      );

    case 'Manufacturing':
      return (
        <ContextCard
          icon={Package}
          iconColor="text-pink-400"
          iconBg="bg-pink-500/10"
          title="Manufacturing & Production"
          description="The items are currently in assembly or production queue."
        >
          <SmallButton
            label="Complete Production"
            color="bg-pink-500 hover:bg-pink-600"
            onClick={() => onLogActivity('DELIVERY', 'Production and assembly completed')}
          />
        </ContextCard>
      );

    case 'Inspection':
      return (
        <ContextCard
          icon={CheckCircle2}
          iconColor="text-cyan-400"
          iconBg="bg-cyan-500/10"
          title="Quality Inspection"
          description="Verify build quality, checklist standards, and compliance tests."
        >
          <SmallButton
            label="Pass Inspection"
            color="bg-cyan-500 hover:bg-cyan-600"
            onClick={() => onLogActivity('FEEDBACK', 'Quality inspection passed successfully')}
          />
        </ContextCard>
      );

    case 'Invoice':
      return (
        <ContextCard
          icon={FileText}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          title="Commercial Invoice"
          description="Generate invoice document and calculate taxes for payment collection."
        >
          <SmallButton
            label="Send Invoice"
            color="bg-emerald-500 hover:bg-emerald-600"
            onClick={() => onLogActivity('SYSTEM', 'Invoice sent to buyer')}
          />
        </ContextCard>
      );

    case 'Estimate vs Actual':
      return (
        <ContextCard
          icon={FileText}
          iconColor="text-yellow-400"
          iconBg="bg-yellow-500/10"
          title="Estimate vs Actual Reconciliation"
          description="Compare calculated material estimates with actual production/service costs."
        >
          <SmallButton
            label="Approve Audit"
            color="bg-yellow-500 hover:bg-yellow-600"
            onClick={() => onLogActivity('NOTE', 'Estimate vs Actual cost audit finalized')}
          />
        </ContextCard>
      );

    case 'Dispatch':
      return (
        <ContextCard
          icon={Truck}
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/10"
          title="Order Dispatched"
          description="Package shipped and logistics details updated."
        >
          <SmallButton
            label="Track Delivery"
            color="bg-indigo-500 hover:bg-indigo-600"
            onClick={() => onLogActivity('DELIVERY', 'Logistics details verified')}
          />
        </ContextCard>
      );

    case 'Payment':
      return (
        <ContextCard
          icon={CreditCard}
          iconColor="text-sky-400"
          iconBg="bg-sky-500/10"
          title="Final Payment Collection"
          description="Record final pending balance transaction and close billing ledger."
        >
          <SmallButton
            label="Record Final Payment"
            color="bg-sky-500 hover:bg-sky-600"
            onClick={() => onLogActivity('PAYMENT', 'Final balance payment received')}
          />
        </ContextCard>
      );

    case 'Appreciation':
      return (
        <ContextCard
          icon={Star}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10"
          title="Appreciation & Review"
          description="Record customer rating, thanks, and repeat purchase probability."
        >
          <SmallButton
            label="Record Appraisal"
            color="bg-rose-500 hover:bg-rose-600"
            onClick={() => onLogActivity('FEEDBACK', 'Appreciation feedback documented')}
          />
        </ContextCard>
      );

    default:
      return null;
  }
}

// ── Shared sub-components ──

function ContextCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  children,
}: {
  icon: typeof Phone;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-slate-400">{description}</p>
      {children}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: typeof Phone;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-slate-700 p-2.5 text-xs font-medium text-slate-300 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-white"
    >
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      {label}
    </button>
  );
}

function SmallButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all ${color}`}
    >
      {label}
    </button>
  );
}
