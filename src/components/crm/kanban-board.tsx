'use client';

import { useCallback } from 'react';
import {
  CRM_STAGES,
  CRM_STAGE_LABELS,
  CRM_STAGE_COLORS,
  CrmStage,
  CrmLead,
} from '@/types/crm';
import { LeadCard } from './lead-card';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import { Flame, AlertTriangle, TrendingUp, IndianRupee } from 'lucide-react';

// ── Droppable Stage Column ──
function StageColumn({
  stage,
  leads,
  stats,
  onLeadClick,
}: {
  stage: CrmStage;
  leads: CrmLead[];
  stats: { count: number; value: number; hot: number; overdue: number };
  onLeadClick: (lead: CrmLead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  const color = CRM_STAGE_COLORS[stage];

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-[280px] min-w-[280px] flex-col rounded-xl border transition-all duration-200 ${
        isOver
          ? 'border-primary/60 bg-primary/5 shadow-lg shadow-primary/10'
          : 'border-slate-800 bg-slate-900/40'
      }`}
    >
      {/* Stage Header */}
      <div className="flex flex-col gap-1.5 border-b border-slate-800 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {CRM_STAGE_LABELS[stage]}
            </span>
          </div>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-800 px-1.5 text-[10px] font-bold text-slate-400">
            {stats.count}
          </span>
        </div>

        {/* Stage Stats */}
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          {stats.value > 0 && (
            <span className="flex items-center gap-0.5">
              <IndianRupee className="h-2.5 w-2.5" />
              {formatCompact(stats.value)}
            </span>
          )}
          {stats.hot > 0 && (
            <span className="flex items-center gap-0.5 text-orange-400">
              <Flame className="h-2.5 w-2.5" />
              {stats.hot}
            </span>
          )}
          {stats.overdue > 0 && (
            <span className="flex items-center gap-0.5 text-red-400">
              <AlertTriangle className="h-2.5 w-2.5" />
              {stats.overdue}
            </span>
          )}
        </div>
      </div>

      {/* Lead Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2 scrollbar-thin">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick(lead)}
          />
        ))}
        {leads.length === 0 && (
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-600">
            No leads
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Kanban Board ──
export function KanbanBoard({
  stages,
  onLeadClick,
  onMoveLeadOptimistic,
  onCommitTransition,
}: {
  stages: Record<string, { leads: CrmLead[]; count: number; value: number; hot: number; overdue: number }>;
  onLeadClick: (lead: CrmLead) => void;
  onMoveLeadOptimistic: (leadId: string, from: CrmStage, to: CrmStage) => void;
  onCommitTransition: (leadId: string, to: CrmStage) => Promise<{ success: boolean; error: string | null }>;
}) {
  const [activeLead, setActiveLead] = useState<CrmLead | null>(null);
  const [activeFromStage, setActiveFromStage] = useState<CrmStage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const leadId = event.active.id as string;
    // Find the lead across all stages
    for (const stage of CRM_STAGES) {
      const found = stages[stage]?.leads.find((l) => l.id === leadId);
      if (found) {
        setActiveLead(found);
        setActiveFromStage(stage);
        break;
      }
    }
  }, [stages]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveLead(null);

      if (!over || !activeFromStage) return;

      const leadId = active.id as string;
      const toStage = over.id as CrmStage;

      if (activeFromStage === toStage) return;

      // Optimistic move
      onMoveLeadOptimistic(leadId, activeFromStage, toStage);

      // Commit to server
      const result = await onCommitTransition(leadId, toStage);
      if (!result.success) {
        // The hook will refetch on failure
        console.error('Transition failed:', result.error);
      }

      setActiveFromStage(null);
    },
    [activeFromStage, onMoveLeadOptimistic, onCommitTransition],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-3 overflow-x-auto pb-4">
        {CRM_STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            leads={stages[stage]?.leads || []}
            stats={stages[stage] || { count: 0, value: 0, hot: 0, overdue: 0 }}
            onLeadClick={onLeadClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="rotate-2 opacity-90">
            <LeadCard lead={activeLead} onClick={() => {}} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Helper ──
function formatCompact(value: number): string {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}
