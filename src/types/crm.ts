// ============================================================
// CRM Lifecycle Types
// ============================================================

// -- Stage definitions --
export const CRM_STAGES = [
  'Customer',
  'Enquiry Design Estimate',
  'PO / Advance',
  'Bill of Material',
  'Manufacturing',
  'Inspection',
  'Invoice',
  'Estimate vs Actual',
  'Dispatch',
  'Payment',
  'Appreciation',
] as const;

export type CrmStage = (typeof CRM_STAGES)[number];

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  Customer: 'Customer',
  'Enquiry Design Estimate': 'Enquiry Design Estimate',
  'PO / Advance': 'PO / Advance',
  'Bill of Material': 'Bill of Material',
  Manufacturing: 'Manufacturing',
  Inspection: 'Inspection',
  Invoice: 'Invoice',
  'Estimate vs Actual': 'Estimate vs Actual',
  Dispatch: 'Dispatch',
  Payment: 'Payment',
  Appreciation: 'Appreciation',
};

export const CRM_STAGE_COLORS: Record<CrmStage, string> = {
  Customer: '#3b82f6',                // blue
  'Enquiry Design Estimate': '#10b981', // green
  'PO / Advance': '#8b5cf6',           // purple
  'Bill of Material': '#f97316',       // orange
  Manufacturing: '#ec4899',           // pink
  Inspection: '#06b6d4',              // cyan
  Invoice: '#14b8a6',                 // teal
  'Estimate vs Actual': '#f59e0b',    // amber
  Dispatch: '#6366f1',                // indigo
  Payment: '#0ea5e9',                 // sky
  Appreciation: '#e11d48',            // rose
};

// -- Valid stage transitions --
export const CRM_STAGE_TRANSITIONS: Record<CrmStage, CrmStage[]> = {
  Customer: ['Enquiry Design Estimate', 'PO / Advance', 'Bill of Material', 'Manufacturing', 'Inspection', 'Invoice', 'Estimate vs Actual', 'Dispatch', 'Payment', 'Appreciation'],
  'Enquiry Design Estimate': ['Customer', 'PO / Advance', 'Bill of Material', 'Manufacturing', 'Inspection', 'Invoice', 'Estimate vs Actual', 'Dispatch', 'Payment', 'Appreciation'],
  'PO / Advance': ['Customer', 'Enquiry Design Estimate', 'Bill of Material', 'Manufacturing', 'Inspection', 'Invoice', 'Estimate vs Actual', 'Dispatch', 'Payment', 'Appreciation'],
  'Bill of Material': ['Customer', 'Enquiry Design Estimate', 'PO / Advance', 'Manufacturing', 'Inspection', 'Invoice', 'Estimate vs Actual', 'Dispatch', 'Payment', 'Appreciation'],
  Manufacturing: ['Customer', 'Enquiry Design Estimate', 'PO / Advance', 'Bill of Material', 'Inspection', 'Invoice', 'Estimate vs Actual', 'Dispatch', 'Payment', 'Appreciation'],
  Inspection: ['Customer', 'Enquiry Design Estimate', 'PO / Advance', 'Bill of Material', 'Manufacturing', 'Invoice', 'Estimate vs Actual', 'Dispatch', 'Payment', 'Appreciation'],
  Invoice: ['Customer', 'Enquiry Design Estimate', 'PO / Advance', 'Bill of Material', 'Manufacturing', 'Inspection', 'Estimate vs Actual', 'Dispatch', 'Payment', 'Appreciation'],
  'Estimate vs Actual': ['Customer', 'Enquiry Design Estimate', 'PO / Advance', 'Bill of Material', 'Manufacturing', 'Inspection', 'Invoice', 'Dispatch', 'Payment', 'Appreciation'],
  Dispatch: ['Customer', 'Enquiry Design Estimate', 'PO / Advance', 'Bill of Material', 'Manufacturing', 'Inspection', 'Invoice', 'Estimate vs Actual', 'Payment', 'Appreciation'],
  Payment: ['Customer', 'Enquiry Design Estimate', 'PO / Advance', 'Bill of Material', 'Manufacturing', 'Inspection', 'Invoice', 'Estimate vs Actual', 'Dispatch', 'Appreciation'],
  Appreciation: ['Customer', 'Enquiry Design Estimate', 'PO / Advance', 'Bill of Material', 'Manufacturing', 'Inspection', 'Invoice', 'Estimate vs Actual', 'Dispatch', 'Payment'],
};

export type CrmSource =
  | 'INDIAMART'
  | 'TRADEINDIA'
  | 'EXPORTERSINDIA'
  | 'ALIBABA'
  | 'WEBSITE'
  | 'ADS'
  | 'WHATSAPP'
  | 'MANUAL'
  | 'REFERRAL';

export type LeadCategory = 'HOT' | 'WARM' | 'COLD' | 'LOST';

export type LeadUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CloseReason =
  | 'WON'
  | 'LOST'
  | 'NO_RESPONSE'
  | 'FAKE_INQUIRY'
  | 'COMPETITOR'
  | 'BUDGET_ISSUE';

export type AiEngagementStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'HANDED_OFF';

export type CustomerCategory = 'A' | 'B' | 'C';

export type CrmActivityType =
  | 'AI_MESSAGE'
  | 'WHATSAPP_CHAT'
  | 'CALL'
  | 'EMAIL'
  | 'MEETING'
  | 'VIDEO_CALL'
  | 'NOTE'
  | 'STAGE_CHANGE'
  | 'ASSIGNMENT'
  | 'QUOTATION'
  | 'PAYMENT'
  | 'DELIVERY'
  | 'FEEDBACK'
  | 'SYSTEM';

