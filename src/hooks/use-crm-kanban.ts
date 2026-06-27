// ============================================================
// CRM Kanban Hook — Kanban board state with drag support
// ============================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CrmLead, CrmStage, CrmOverview } from '@/types/crm';
import { CRM_STAGES } from '@/types/crm';

interface StageData {
  leads: CrmLead[];
  count: number;
  value: number;
  hot: number;
  overdue: number;
}

export function useCrmKanban() {
  const [stages, setStages] = useState<Record<string, StageData>>({});
  const [overview, setOverview] = useState<CrmOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKanban = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/crm/kanban');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch kanban data');
      setStages(data.stages || {});
      setOverview(data.overview || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Optimistic drag-and-drop: move lead between stages locally
  const moveLeadOptimistic = useCallback(
    (leadId: string, fromStage: CrmStage, toStage: CrmStage) => {
      setStages((prev) => {
        const next = { ...prev };
        const fromData = { ...next[fromStage] };
        const toData = { ...next[toStage] };

        const leadIndex = fromData.leads.findIndex((l) => l.id === leadId);
        if (leadIndex === -1) return prev;

        const [lead] = fromData.leads.splice(leadIndex, 1);
        const movedLead = { ...lead, stage: toStage };
        toData.leads.unshift(movedLead);

        // Update counts
        fromData.count = fromData.leads.length;
        fromData.value = fromData.leads.reduce((s, l) => s + (Number(l.expected_value) || 0), 0);
        fromData.hot = fromData.leads.filter((l) => l.lead_category === 'HOT').length;

        toData.count = toData.leads.length;
        toData.value = toData.leads.reduce((s, l) => s + (Number(l.expected_value) || 0), 0);
        toData.hot = toData.leads.filter((l) => l.lead_category === 'HOT').length;

        next[fromStage] = fromData;
        next[toStage] = toData;
        return next;
      });
    },
    [],
  );

  // Commit the stage transition to the server
  const commitTransition = useCallback(
    async (leadId: string, toStage: CrmStage, reason?: string) => {
      try {
        const res = await fetch(`/api/crm/leads/${leadId}/transition`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to_stage: toStage, reason }),
        });
        const result = await res.json();
        if (!res.ok) {
          // Revert on failure — refetch
          await fetchKanban();
          return { success: false, error: result.error || 'Transition failed' };
        }
        return { success: true, error: null };
      } catch (err) {
        await fetchKanban();
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    },
    [fetchKanban],
  );

  const getStageLeads = useCallback(
    (stage: CrmStage): CrmLead[] => {
      return stages[stage]?.leads || [];
    },
    [stages],
  );

  const getStageStats = useCallback(
    (stage: CrmStage) => {
      return stages[stage] || { count: 0, value: 0, hot: 0, overdue: 0 };
    },
    [stages],
  );

  return {
    stages,
    overview,
    loading,
    error,
    fetchKanban,
    moveLeadOptimistic,
    commitTransition,
    getStageLeads,
    getStageStats,
  };
}
