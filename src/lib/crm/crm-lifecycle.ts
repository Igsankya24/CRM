// ============================================================
// CRM Lifecycle Engine
// Server-side logic for CRM lead operations.
// ============================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  CrmStage,
  CrmSource,
  CrmLead,
  CrmActivity,
  CrmActivityType,
  CRM_STAGE_TRANSITIONS,
  CRM_STAGE_LABELS,
  LeadCategory,
  LeadUrgency,
} from '@/types/crm';
import { decrypt } from '@/lib/whatsapp/encryption';
import { sendTextMessage } from '@/lib/whatsapp/meta-api';

// ────────────────────────────────────────────
// Stage Transition Validation
// ────────────────────────────────────────────
export function isValidTransition(from: CrmStage, to: CrmStage): boolean {
  const allowed = CRM_STAGE_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}

// ────────────────────────────────────────────
// Create CRM Lead
// ────────────────────────────────────────────
export async function createCrmLead(
  supabase: SupabaseClient,
  accountId: string,
  data: {
    source: CrmSource;
    buyer_name?: string;
    company_name?: string;
    phone?: string;
    email?: string;
    city?: string;
    state?: string;
    country?: string;
    product_name?: string;
    quantity?: string;
    expected_value?: number;
    currency?: string;
    b2b_lead_id?: string;
    contact_id?: string;
    conversation_id?: string;
    inquiry_at?: string;
  },
  performedBy?: string,
): Promise<{ lead: CrmLead | null; error: string | null }> {
  // Duplicate check by phone within account
  if (data.phone) {
    const normalized = data.phone.replace(/[^0-9]/g, '');
    if (normalized) {
      const { data: existing } = await supabase
        .from('crm_leads')
        .select('id')
        .eq('account_id', accountId)
        .ilike('phone', `%${normalized.slice(-10)}%`)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Return existing lead instead of creating duplicate
        const { data: existingLead } = await supabase
          .from('crm_leads')
          .select('*')
          .eq('id', existing.id)
          .single();
        return { lead: existingLead as CrmLead, error: null };
      }
    }
  }

  const { data: lead, error } = await supabase
    .from('crm_leads')
    .insert({
      account_id: accountId,
      source: data.source,
      stage: 'Customer' as CrmStage,
      buyer_name: data.buyer_name || null,
      company_name: data.company_name || null,
      phone: data.phone || null,
      email: data.email || null,
      city: data.city || null,
      state: data.state || null,
      country: data.country || null,
      product_name: data.product_name || null,
      quantity: data.quantity || null,
      expected_value: data.expected_value || null,
      currency: data.currency || 'INR',
      b2b_lead_id: data.b2b_lead_id || null,
      contact_id: data.contact_id || null,
      conversation_id: data.conversation_id || null,
      inquiry_at: data.inquiry_at || new Date().toISOString(),
      ai_engagement_status: 'NOT_STARTED',
      lead_score: 0,
    })
    .select()
    .single();

  if (error) {
    return { lead: null, error: error.message };
  }

  const crmLead = lead as CrmLead;

  // Create initial history entry
  await supabase.from('crm_lead_history').insert({
    account_id: accountId,
    crm_lead_id: crmLead.id,
    from_stage: null,
    to_stage: 'Customer',
    changed_by: performedBy || null,
    change_reason: `Lead captured from ${data.source}`,
  });

  // Create initial activity
  await createActivity(supabase, accountId, {
    crm_lead_id: crmLead.id,
    activity_type: 'SYSTEM',
    title: 'Lead Created',
    description: `New lead captured from ${data.source}`,
    metadata: { source: data.source },
    performed_by: performedBy,
  });

  return { lead: crmLead, error: null };
}

