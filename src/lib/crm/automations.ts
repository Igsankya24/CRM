import { SupabaseClient } from '@supabase/supabase-js';
import { transitionStage } from './crm-lifecycle';
import { CrmStage } from '@/types/crm';

export async function handleDocumentAutomation(
  supabase: SupabaseClient,
  accountId: string,
  b2bLeadId: string | null,
  event: 'QUOTATION_APPROVED' | 'PO_UPLOADED' | 'BOM_CREATED' | 'INSPECTION_PASSED' | 'INVOICE_GENERATED' | 'PAYMENT_RECEIVED'
) {
  if (!b2bLeadId) return;

  try {
    // Find matching CRM lead
    const { data: lead, error: fetchErr } = await supabase
      .from('crm_leads')
      .select('id, stage')
      .eq('account_id', accountId)
      .eq('b2b_lead_id', b2bLeadId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchErr) {
      console.error('[crm-automation] Error fetching lead:', fetchErr);
      return;
    }

    if (!lead) {
      console.warn(`[crm-automation] No CRM lead found for b2b_lead_id: ${b2bLeadId}`);
      return;
    }

    // Determine target stage
    let targetStage: CrmStage | null = null;
    switch (event) {
      case 'QUOTATION_APPROVED':
        targetStage = 'PO / Advance';
        break;
      case 'PO_UPLOADED':
        targetStage = 'Bill of Material';
        break;
      case 'BOM_CREATED':
        targetStage = 'Manufacturing';
        break;
      case 'INSPECTION_PASSED':
        targetStage = 'Invoice';
        break;
      case 'INVOICE_GENERATED':
        targetStage = 'Estimate vs Actual';
        break;
      case 'PAYMENT_RECEIVED':
        targetStage = 'Appreciation';
        break;
    }

    if (targetStage && lead.stage !== targetStage) {
      const { success, error } = await transitionStage(
        supabase,
        accountId,
        lead.id,
        targetStage,
        undefined,
        `Automated transition triggered by document event: ${event}`
      );
      
      if (success) {
        console.log(`[crm-automation] Auto-moved lead ${lead.id} from "${lead.stage}" to "${targetStage}" on event "${event}"`);
      } else {
        console.error(`[crm-automation] Failed to auto-move lead ${lead.id} to "${targetStage}":`, error);
      }
    }
  } catch (err) {
    console.error('[crm-automation] Unexpected error in document automation:', err);
  }
}