// -- Row types --
export interface CrmLead {
  id: string;
  account_id: string;
  b2b_lead_id: string | null;
  contact_id: string | null;
  conversation_id: string | null;
  buyer_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  source: CrmSource;
  stage: CrmStage;
  lead_category: LeadCategory | null;
  lead_score: number;
  is_spam: boolean;
  urgency: LeadUrgency | null;
  assigned_to: string | null;
  assigned_at: string | null;
  ai_summary: string | null;
  ai_engagement_status: AiEngagementStatus;
  close_reason: CloseReason | null;
  closed_at: string | null;
  expected_value: number | null;
  currency: string;
  customer_category: CustomerCategory | null;
  product_name: string | null;
  quantity: string | null;
  next_followup_at: string | null;
  last_contacted_at: string | null;
  inquiry_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined fields (optional, populated by API)
  assigned_user?: { id: string; full_name: string; avatar_url: string | null };
}

export interface CrmLeadHistory {
  id: string;
  account_id: string;
  crm_lead_id: string;
  from_stage: CrmStage | null;
  to_stage: CrmStage;
  changed_by: string | null;
  change_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CrmActivity {
  id: string;
  account_id: string;
  crm_lead_id: string;
  activity_type: CrmActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  performed_by: string | null;
  created_at: string;
  // Joined
  performer?: { id: string; full_name: string; avatar_url: string | null };
}

export interface CrmRequirement {
  id: string;
  account_id: string;
  crm_lead_id: string;
  product: string | null;
  quantity: string | null;
  budget: number | null;
  budget_currency: string;
  delivery_location: string | null;
  payment_terms: string | null;
  special_requirements: string | null;
  ai_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmQuotation {
  id: string;
  account_id: string;
  crm_lead_id: string;
  quotation_number: string | null;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'REVISED';
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  discount_percent: number;
  discount_amount: number;
  total: number;
  currency: string;
  valid_until: string | null;
  notes: string | null;
  terms_conditions: string | null;
  sent_via_whatsapp: boolean;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: CrmQuotationItem[];
}

export interface CrmQuotationItem {
  id: string;
  quotation_id: string;
  product_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  position: number;
  created_at: string;
}

export interface CrmNegotiation {
  id: string;
  account_id: string;
  crm_lead_id: string;
  negotiation_type: 'PRICE_CHANGE' | 'COUNTER_OFFER' | 'MESSAGE' | 'REMARK' | 'AI_SUGGESTION';
  original_value: number | null;
  proposed_value: number | null;
  message: string | null;
  proposed_by: 'BUYER' | 'SELLER' | 'AI';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED';
  created_by: string | null;
  created_at: string;
}

export interface CrmSample {
  id: string;
  account_id: string;
  crm_lead_id: string;
  product_name: string | null;
  quantity: string | null;
  status: 'REQUESTED' | 'SENT' | 'APPROVED' | 'REJECTED';
  sent_at: string | null;
  tracking_number: string | null;
  feedback: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmOrder {
  id: string;
  account_id: string;
  crm_lead_id: string;
  po_number: string | null;
  order_value: number | null;
  currency: string;
  expected_dispatch: string | null;
  payment_terms: string | null;
  notes: string | null;
  status: 'CONFIRMED' | 'IN_PRODUCTION' | 'READY' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED';
  confirmed_at: string;
  created_at: string;
  updated_at: string;
}

export interface CrmPayment {
  id: string;
  account_id: string;
  crm_lead_id: string;
  order_id: string | null;
  payment_type: 'ADVANCE' | 'PARTIAL' | 'FULL' | 'REFUND';
  amount: number;
  currency: string;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  received_at: string;
  created_at: string;
}

export interface CrmProduction {
  id: string;
  account_id: string;
  crm_lead_id: string;
  order_id: string | null;
  status: 'MANUFACTURING' | 'PACKING' | 'READY_FOR_DISPATCH';
  notes: string | null;
  estimated_completion: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmDelivery {
  id: string;
  account_id: string;
  crm_lead_id: string;
  order_id: string | null;
  transport_details: string | null;
  courier: string | null;
  tracking_number: string | null;
  dispatch_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  delivery_proof_url: string | null;
  notes: string | null;
  status: 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED';
  created_at: string;
  updated_at: string;
}

export interface CrmSupportTicket {
  id: string;
  account_id: string;
  crm_lead_id: string;
  ticket_type: 'FEEDBACK' | 'COMPLAINT' | 'WARRANTY' | 'REPLACEMENT' | 'SERVICE';
  subject: string;
  description: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmAppraisal {
  id: string;
  account_id: string;
  crm_lead_id: string;
  rating: number | null;
  review: string | null;
  repeat_order_probability: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | null;
  customer_category: CustomerCategory | null;
  feedback_source: 'WHATSAPP' | 'CALL' | 'EMAIL' | 'IN_PERSON' | 'FORM' | null;
  recorded_by: string | null;
  created_at: string;
}

export interface CrmAssignmentRule {
  id: string;
  account_id: string;
  rule_name: string;
  rule_type: 'STATE' | 'COUNTRY' | 'DEPARTMENT' | 'ROUND_ROBIN' | 'SOURCE';
  conditions: Record<string, unknown>;
  assign_to: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// -- Pipeline stats --
export interface CrmPipelineStats {
  stage: CrmStage;
  lead_count: number;
  pipeline_value: number;
  hot_count: number;
  overdue_followups: number;
}

export interface CrmOverview {
  total_leads: number;
  new_today: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  total_pipeline_value: number;
  conversion_rate: number;
  overdue_followups: number;
  avg_lead_score: number;
}

// -- API request/response types --
export interface CreateCrmLeadRequest {
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
}

export interface TransitionStageRequest {
  to_stage: CrmStage;
  reason?: string;
}

export interface CreateActivityRequest {
  crm_lead_id: string;
  activity_type: CrmActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
