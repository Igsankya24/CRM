import { describe, test, expect, vi, beforeEach } from 'vitest'
import { getAIResponse } from './agent'

// Mock adminDb
vi.mock('@/lib/supabase/admin', () => {
  const mockEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockInsert = vi.fn().mockResolvedValue({ error: null })
  const mockSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          ai_fallback_enabled: true,
          ai_model: 'gemini-2.5-flash',
          ai_only_free_models: false,
          ai_provider: 'gemini',
          gemini_api_key: 'encrypted-gemini-key',
          openrouter_api_key: 'encrypted-or-key',
          ai_available_models: {
            fetched_at: new Date().toISOString(),
            provider: 'gemini',
            models: [
              { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', usable: true, pricing: { prompt: 0, completion: 0 } },
              { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', usable: true, pricing: { prompt: 0, completion: 0 } },
            ]
          }
        },
        error: null
      })
    })
  })

  return {
    adminDb: {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
        insert: mockInsert,
      })
    }
  }
})

// Mock encryption helpers
vi.mock('@/lib/whatsapp/encryption', () => {
  return {
    decrypt: vi.fn().mockImplementation((val) => 'decrypted-' + val),
    encrypt: vi.fn().mockImplementation((val) => 'encrypted-' + val),
  }
})

// Mock openai
const mockCreate = vi.fn()
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(function (this: any, options: any) {
      this.baseURL = options.baseURL
      this.apiKey = options.apiKey
      this.chat = {
        completions: {
          create: mockCreate
        }
      }
    })
  }
})

describe('Google Gemini API Provider Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockReset()
    mockCreate.mockImplementation((opt: any) => {
      return {
        choices: [{ message: { content: `Mocked response for ${opt.model} from ${opt.baseURL || 'default'}` } }],
        object: 'chat.completion',
      }
    })
  })

  test('Gemini API is used directly when configured', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Gemini success' } }],
      object: 'chat.completion',
    })

    const result = await getAIResponse(
      [{ sender_type: 'customer', content_text: 'Hello Gemini!' }],
      {
        model: 'gemini-2.5-flash',
        accountId: 'test-gemini-acct',
      }
    )

    expect(result.content).toBe('Gemini success')
    expect(result.model).toBe('gemini-2.5-flash')
  })

  test('Google prefix and free suffix are stripped for Gemini direct endpoint', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Normalized success' } }],
      object: 'chat.completion',
    })

    const result = await getAIResponse(
      [{ sender_type: 'customer', content_text: 'Hello' }],
      {
        model: 'google/gemini-2.5-pro:free',
        accountId: 'test-gemini-acct',
      }
    )

    expect(result.content).toBe('Normalized success')
    expect(result.model).toBe('google/gemini-2.5-pro:free')
  })
})
