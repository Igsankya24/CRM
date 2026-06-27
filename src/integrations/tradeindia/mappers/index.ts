import type { B2BLead } from '@/types'
import type { TradeIndiaRawEnquiry } from '../types'
import { cleanAndParseDate } from '../../shared/date'

export function mapTradeIndiaToLead(
  raw: TradeIndiaRawEnquiry,
  accountId: string
): Omit<B2BLead, 'id' | 'created_at' | 'updated_at' | 'assignee'> {
  let inquiryAt: string | null = null
  if (raw.generated_date) {
    const dateObj = cleanAndParseDate(raw.generated_date)
    if (!dateObj) {
      throw new Error(`Invalid or missing inquiry timestamp: "${raw.generated_date}"`)
    }
    inquiryAt = dateObj.toISOString()
  }

  let mobile = raw.sender_mobile || null
  if (mobile) {
    mobile = mobile.replace(/[^0-9+]/g, '')
  }

  const leadId = String(raw.inquiry_id || raw.rfi_id || '')
  if (!leadId) {
    throw new Error('TradeIndia enquiry payload has neither inquiry_id nor rfi_id.')
  }

  return {
    account_id: accountId,
    platform: 'TRADEINDIA',
    external_lead_id: leadId,
    buyer_name: raw.sender_name || 'Unknown Buyer',
    company_name: raw.sender_co || null,
    mobile,
    alternate_mobile: null,
    email: raw.sender_email || null,
    city: raw.sender_city || null,
    state: raw.sender_state || null,
    country: raw.sender_country || 'India',
    product_name: raw.product_name || null,
    quantity: raw.quantity || null,
    message: raw.message || null,
    status: 'pending',
    lead_source: 'TRADEINDIA',
    received_at: inquiryAt || new Date().toISOString(),
    inquiry_at: inquiryAt,
    assigned_to: null
  }
}