// ────────────────────────────────────────────
// Transition Stage
// ────────────────────────────────────────────
export async function transitionStage(
  supabase: SupabaseClient,
  accountId: string,
  leadId: string,
  toStage: CrmStage,
  performedBy?: string,
  reason?: string,
): Promise<{ success: boolean; error: string | null }> {
  // Get current lead
  const { data: lead, error: fetchError } = await supabase
    .from('crm_leads')
    .select('id, stage, buyer_name')
    .eq('id', leadId)
    .eq('account_id', accountId)
    .single();

  if (fetchError || !lead) {
    return { success: false, error: 'Lead not found' };
  }

  const fromStage = lead.stage as CrmStage;

  // Validate transition
  if (!isValidTransition(fromStage, toStage)) {
    return {
      success: false,
      error: `Invalid transition from ${CRM_STAGE_LABELS[fromStage]} to ${CRM_STAGE_LABELS[toStage]}`,
    };
  }

  // Update lead stage
  const updateData: Record<string, unknown> = { stage: toStage };

  const { error: updateError } = await supabase
    .from('crm_leads')
    .update(updateData)
    .eq('id', leadId)
    .eq('account_id', accountId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Update previous stage's history entry with exited_at and duration
  const nowStr = new Date().toISOString();
  try {
    const { data: prevHistory } = await supabase
      .from('crm_lead_history')
      .select('id, created_at')
      .eq('crm_lead_id', leadId)
      .eq('to_stage', fromStage)
      .is('exited_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevHistory) {
      const createdTime = new Date(prevHistory.created_at).getTime();
      const exitedTime = new Date(nowStr).getTime();
      const durationSeconds = Math.max(0, Math.floor((exitedTime - createdTime) / 1000));

      await supabase
        .from('crm_lead_history')
        .update({
          exited_at: nowStr,
          duration_seconds: durationSeconds,
        })
        .eq('id', prevHistory.id);
    }
  } catch (e) {
    console.error('Error updating stage duration history:', e);
  }

  // Record history
  await supabase.from('crm_lead_history').insert({
    account_id: accountId,
    crm_lead_id: leadId,
    from_stage: fromStage,
    to_stage: toStage,
    changed_by: performedBy || null,
    change_reason: reason || null,
  });

  // Record activity
  await createActivity(supabase, accountId, {
    crm_lead_id: leadId,
    activity_type: 'STAGE_CHANGE',
    title: `Stage: ${CRM_STAGE_LABELS[fromStage]} → ${CRM_STAGE_LABELS[toStage]}`,
    description: reason || undefined,
    metadata: { from_stage: fromStage, to_stage: toStage },
    performed_by: performedBy,
  });

  // Fire WhatsApp stage notification in background
  void triggerWhatsAppStageNotification(supabase, accountId, leadId, toStage);

  return { success: true, error: null };
}

// ────────────────────────────────────────────
// Create Activity
// ────────────────────────────────────────────
export async function createActivity(
  supabase: SupabaseClient,
  accountId: string,
  data: {
    crm_lead_id: string;
    activity_type: CrmActivityType;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
    performed_by?: string;
  },
): Promise<{ activity: CrmActivity | null; error: string | null }> {
  const { data: activity, error } = await supabase
    .from('crm_activities')
    .insert({
      account_id: accountId,
      crm_lead_id: data.crm_lead_id,
      activity_type: data.activity_type,
      title: data.title,
      description: data.description || null,
      metadata: data.metadata || {},
      performed_by: data.performed_by || null,
    })
    .select()
    .single();

  if (error) {
    return { activity: null, error: error.message };
  }

  return { activity: activity as CrmActivity, error: null };
}

// ────────────────────────────────────────────
// Lead Scoring
// ────────────────────────────────────────────
export function calculateLeadScore(lead: Partial<CrmLead>): {
  score: number;
  category: LeadCategory;
  urgency: LeadUrgency;
} {
  let score = 0;

  // Phone provided (+10)
  if (lead.phone) score += 10;

  // Email provided (+5)
  if (lead.email) score += 5;

  // Company name provided (+10)
  if (lead.company_name) score += 10;

  // Product specified (+15)
  if (lead.product_name) score += 15;

  // Quantity specified (+10)
  if (lead.quantity) score += 10;

  // Expected value (+5 to +20 based on value)
  if (lead.expected_value) {
    if (lead.expected_value >= 1000000) score += 20;
    else if (lead.expected_value >= 100000) score += 15;
    else if (lead.expected_value >= 10000) score += 10;
    else score += 5;
  }

  // Country specified (+5)
  if (lead.country) score += 5;

  // City/State specified (+5)
  if (lead.city || lead.state) score += 5;

  // Source bonus
  const sourceScores: Partial<Record<CrmSource, number>> = {
    INDIAMART: 10,
    TRADEINDIA: 10,
    EXPORTERSINDIA: 10,
    WEBSITE: 15,
    REFERRAL: 20,
    WHATSAPP: 12,
    ADS: 8,
    MANUAL: 5,
  };
  score += sourceScores[lead.source as CrmSource] || 0;

  // Determine category
  let category: LeadCategory;
  if (score >= 70) category = 'HOT';
  else if (score >= 40) category = 'WARM';
  else category = 'COLD';

  // Determine urgency based on score and source
  let urgency: LeadUrgency;
  if (score >= 80) urgency = 'CRITICAL';
  else if (score >= 60) urgency = 'HIGH';
  else if (score >= 35) urgency = 'MEDIUM';
  else urgency = 'LOW';

  return { score: Math.min(score, 100), category, urgency };
}

// ────────────────────────────────────────────
// Spam Detection (heuristic)
// ────────────────────────────────────────────
export function detectSpam(lead: Partial<CrmLead>): boolean {
  const spamIndicators: boolean[] = [];

  // No phone and no email
  if (!lead.phone && !lead.email) spamIndicators.push(true);

  // Generic/test names
  const testNames = ['test', 'asdf', 'abc', 'xxx', '123', 'demo', 'sample'];
  if (lead.buyer_name && testNames.some((t) => lead.buyer_name!.toLowerCase().includes(t))) {
    spamIndicators.push(true);
  }

  // Very short buyer name (< 2 chars)
  if (lead.buyer_name && lead.buyer_name.trim().length < 2) {
    spamIndicators.push(true);
  }

  // Phone with all same digits
  if (lead.phone) {
    const digits = lead.phone.replace(/[^0-9]/g, '');
    if (digits.length > 5 && new Set(digits.split('')).size === 1) {
      spamIndicators.push(true);
    }
  }

  return spamIndicators.filter(Boolean).length >= 2;
}

// ────────────────────────────────────────────
// Bridge: B2B Lead → CRM Lead
// ────────────────────────────────────────────
export async function createCrmLeadFromB2B(
  supabase: SupabaseClient,
  accountId: string,
  b2bLead: {
    id: string;
    platform: string;
    buyer_name?: string;
    company_name?: string;
    mobile?: string;
    email?: string;
    city?: string;
    state?: string;
    country?: string;
    product_name?: string;
    quantity?: string;
    message?: string;
    inquiry_at?: string;
  },
  performedBy?: string,
): Promise<{ lead: CrmLead | null; error: string | null }> {
  const source = b2bLead.platform as CrmSource;

  return createCrmLead(supabase, accountId, {
    source,
    buyer_name: b2bLead.buyer_name,
    company_name: b2bLead.company_name,
    phone: b2bLead.mobile,
    email: b2bLead.email,
    city: b2bLead.city,
    state: b2bLead.state,
    country: b2bLead.country,
    product_name: b2bLead.product_name,
    quantity: b2bLead.quantity,
    b2b_lead_id: b2bLead.id,
    inquiry_at: b2bLead.inquiry_at,
  }, performedBy);
}

// ────────────────────────────────────────────
// WhatsApp Stage Notification Trigger
// ────────────────────────────────────────────
export async function triggerWhatsAppStageNotification(
  supabase: SupabaseClient,
  accountId: string,
  leadId: string,
  toStage: CrmStage,
): Promise<void> {
  const notifyStages: CrmStage[] = [
    'PO / Advance',
    'Invoice',
    'Dispatch',
    'Payment',
    'Appreciation',
  ];

  if (!notifyStages.includes(toStage)) {
    return;
  }

  try {
    // 1. Fetch lead details (buyer_name, company_name, phone)
    const { data: lead, error: leadErr } = await supabase
      .from('crm_leads')
      .select('buyer_name, company_name, phone')
      .eq('id', leadId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (leadErr || !lead || !lead.phone) {
      console.warn(`[whatsapp-notification] Lead or phone not found for leadId ${leadId}:`, leadErr);
      return;
    }

    // 2. Fetch active WhatsApp configuration
    const { data: config, error: configErr } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, access_token, status')
      .eq('account_id', accountId)
      .eq('status', 'connected')
      .maybeSingle();

    if (configErr || !config || !config.phone_number_id || !config.access_token) {
      console.warn(`[whatsapp-notification] WhatsApp not connected or configured for account ${accountId}`);
      return;
    }

    const accessToken = decrypt(config.access_token);
    if (!accessToken) {
      console.warn(`[whatsapp-notification] Failed to decrypt WhatsApp access token for account ${accountId}`);
      return;
    }

    // Clean phone number format for WhatsApp
    const to = lead.phone.replace(/[^0-9]/g, '');
    if (!to) {
      console.warn(`[whatsapp-notification] Invalid phone number format: ${lead.phone}`);
      return;
    }

    // Build notification message text
    const name = lead.buyer_name || lead.company_name || 'Customer';
    const messageText = `Hello ${name},\n\nYour lead status has been updated to *${toStage}*.\n\nThank you for choosing Phoenix CRM!`;

    // 3. Send message
    await sendTextMessage({
      phoneNumberId: config.phone_number_id,
      accessToken,
      to,
      text: messageText,
    });

    console.log(`[whatsapp-notification] Sent stage entry notification for stage "${toStage}" to ${to}`);
  } catch (err) {
    console.error(`[whatsapp-notification] Error triggering stage notification:`, err);
  }
}
