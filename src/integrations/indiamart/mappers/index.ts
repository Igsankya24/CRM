import type { B2BLead } from '@/types'
import type { IndiaMartRawEnquiry } from '../types'
import { cleanAndParseDate } from '../../shared/date'

export function mapIndiaMartToLead(
  raw: IndiaMartRawEnquiry,
  accountId: string
): Omit<B2BLead, 'id' | 'created_at' | 'updated_at' | 'assignee'> {
  let inquiryAt: string | null = null
  const rawTime = raw.QUERY_TIME || raw.DATE_RECV_TIME || raw.DATE_RECV
  if (rawTime) {
    const dateObj = cleanAndParseDate(rawTime)
    if (!dateObj) {
      throw new Error(`Invalid or missing inquiry timestamp: "${rawTime}"`)
    }
    inquiryAt = dateObj.toISOString()
  }

  // Handle mobile number format.
  // Sometimes IndiaMART prepends "91" or symbols, we keep the raw but cleaned if needed.
  let mobile = raw.SENDER_MOBILE || null
  if (mobile) {
    mobile = mobile.replace(/[^0-9+]/g, '')
  }

  return {
    account_id: accountId,
    platform: 'INDIAMART',
    external_lead_id: raw.UNIQUE_QUERY_ID,
    buyer_name: raw.SENDER_NAME || 'Unknown Buyer',
    company_name: raw.SENDER_COMPANY || null,
    mobile,
    alternate_mobile: null,
    email: raw.SENDER_EMAIL || null,
    city: raw.SENDER_CITY || null,
    state: raw.SENDER_STATE || null,
    country: raw.SENDER_COUNTRY_ISO || 'IN',
    product_name: raw.QUERY_PRODUCT_NAME || null,
    quantity: raw.QUERY_QTY || null,
    message: raw.QUERY_MESSAGE || null,
    status: 'pending',
    lead_source: 'INDIAMART',
    received_at: inquiryAt || new Date().toISOString(),
    inquiry_at: inquiryAt,
    assigned_to: null
  }
}

