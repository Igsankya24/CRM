// ============================================================
// CRM Auto-Assignment Engine
// Assigns leads to users based on configurable rules.
// ============================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { CrmLead, CrmAssignmentRule } from '@/types/crm';
import { createActivity } from './crm-lifecycle';

interface AssignmentResult {
  assigned_to: string | null;
  rule_name: string | null;
  error: string | null;
}

// ────────────────────────────────────────────
// Find best assignment for a lead
// ────────────────────────────────────────────
export async function autoAssignLead(
  supabase: SupabaseClient,
  accountId: string,
  lead: CrmLead,
  performedBy?: string,
): Promise<AssignmentResult> {
  // Fetch active rules, ordered by priority
  const { data: rules, error } = await supabase
    .from('crm_assignment_rules')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error || !rules || rules.length === 0) {
    return { assigned_to: null, rule_name: null, error: 'No active assignment rules found' };
  }

  for (const rule of rules as CrmAssignmentRule[]) {
    const match = evaluateRule(rule, lead);
    if (match) {
      if (rule.rule_type === 'ROUND_ROBIN') {
        const assignee = await getNextRoundRobinUser(supabase, accountId, rule);
        if (assignee) {
          await performAssignment(supabase, accountId, lead.id, assignee, rule.rule_name, performedBy);
          return { assigned_to: assignee, rule_name: rule.rule_name, error: null };
        }
      } else if (rule.assign_to) {
        await performAssignment(supabase, accountId, lead.id, rule.assign_to, rule.rule_name, performedBy);
        return { assigned_to: rule.assign_to, rule_name: rule.rule_name, error: null };
      }
    }
  }

  return { assigned_to: null, rule_name: null, error: 'No matching rule found' };
}

// ────────────────────────────────────────────
// Rule evaluation
// ────────────────────────────────────────────
function evaluateRule(rule: CrmAssignmentRule, lead: CrmLead): boolean {
  const conditions = rule.conditions as Record<string, string[] | string>;

  switch (rule.rule_type) {
    case 'STATE': {
      const states = (conditions.states || []) as string[];
      return lead.state != null && states.some(
        (s) => s.toLowerCase() === lead.state!.toLowerCase(),
      );
    }

    case 'COUNTRY': {
      const countries = (conditions.countries || []) as string[];
      return lead.country != null && countries.some(
        (c) => c.toLowerCase() === lead.country!.toLowerCase(),
      );
    }

    case 'SOURCE': {
      const sources = (conditions.sources || []) as string[];
      return sources.includes(lead.source);
    }

    case 'DEPARTMENT': {
      // Department-based — matches if the lead's product category
      // falls under the configured department
      const departments = (conditions.departments || []) as string[];
      // For now, department-based rules match all leads (fallback)
      return departments.length > 0;
    }

    case 'ROUND_ROBIN': {
      // Round-robin always matches as a fallback
      return true;
    }

    default:
      return false;
  }
}

// ────────────────────────────────────────────
// Round-robin user selection
// ────────────────────────────────────────────
async function getNextRoundRobinUser(
  supabase: SupabaseClient,
  accountId: string,
  rule: CrmAssignmentRule,
): Promise<string | null> {
  const conditions = rule.conditions as Record<string, unknown>;
  const userIds = (conditions.user_pool || []) as string[];

  if (userIds.length === 0) {
    // If no specific pool, use all active agents in the account
    const { data: agents } = await supabase
      .from('profiles')
      .select('id')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .in('account_role', ['owner', 'admin', 'agent']);

    if (!agents || agents.length === 0) return null;
    userIds.push(...agents.map((a) => a.id));
  }

  if (userIds.length === 0) return null;

  // Find the user with the fewest recent assignments
  const { data: counts } = await supabase
    .from('crm_leads')
    .select('assigned_to')
    .eq('account_id', accountId)
    .in('assigned_to', userIds)
    .is('deleted_at', null)
    .gte('assigned_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const assignmentCounts = new Map<string, number>();
  for (const uid of userIds) {
    assignmentCounts.set(uid, 0);
  }
  if (counts) {
    for (const row of counts) {
      if (row.assigned_to) {
        assignmentCounts.set(
          row.assigned_to,
          (assignmentCounts.get(row.assigned_to) || 0) + 1,
        );
      }
    }
  }

  // Pick the user with the fewest assignments
  let minCount = Infinity;
  let selected: string | null = null;
  for (const [uid, count] of assignmentCounts) {
    if (count < minCount) {
      minCount = count;
      selected = uid;
    }
  }

  return selected;
}

// ────────────────────────────────────────────
// Perform the assignment
// ────────────────────────────────────────────
async function performAssignment(
  supabase: SupabaseClient,
  accountId: string,
  leadId: string,
  assignTo: string,
  ruleName: string,
  performedBy?: string,
): Promise<void> {
  const now = new Date().toISOString();

  // Update the lead
  await supabase
    .from('crm_leads')
    .update({
      assigned_to: assignTo,
      assigned_at: now,
      stage: 'ASSIGNED',
    })
    .eq('id', leadId)
    .eq('account_id', accountId);

  // Record history
  await supabase.from('crm_lead_history').insert({
    account_id: accountId,
    crm_lead_id: leadId,
    from_stage: 'QUALIFIED',
    to_stage: 'ASSIGNED',
    changed_by: performedBy || null,
    change_reason: `Auto-assigned via rule: ${ruleName}`,
  });

  // Get assigned user info
  const { data: user } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', assignTo)
    .single();

  // Create activity
  await createActivity(supabase, accountId, {
    crm_lead_id: leadId,
    activity_type: 'ASSIGNMENT',
    title: `Assigned to ${user?.full_name || 'Unknown'}`,
    description: `Auto-assigned via rule: ${ruleName}`,
    metadata: { assigned_to: assignTo, rule_name: ruleName },
    performed_by: performedBy,
  });
}

// ────────────────────────────────────────────
// Manual assignment (override)
// ────────────────────────────────────────────
export async function manualAssignLead(
  supabase: SupabaseClient,
  accountId: string,
  leadId: string,
  assignTo: string,
  performedBy: string,
): Promise<{ success: boolean; error: string | null }> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('crm_leads')
    .update({
      assigned_to: assignTo,
      assigned_at: now,
    })
    .eq('id', leadId)
    .eq('account_id', accountId);

  if (error) {
    return { success: false, error: error.message };
  }

  const { data: user } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', assignTo)
    .single();

  await createActivity(supabase, accountId, {
    crm_lead_id: leadId,
    activity_type: 'ASSIGNMENT',
    title: `Manually assigned to ${user?.full_name || 'Unknown'}`,
    description: 'Manual assignment override',
    metadata: { assigned_to: assignTo, manual: true },
    performed_by: performedBy,
  });

  return { success: true, error: null };
}
