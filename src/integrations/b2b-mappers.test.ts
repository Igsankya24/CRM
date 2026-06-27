import { describe, expect, it } from 'vitest'
import { mapIndiaMartToLead } from './indiamart/mappers'
import { mapTradeIndiaToLead } from './tradeindia/mappers'
import { mapExportersIndiaToLead } from './exportersindia/mappers'

describe('B2B Marketplace Mappers', () => {
  const accountId = '00000000-0000-0000-0000-000000000000'

  describe('IndiaMART mapper', () => {
    it('correctly maps raw enquiry to standard B2BLead', () => {
      const raw = {
        UNIQUE_QUERY_ID: 'IM123456',
        SENDER_NAME: 'Sanket B',
        SENDER_MOBILE: '919999999999',
        SENDER_EMAIL: 'sanket@example.com',
        SENDER_COMPANY: 'Antigravity',
        SENDER_CITY: 'Mumbai',
        SENDER_STATE: 'Maharashtra',
        SENDER_COUNTRY_ISO: 'IN',
        QUERY_PRODUCT_NAME: 'AI Agent CRM',
        QUERY_QTY: '10 Units',
        QUERY_MESSAGE: 'Interested in demo',
        DATE_RECV_TIME: '2026-06-14 12:30:00'
      }

      const mapped = mapIndiaMartToLead(raw, accountId)

      expect(mapped.account_id).toBe(accountId)
      expect(mapped.platform).toBe('INDIAMART')
      expect(mapped.external_lead_id).toBe('IM123456')
      expect(mapped.buyer_name).toBe('Sanket B')
      expect(mapped.company_name).toBe('Antigravity')
      expect(mapped.mobile).toBe('919999999999')
      expect(mapped.email).toBe('sanket@example.com')
      expect(mapped.city).toBe('Mumbai')
      expect(mapped.state).toBe('Maharashtra')
      expect(mapped.country).toBe('IN')
      expect(mapped.product_name).toBe('AI Agent CRM')
      expect(mapped.quantity).toBe('10 Units')
      expect(mapped.message).toBe('Interested in demo')
      expect(mapped.status).toBe('pending')
      expect(mapped.lead_source).toBe('INDIAMART')
      expect(new Date(mapped.received_at).toISOString()).toBe(new Date('2026-06-14 12:30:00').toISOString())
      expect(mapped.inquiry_at).toBe(new Date('2026-06-14 12:30:00').toISOString())
    })

    it('handles missing values and applies sensible fallbacks', () => {
      const raw = {
        UNIQUE_QUERY_ID: 'IM999'
      }

      const mapped = mapIndiaMartToLead(raw, accountId)

      expect(mapped.buyer_name).toBe('Unknown Buyer')
      expect(mapped.company_name).toBeNull()
      expect(mapped.mobile).toBeNull()
      expect(mapped.country).toBe('IN')
      expect(mapped.product_name).toBeNull()
      expect(mapped.quantity).toBeNull()
      expect(mapped.received_at).toBeDefined()
      expect(mapped.inquiry_at).toBeNull()
    })
  })

  describe('TradeIndia mapper', () => {
    it('correctly maps raw TradeIndia inquiry to standard B2BLead', () => {
      const raw = {
        inquiry_id: 'TI654321',
        sender_name: 'Jane Doe',
        sender_mobile: '+91-8888888888',
        sender_email: 'jane@example.com',
        sender_co: 'Doe Corp',
        sender_city: 'Delhi',
        sender_state: 'Delhi',
        sender_country: 'India',
        product_name: 'Lead Analyzer',
        quantity: '500 Pcs',
        message: 'Need quote',
        generated_date: '2026-06-14T08:00:00Z'
      }

      const mapped = mapTradeIndiaToLead(raw, accountId)

      expect(mapped.platform).toBe('TRADEINDIA')
      expect(mapped.external_lead_id).toBe('TI654321')
      expect(mapped.buyer_name).toBe('Jane Doe')
      expect(mapped.company_name).toBe('Doe Corp')
      expect(mapped.mobile).toBe('+918888888888') // sanitized
      expect(mapped.email).toBe('jane@example.com')
      expect(mapped.city).toBe('Delhi')
      expect(mapped.state).toBe('Delhi')
      expect(mapped.country).toBe('India')
      expect(mapped.product_name).toBe('Lead Analyzer')
      expect(mapped.quantity).toBe('500 Pcs')
      expect(mapped.message).toBe('Need quote')
      expect(mapped.received_at).toBe('2026-06-14T08:00:00.000Z')
      expect(mapped.inquiry_at).toBe('2026-06-14T08:00:00.000Z')
    })
  })

  describe('ExportersIndia mapper', () => {
    it('correctly maps raw ExportersIndia enquiry to standard B2BLead', () => {
      const raw = {
        enquiry_id: 'EI987654',
        buyer_name: 'Alice Smith',
        mobile: '09876 543210',
        email: 'alice@example.com',
        company: 'Alice Ltd',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        product: 'Compressor',
        qty: '2 Sets',
        enq_msg: 'Ship to Bangalore',
        enq_date: '2026-06-14T10:15:00.000Z'
      }

      const mapped = mapExportersIndiaToLead(raw, accountId)

      expect(mapped.platform).toBe('EXPORTERSINDIA')
      expect(mapped.external_lead_id).toBe('EI987654')
      expect(mapped.buyer_name).toBe('Alice Smith')
      expect(mapped.company_name).toBe('Alice Ltd')
      expect(mapped.mobile).toBe('09876543210') // space stripped
      expect(mapped.product_name).toBe('Compressor')
      expect(mapped.quantity).toBe('2 Sets')
      expect(mapped.message).toBe('Ship to Bangalore')
      expect(mapped.received_at).toBe('2026-06-14T10:15:00.000Z')
      expect(mapped.inquiry_at).toBe('2026-06-14T10:15:00.000Z')
    })
  })
})
