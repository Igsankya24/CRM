import type { B2BLead } from '@/types'
import type { ExportersIndiaRawEnquiry } from '../types'
import { cleanAndParseDate } from '../../shared/date'

export function mapExportersIndiaToLead(
  raw: ExportersIndiaRawEnquiry,
  accountId: string
): Omit<B2BLead, 'id' | 'created_at' | 'updated_at' | 'assignee'> {
  let inquiryAt: string | null = null
  if (raw.enq_date) {
    const dateObj = cleanAndParseDate(raw.enq_date)
    if (!dateObj) {
      throw new Error(`Invalid or missing inquiry timestamp: "${raw.enq_date}"`)
    }
    inquiryAt = dateObj.toISOString()
  }

  let mobile = raw.mobile || null
  if (mobile) {
    mobile = mobile.replace(/[^0-9+]/g, '')
  }

  return {
    account_id: accountId,
    platform: 'EXPORTERSINDIA',
    external_lead_id: raw.enquiry_id,
    buyer_name: raw.buyer_name || 'Unknown Buyer',
    company_name: raw.company || null,
    mobile,
    alternate_mobile: null,
    email: raw.email || null,
    city: raw.city || null,
    state: raw.state || null,
    country: raw.country || 'India',
    product_name: raw.product || null,
    quantity: raw.qty || null,
    message: raw.enq_msg || null,
    status: 'pending',
    lead_source: 'EXPORTERSINDIA',
    received_at: inquiryAt || new Date().toISOString(),
    inquiry_at: inquiryAt,
    assigned_to: null
  }
}

