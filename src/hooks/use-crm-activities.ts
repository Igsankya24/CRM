// ============================================================
// CRM Activities Hook — Activity timeline with real-time
// ============================================================

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { CrmActivity, CrmActivityType, CreateActivityRequest } from '@/types/crm';

export function useCrmActivities(leadId: string | null) {
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchActivities = useCallback(
    async (opts?: { type?: CrmActivityType; limit?: number; offset?: number }) => {
      if (!leadId) return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (opts?.type) params.set('type', opts.type);
      if (opts?.limit) params.set('limit', String(opts.limit));
      if (opts?.offset) params.set('offset', String(opts.offset));

      try {
        const res = await fetch(
          `/api/crm/leads/${leadId}/activities?${params.toString()}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch activities');
        setActivities(data.activities || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [leadId],
  );

  const addActivity = useCallback(
    async (data: Omit<CreateActivityRequest, 'crm_lead_id'>) => {
      if (!leadId) return { activity: null, error: 'No lead selected' };

      try {
        const res = await fetch(`/api/crm/leads/${leadId}/activities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, crm_lead_id: leadId }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to add activity');

        // Prepend to the list (newest first)
        if (result.activity) {
          setActivities((prev) => [result.activity, ...prev]);
          setTotal((prev) => prev + 1);
        }

        return { activity: result.activity as CrmActivity, error: null };
      } catch (err) {
        return { activity: null, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    },
    [leadId],
  );

  const addNote = useCallback(
    async (text: string) => {
      return addActivity({
        activity_type: 'NOTE',
        title: 'Note Added',
        description: text,
      });
    },
    [addActivity],
  );

  const logCall = useCallback(
    async (description?: string) => {
      return addActivity({
        activity_type: 'CALL',
        title: 'Call Logged',
        description,
      });
    },
    [addActivity],
  );

  const logEmail = useCallback(
    async (description?: string) => {
      return addActivity({
        activity_type: 'EMAIL',
        title: 'Email Sent',
        description,
      });
    },
    [addActivity],
  );

  const logMeeting = useCallback(
    async (description?: string) => {
      return addActivity({
        activity_type: 'MEETING',
        title: 'Meeting Scheduled',
        description,
      });
    },
    [addActivity],
  );

  // Auto-fetch when leadId changes
  useEffect(() => {
    if (leadId) {
      fetchActivities();
    } else {
      setActivities([]);
      setTotal(0);
    }

    return () => {
      abortRef.current?.abort();
    };
  }, [leadId, fetchActivities]);

  return {
    activities,
    total,
    loading,
    error,
    fetchActivities,
    addActivity,
    addNote,
    logCall,
    logEmail,
    logMeeting,
  };
}
