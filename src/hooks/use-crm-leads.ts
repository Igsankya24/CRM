// ============================================================
// CRM Leads Hook — CRUD operations for CRM leads
// ============================================================

'use client';

import { useState, useCallback } from 'react';
import type { CrmLead, CrmStage, CrmSource, LeadCategory, CreateCrmLeadRequest } from '@/types/crm';

interface UseCrmLeadsOptions {
  stage?: CrmStage;
  category?: LeadCategory;
  source?: CrmSource;
  assigned_to?: string;
  search?: string;
  limit?: number;
}

export function useCrmLeads(options: UseCrmLeadsOptions = {}) {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async (opts?: UseCrmLeadsOptions) => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    const merged = { ...options, ...opts };
    if (merged.stage) params.set('stage', merged.stage);
    if (merged.category) params.set('category', merged.category);
    if (merged.source) params.set('source', merged.source);
    if (merged.assigned_to) params.set('assigned_to', merged.assigned_to);
    if (merged.search) params.set('search', merged.search);
    if (merged.limit) params.set('limit', String(merged.limit));

    try {
      const res = await fetch(`/api/crm/leads?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch leads');
      setLeads(data.leads || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [options]);

  const createLead = useCallback(async (data: CreateCrmLeadRequest) => {
    try {
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create lead');
      return { lead: result.lead as CrmLead, error: null };
    } catch (err) {
      return { lead: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, []);

  const updateLead = useCallback(async (id: string, data: Partial<CrmLead>) => {
    try {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update lead');

      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...result.lead } : l)));
      return { lead: result.lead as CrmLead, error: null };
    } catch (err) {
      return { lead: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/crm/leads/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete lead');

      setLeads((prev) => prev.filter((l) => l.id !== id));
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, []);

  const transitionStage = useCallback(async (id: string, toStage: CrmStage, reason?: string) => {
    try {
      const res = await fetch(`/api/crm/leads/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_stage: toStage, reason }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to transition stage');

      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage: toStage } : l)));
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, []);

  return {
    leads,
    total,
    loading,
    error,
    fetchLeads,
    createLead,
    updateLead,
    deleteLead,
    transitionStage,
    setLeads,
  };
}
