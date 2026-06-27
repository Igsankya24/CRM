import { describe, expect, it } from 'vitest'
import { IndiaMartService } from './indiamart/services/indiamart'
import { TradeIndiaService } from './tradeindia/services/tradeindia'
import { ExportersIndiaService } from './exportersindia/services/exportersindia'
import { cleanAndParseDate } from './shared/date'
import type { B2BIntegration } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('B2B Services Historical Sync', () => {
  const mockConfig: B2BIntegration = {
    id: 'test-integration-id',
    account_id: 'test-account-id',
    platform: 'INDIAMART',
    enabled: true,
    api_key: 'mock-test-key',
    username: '9999999999',
    client_id: 'mock-client-id',
    api_url: null,
    sync_interval: '1h',
    last_sync_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  describe('IndiaMartService', () => {
    it('fetches historical batch for page 1 in mock mode', async () => {
      const config = { ...mockConfig, platform: 'INDIAMART' as const }
      const res = await IndiaMartService.fetchHistoricalBatch(config, 1)
      expect(res.leads).toHaveLength(1)
      expect(res.leads[0].UNIQUE_QUERY_ID).toContain('IM-HIST-1')
      expect(res.startStr).toBeDefined()
      expect(res.endStr).toBeDefined()
    })
  })

  describe('TradeIndiaService', () => {
    it('fetches historical batch for page 5 in mock mode', async () => {
      const config = { ...mockConfig, platform: 'TRADEINDIA' as const }
      const res = await TradeIndiaService.fetchHistoricalBatch(config, 5)
      expect(res.leads).toHaveLength(1)
      expect(res.leads[0].inquiry_id).toContain('TI-HIST-5')
      expect(res.startStr).toBeDefined()
      expect(res.endStr).toBeDefined()
    })
  })

  describe('ExportersIndiaService', () => {
    it('fetches historical batch for page 2 in mock mode', async () => {
      const config = { ...mockConfig, platform: 'EXPORTERSINDIA' as const }
      const res = await ExportersIndiaService.fetchHistoricalBatch(config, 2)
      expect(res.leads).toHaveLength(1)
      expect(res.leads[0].enquiry_id).toContain('EI-HIST-2')
      expect(res.startStr).toBeDefined()
      expect(res.endStr).toBeDefined()
    })
  })

  describe('cleanAndParseDate', () => {
    it('parses valid ISO string successfully', () => {
      const parsed = cleanAndParseDate('2026-06-16T12:00:00.000Z')
      expect(parsed).toBeInstanceOf(Date)
      expect(parsed?.toISOString()).toBe('2026-06-16T12:00:00.000Z')
    })

    it('parses custom IndiaMART date format successfully', () => {
      const parsed = cleanAndParseDate('23-JUN-2025 11:01:58')
      expect(parsed).toBeInstanceOf(Date)
      expect(parsed?.getFullYear()).toBe(2025)
      expect(parsed?.getMonth()).toBe(5) // June is 5
      expect(parsed?.getDate()).toBe(23)
    })

    it('discards Unix epoch start or 1970 date', () => {
      const parsed = cleanAndParseDate('1970-01-01T00:00:00.000Z')
      expect(parsed).toBeNull()
    })

    it('discards invalid format strings', () => {
      const parsed = cleanAndParseDate('not-a-date')
      expect(parsed).toBeNull()
    })

    it('discards future dates', () => {
      const parsed = cleanAndParseDate('2099-01-01T00:00:00.000Z')
      expect(parsed).toBeNull()
    })

    it('returns null on null or empty input', () => {
      expect(cleanAndParseDate(null)).toBeNull()
      expect(cleanAndParseDate(undefined)).toBeNull()
      expect(cleanAndParseDate('')).toBeNull()
    })
  })

  describe('saveLead Unique Constraint Target', () => {
    it('uses (platform, external_lead_id) as the conflict target on upsert', async () => {
      const mockLead = {
        account_id: 'test-account-id',
        platform: 'INDIAMART' as const,
        external_lead_id: 'IM-TEST-UNIQUE-TARGET',
        buyer_name: 'Test Buyer',
        mobile: '+919999999999',
        product_name: 'Test Product',
        status: 'pending' as const,
        lead_source: 'B2B_MARKETPLACE',
        received_at: new Date().toISOString()
      }

      let upsertTargetOption = ''
      const mockSupabase = {
        from: (_table: string) => {
          return {
            select: () => {
              return {
                eq: () => {
                  return {
                    eq: () => {
                      return {
                        eq: () => {
                          return {
                            maybeSingle: async () => ({ data: null, error: null })
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            upsert: (_data: unknown, options?: { onConflict?: string }) => {
              upsertTargetOption = options?.onConflict || ''
              return {
                select: () => {
                  return {
                    single: async () => ({ data: { id: 'new-lead-uuid' }, error: null })
                  }
                }
              }
            }
          }
        }
      } as unknown as SupabaseClient

      const res = await IndiaMartService.saveLead(mockLead, mockSupabase)
      expect(res.leadId).toBe('new-lead-uuid')
      expect(res.isNew).toBe(true)
      expect(upsertTargetOption).toBe('platform,external_lead_id')
    })
  })
})
