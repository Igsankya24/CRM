import { describe, test, expect, vi, beforeEach } from 'vitest'
import { getAIResponse } from './agent'
// @ts-ignore
import { mockCreate } from './client'

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
          ai_model: 'meta-llama/llama-3.3-70b-instruct:free',
          ai_only_free_models: true,
          ai_provider: 'openrouter',
          ai_available_models: {
            fetched_at: new Date().toISOString(),
            provider: 'openrouter',
            models: [
              { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', provider: 'meta-llama', usable: true, pricing: { prompt: 0, completion: 0 } },
              { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (Free)', provider: 'meta-llama', usable: true, pricing: { prompt: 0, completion: 0 } },
              { id: 'google/gemini-2.5-flash:free', name: 'Gemini 2.5 Flash (Free)', provider: 'google', usable: true, pricing: { prompt: 0, completion: 0 } },
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

// Mock client factory
vi.mock('./client', () => {
  const mockCreate = vi.fn()
  const mockClient = {
    chat: {
      completions: {
        create: mockCreate,
      }
    }
  }
  return {
    getAIClient: vi.fn().mockReturnValue(mockClient),
    resolveModel: vi.fn().mockImplementation((m) => m || 'meta-llama/llama-3.3-70b-instruct:free'),
    mockCreate,
  }
})

describe('Automatic OpenRouter Failover Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockReset()
    mockCreate.mockImplementation((opt: any) => {
      console.log('[test-mock] completions.create default implementation called for model:', opt?.model)
      return { choices: [{ message: { content: 'Default mock response' } }] }
    })
  })

  test('Preferred model works on first attempt', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Hello customer!' } }],
      object: 'chat.completion',
    })

    const result = await getAIResponse(
      [{ sender_type: 'customer', content_text: 'Hi' }],
      {
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        accountId: 'test-account-id',
        conversationId: 'test-conv-id',
      }
    )

    expect(result.content).toBe('Hello customer!')
    expect(result.model).toBe('meta-llama/llama-3.3-70b-instruct:free')
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  test('Failover triggers if preferred model returns 429 rate limit or 404', async () => {
    // 1st attempt fails with 429
    const err429: any = new Error('Rate Limit')
    err429.status = 429
    mockCreate.mockRejectedValueOnce(err429)

    // 2nd attempt fails with 404
    const err404: any = new Error('Model unavailable')
    err404.status = 404
    mockCreate.mockRejectedValueOnce(err404)

    // 3rd attempt succeeds
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Success after failover!' } }],
      object: 'chat.completion',
    })

    const result = await getAIResponse(
      [{ sender_type: 'customer', content_text: 'Hi' }],
      {
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        accountId: 'test-account-id',
        conversationId: 'test-conv-id',
      }
    )

    expect(result.content).toBe('Success after failover!')
    expect(result.model).toBe('google/gemini-2.5-flash:free')
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  test('Throws exception if all candidates fail', async () => {
    const err = new Error('Temporary outage')
    mockCreate.mockRejectedValue(err) // always fail

    await expect(
      getAIResponse(
        [{ sender_type: 'customer', content_text: 'Hi' }],
        {
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          accountId: 'test-account-id',
          conversationId: 'test-conv-id',
        }
      )
    ).rejects.toThrow('Temporary outage')
  })
})
