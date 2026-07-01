/**
 * AI agent core — generates AI responses for WhatsApp conversations.
 *
 * Merged from Whatsapp-Agent-main/src/lib/ai.ts and extended to work
 * with the full wacrm conversation/message schema.
 *
 * Key differences from the original:
 * - Accepts full Message objects (wacrm schema) instead of simple role/content pairs
 * - Supports per-conversation model and system prompt overrides
 * - Respects the conversation's ai_mode flag (checked by the caller)
 * - Provides structured error handling and logging
 * - Implements automatic failover to compatible OpenRouter models
 */

import type { Message } from '@/types'
import { getAIClient, resolveModel } from './client'
import { getSystemPrompt } from './system-prompt'
import { adminDb } from '@/lib/supabase/admin'
import OpenAI from 'openai'
import { decrypt } from '@/lib/whatsapp/encryption'

export interface AIAgentOptions {
  /** Override the model for this specific call */
  model?: string | null
  /** Override the system prompt for this specific call */
  systemPrompt?: string | null
  /** Maximum tokens for the response */
  maxTokens?: number
  /** Restrict to OpenRouter free models only */
  onlyFree?: boolean
  /** Securely passed OpenRouter API key from the database configuration */
  openrouterApiKey?: string
  /** Securely passed Gemini API key from the database configuration */
  geminiApiKey?: string
  /** The tenant account ID */
  accountId?: string
  /** The conversation ID for context continuity and logging */
  conversationId?: string
}

export interface AIAgentResult {
  content: string
  model: string
  provider: string
}

export interface OpenRouterModelDetail {
  id: string
  name: string
  provider: string
  context_length: number
  pricing: {
    prompt: number
    completion: number
  }
  status: 'healthy' | 'unavailable'
  usable: boolean
  last_error?: string | null
  last_error_at?: string | null
}

interface KeyInfo {
  isFreeTier: boolean
  limitRemaining: number | null
  isValid: boolean
}

/**
 * Fetches API key usage and status metadata from OpenRouter.
 */
async function fetchKeyInfo(apiKey: string): Promise<KeyInfo> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    if (!res.ok) {
      if (res.status === 401) {
        return { isFreeTier: true, limitRemaining: 0, isValid: false }
      }
      return { isFreeTier: true, limitRemaining: 0, isValid: true }
    }
    const json = await res.json()
    if (json && json.data) {
      return {
        isFreeTier: json.data.is_free_tier === true,
        limitRemaining: json.data.limit_remaining !== undefined ? json.data.limit_remaining : null,
        isValid: true,
      }
    }
  } catch (err) {
    console.error('[agent] Error fetching OpenRouter key info:', err)
  }
  return { isFreeTier: true, limitRemaining: null, isValid: true }
}

/**
 * Fetches all available models from OpenRouter dynamically, parses their provider, pricing, and checks usability.
 */
export async function fetchAllModelsFromOpenRouter(apiKey?: string): Promise<OpenRouterModelDetail[]> {
  try {
    const resolvedApiKey = apiKey ?? process.env.OPENROUTER_API_KEY
    const keyInfo = resolvedApiKey ? await fetchKeyInfo(resolvedApiKey) : { isFreeTier: true, limitRemaining: 0, isValid: false }

    const headers: Record<string, string> = {}
    if (resolvedApiKey) {
      headers['Authorization'] = `Bearer ${resolvedApiKey}`
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API models endpoint returned status ${response.status}`)
    }

    const json = await response.json()
    if (!json || !Array.isArray(json.data)) {
      throw new Error('Invalid response structure from OpenRouter')
    }

    const models = json.data as any[]
    return models
      .filter(model => {
        if (!model.id) return false
        const id = model.id.toLowerCase()
        const isMediaModel = id.includes('lyria') || id.includes('audio') || id.includes('image')
        return !isMediaModel
      })
      .map((model) => {
        const id = model.id || ''
        const provider = id.split('/')[0] || 'unknown'
        const context_length = model.context_length || 0
        const promptPrice = Number(model.pricing?.prompt || 0)
        const completionPrice = Number(model.pricing?.completion || 0)
        const isFree = promptPrice === 0 && completionPrice === 0 || id.endsWith(':free')

        let usable = false
        if (keyInfo.isValid) {
          if (isFree) {
            usable = true
          } else {
            if (!keyInfo.isFreeTier && (keyInfo.limitRemaining === null || keyInfo.limitRemaining > 0)) {
              usable = true
            }
          }
        }

        return {
          id,
          name: model.name || id,
          provider,
          context_length,
          pricing: {
            prompt: promptPrice,
            completion: completionPrice,
          },
          status: 'healthy' as const,
          usable,
        }
      })
  } catch (err) {
    console.error('[agent] Failed to fetch models dynamically from OpenRouter:', err)
    return []
  }
}

/**
 * Gets cached models from the DB or fetches fresh ones if older than 1 hour or empty.
 */
export async function getOrFetchModels(accountId: string, apiKey?: string, forceRefresh = false): Promise<OpenRouterModelDetail[]> {
  try {
    if (!forceRefresh) {
      const { data: config } = await adminDb
        .from('whatsapp_config')
        .select('ai_available_models')
        .eq('account_id', accountId)
        .maybeSingle()

      if (config?.ai_available_models && typeof config.ai_available_models === 'object') {
        const cache = config.ai_available_models as any
        if (cache.fetched_at && cache.provider === 'openrouter' && Array.isArray(cache.models)) {
          const fetchedAt = new Date(cache.fetched_at).getTime()
          const oneHourAgo = Date.now() - 3600000
          if (fetchedAt > oneHourAgo) {
            return cache.models
          }
        }
      }
    }

    const models = await fetchAllModelsFromOpenRouter(apiKey)
    if (models.length > 0) {
      await adminDb
        .from('whatsapp_config')
        .update({
          ai_available_models: {
            fetched_at: new Date().toISOString(),
            provider: 'openrouter',
            models,
          },
          updated_at: new Date().toISOString()
        })
        .eq('account_id', accountId)
    }
    return models
  } catch (err) {
    console.error('[agent] Error in getOrFetchModels:', err)
    return []
  }
}

/**
 * Fetches all available models from Google Gemini API.
 */
export async function fetchAllModelsFromGemini(apiKey?: string): Promise<OpenRouterModelDetail[]> {
  try {
    const resolvedApiKey = apiKey ?? process.env.GEMINI_API_KEY
    if (!resolvedApiKey) {
      throw new Error('Gemini API Key is not configured')
    }

    const client = new OpenAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: resolvedApiKey,
    })

    const response = await client.models.list()
    const models = response.data || []

    const mapped = models
      .filter(m => m.id && (m.id.includes('gemini') || m.id.includes('learnlm')))
      .map(model => {
        const id = model.id
        const isPro = id.includes('pro')
        const context_length = isPro ? 2097152 : 1048576
        return {
          id,
          name: id.split('/').pop() || id,
          provider: 'google',
          context_length,
          pricing: { prompt: 0, completion: 0 },
          status: 'healthy' as const,
          usable: true,
        }
      })

    if (mapped.length === 0) {
      return [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', context_length: 1048576, pricing: { prompt: 0, completion: 0 }, status: 'healthy', usable: true },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', context_length: 2097152, pricing: { prompt: 0, completion: 0 }, status: 'healthy', usable: true },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', context_length: 1048576, pricing: { prompt: 0, completion: 0 }, status: 'healthy', usable: true }
      ]
    }

    return mapped
  } catch (err) {
    console.error('[agent] Failed to fetch models dynamically from Gemini:', err)
    return [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', context_length: 1048576, pricing: { prompt: 0, completion: 0 }, status: 'healthy', usable: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', context_length: 2097152, pricing: { prompt: 0, completion: 0 }, status: 'healthy', usable: true },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', context_length: 1048576, pricing: { prompt: 0, completion: 0 }, status: 'healthy', usable: true }
    ]
  }
}

/**
 * Gets cached Gemini models from the DB or fetches fresh ones if older than 1 hour or empty.
 */
export async function getOrFetchGeminiModels(accountId: string, apiKey?: string, forceRefresh = false): Promise<OpenRouterModelDetail[]> {
  try {
    if (!forceRefresh) {
      const { data: config } = await adminDb
        .from('whatsapp_config')
        .select('ai_available_models')
        .eq('account_id', accountId)
        .maybeSingle()

      if (config?.ai_available_models && typeof config.ai_available_models === 'object') {
        const cache = config.ai_available_models as any
        if (cache.fetched_at && cache.provider === 'gemini' && Array.isArray(cache.models)) {
          const fetchedAt = new Date(cache.fetched_at).getTime()
          const oneHourAgo = Date.now() - 3600000
          if (fetchedAt > oneHourAgo) {
            return cache.models
          }
        }
      }
    }

    const models = await fetchAllModelsFromGemini(apiKey)
    if (models.length > 0) {
      await adminDb
        .from('whatsapp_config')
        .update({
          ai_available_models: {
            fetched_at: new Date().toISOString(),
            provider: 'gemini',
            models,
          },
          updated_at: new Date().toISOString()
        })
        .eq('account_id', accountId)
    }
    return models
  } catch (err) {
    console.error('[agent] Error in getOrFetchGeminiModels:', err)
    return []
  }
}

/**
 * Backward compatible helper to return list of free models (IDs only).
 */
async function fetchFreeModels(apiKey?: string): Promise<string[]> {
  const models = await fetchAllModelsFromOpenRouter(apiKey)
  return models
    .filter(m => m.usable && (m.id.endsWith(':free') || (m.pricing.prompt === 0 && m.pricing.completion === 0)))
    .map(m => m.id)
}

/**
 * Generates an AI response for a WhatsApp conversation with automatic failover.
 *
 * @param messages - Recent messages from the conversation (wacrm schema)
 * @param options - Optional overrides for model, system prompt, and token limit
 * @returns The AI-generated response text and metadata
 */
export async function getAIResponse(
  messages: Pick<Message, 'sender_type' | 'content_text'>[],
  options: AIAgentOptions = {}
): Promise<AIAgentResult> {
  const startTime = Date.now()
  const initialModel = resolveModel(options.model)
  const systemPrompt = getSystemPrompt(options.systemPrompt)

  interface Candidate {
    id: string
    provider: 'gemini' | 'openrouter'
  }

  let candidates: Candidate[] = []
  let fallbackEnabled = true
  const accountId = options.accountId

  let configuredProvider = 'gemini'
  let geminiApiKeyDecrypted: string | undefined = undefined
  let openrouterApiKeyDecrypted: string | undefined = undefined

  if (accountId) {
    const { data: config } = await adminDb
      .from('whatsapp_config')
      .select('ai_fallback_enabled, ai_model, ai_only_free_models, ai_provider, gemini_api_key, openrouter_api_key')
      .eq('account_id', accountId)
      .maybeSingle()

    if (config) {
      fallbackEnabled = config.ai_fallback_enabled !== false
      configuredProvider = config.ai_provider ?? 'gemini'
      if (config.gemini_api_key) {
        try {
          geminiApiKeyDecrypted = decrypt(config.gemini_api_key)
        } catch (e) {
          console.error('[agent] Error decrypting gemini API key:', e)
        }
      }
      if (config.openrouter_api_key) {
        try {
          openrouterApiKeyDecrypted = decrypt(config.openrouter_api_key)
        } catch (e) {
          console.error('[agent] Error decrypting openrouter API key:', e)
        }
      }
    }
  }

  // Load API keys
  const orApiKey = options.openrouterApiKey ?? openrouterApiKeyDecrypted ?? process.env.OPENROUTER_API_KEY
  const gemApiKey = options.geminiApiKey ?? geminiApiKeyDecrypted ?? process.env.GEMINI_API_KEY

  // Determine current preferred provider based on the configured model format or explicit setting
  const initialModelClean = initialModel.replace(/^google\//, '').replace(/:free$/, '')
  const initialModelIsGemini = initialModelClean.startsWith('gemini-') || initialModelClean.startsWith('learnlm-')
  const activeProvider = initialModelIsGemini && gemApiKey ? 'gemini' : configuredProvider

  // Fetch available models for both providers if keys are present
  let primaryModels: OpenRouterModelDetail[] = []
  let fallbackModels: OpenRouterModelDetail[] = []

  if (activeProvider === 'gemini') {
    if (accountId) {
      primaryModels = await getOrFetchGeminiModels(accountId, gemApiKey)
      if (orApiKey) {
        fallbackModels = await getOrFetchModels(accountId, orApiKey)
      }
    } else {
      primaryModels = await fetchAllModelsFromGemini(gemApiKey)
      if (orApiKey) {
        fallbackModels = await fetchAllModelsFromOpenRouter(orApiKey)
      }
    }
  } else {
    if (accountId) {
      primaryModels = await getOrFetchModels(accountId, orApiKey)
      if (gemApiKey) {
        fallbackModels = await getOrFetchGeminiModels(accountId, gemApiKey)
      }
    } else {
      primaryModels = await fetchAllModelsFromOpenRouter(orApiKey)
      if (gemApiKey) {
        fallbackModels = await fetchAllModelsFromGemini(gemApiKey)
      }
    }
  }

  // Filter usable models for primary provider
  const primaryUsable = primaryModels.filter(m => {
    if (!m.usable) return false
    // For OpenRouter, respect onlyFree option if configured
    if (activeProvider === 'openrouter' && options.onlyFree) {
      const isFree = m.id.endsWith(':free') || (m.pricing.prompt === 0 && m.pricing.completion === 0)
      if (!isFree) return false
    }
    return true
  })

  // Filter usable models for fallback provider
  const fallbackUsable = fallbackModels.filter(m => {
    if (!m.usable) return false
    if (activeProvider === 'gemini' && options.onlyFree) { // OpenRouter is fallback, respect onlyFree
      const isFree = m.id.endsWith(':free') || (m.pricing.prompt === 0 && m.pricing.completion === 0)
      if (!isFree) return false
    }
    return true
  })

  candidates.push({ id: initialModel, provider: activeProvider as any })

  if (fallbackEnabled) {
    const otherPrimary = primaryUsable.filter(m => m.id !== initialModel).map(m => ({ id: m.id, provider: activeProvider as any }))
    const otherFallback = fallbackUsable.map(m => ({ id: m.id, provider: (activeProvider === 'gemini' ? 'openrouter' : 'gemini') as any }))
    candidates.push(...otherPrimary, ...otherFallback)
  }

  // Static robust catch-alls in case dynamic lists fail
  const staticFallbacks = [
    { id: 'gemini-2.5-flash', provider: 'gemini' as const },
    { id: 'google/gemini-2.5-flash:free', provider: 'openrouter' as const },
    { id: 'google/gemini-2.5-flash', provider: 'openrouter' as const },
    { id: 'meta-llama/llama-3.3-70b-instruct', provider: 'openrouter' as const }
  ]
  for (const f of staticFallbacks) {
    if (!candidates.some(c => c.id === f.id && c.provider === f.provider)) {
      candidates.push(f)
    }
  }

  const chatMessages = messages
    .filter((m) => m.content_text)
    .map((m) => ({
      role: m.sender_type === 'customer' ? ('user' as const) : ('assistant' as const),
      content: m.content_text!,
    }))

  let lastError: any = null
  let i = 0
  let failedModel: string | null = null

  // Local helper to resolve correct client for a candidate
  const getClientForModel = (candidate: Candidate) => {
    if (candidate.provider === 'gemini' && gemApiKey) {
      const cleanModel = candidate.id.replace(/^google\//, '').replace(/:free$/, '')
      return {
        client: getAIClient('gemini', gemApiKey),
        normalizedModel: cleanModel,
        actualProvider: 'gemini' as const,
      }
    }

    return {
      client: getAIClient('openrouter', orApiKey),
      normalizedModel: candidate.id,
      actualProvider: 'openrouter' as const,
    }
  }

  while (i < candidates.length) {
    const candidate = candidates[i]
    const attemptStartTime = Date.now()
    const { client, normalizedModel, actualProvider } = getClientForModel(candidate)

    try {
      console.log(`[agent] Attempting AI response with model: ${candidate.id} (normalized: ${normalizedModel}) via ${actualProvider}`)
      const completion = await client.chat.completions.create({
        model: normalizedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatMessages,
        ],
        max_tokens: options.maxTokens ?? 500,
      })

      const content =
        completion.choices[0]?.message?.content ??
        "I'm sorry, I couldn't generate a response at this time."

      const latency = Date.now() - attemptStartTime
      const totalLatency = Date.now() - startTime
      const tokenUsage = completion.usage ? {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens
      } : null

      if (accountId) {
        await adminDb
          .from('whatsapp_config')
          .update({
            ai_model_status: 'healthy',
            ai_last_success_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('account_id', accountId)

        if (candidate.id !== initialModel) {
          await adminDb.from('ai_fallback_logs').insert({
            account_id: accountId,
            conversation_id: options.conversationId || null,
            selected_model: initialModel,
            failed_model: failedModel,
            fallback_model: candidate.id,
            reason_for_fallback: `Primary model failed. Fallback triggered to ${candidate.id} (${actualProvider}). Latency: ${latency}ms`,
            http_status: 200,
            latency_ms: totalLatency,
            token_usage: tokenUsage
          })
        }
      }

      return {
        content,
        model: candidate.id,
        provider: completion.object ?? 'chat.completion',
      }
    } catch (err: any) {
      console.warn(`[agent] Failed to generate response with model ${candidate.id} via ${actualProvider}:`, err)
      lastError = err
      failedModel = candidate.id

      const status = err.status || err.code || (err.message && err.message.includes('429') ? 429 : 500)
      const latency = Date.now() - attemptStartTime

      if (accountId) {
        const markUnavailable = (models: OpenRouterModelDetail[]) => models.map(m => {
          if (m.id === candidate.id) {
            return {
              ...m,
              status: 'unavailable' as const,
              last_error: err.message || String(err),
              last_error_at: new Date().toISOString()
            }
          }
          return m
        })

        const updatedPrimary = markUnavailable(primaryModels)
        const updatedFallback = markUnavailable(fallbackModels)

        const cacheToUpdate = activeProvider === 'gemini' ? updatedPrimary : updatedFallback
        const providerName = activeProvider === 'gemini' ? 'gemini' : 'openrouter'

        if (cacheToUpdate.length > 0) {
          await adminDb
            .from('whatsapp_config')
            .update({
              ai_model_status: 'degraded',
              ai_last_error: `Model ${candidate.id} failed: ${err.message || err}`,
              ai_available_models: {
                fetched_at: new Date().toISOString(),
                provider: providerName,
                models: cacheToUpdate
              },
              updated_at: new Date().toISOString()
            })
            .eq('account_id', accountId)
        }

        await adminDb.from('ai_fallback_logs').insert({
          account_id: accountId,
          conversation_id: options.conversationId || null,
          selected_model: initialModel,
          failed_model: candidate.id,
          fallback_model: i + 1 < candidates.length ? candidates[i + 1].id : null,
          reason_for_fallback: `Model failed with: ${err.message || err}`,
          http_status: typeof status === 'number' ? status : 500,
          latency_ms: latency,
        })
      }

      if (!fallbackEnabled) {
        break
      }

      i++
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  throw lastError || new Error('All candidate models failed to generate a response.')
}

/**
 * Simplified overload that accepts plain role/content pairs.
 * Maintains backward compatibility with the original WhatsApp-Agent-main API.
 */
export async function getAIResponseSimple(
  messages: { role: 'user' | 'assistant'; content: string }[],
  options: AIAgentOptions = {}
): Promise<string> {
  const mappedMessages = messages.map(m => ({
    sender_type: m.role === 'user' ? ('customer' as const) : ('agent' as const),
    content_text: m.content,
  }))
  const result = await getAIResponse(mappedMessages, options)
  return result.content
}
