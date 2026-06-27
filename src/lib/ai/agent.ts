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
 */

import type { Message } from '@/types'
import { getAIClient, resolveModel } from './client'
import { getSystemPrompt } from './system-prompt'

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
}

export interface AIAgentResult {
  content: string
  model: string
  provider: string
}

/**
 * Fetches the list of all available free models dynamically.
 * Falls back to static list if OpenRouter query fails.
 */
async function fetchFreeModels(apiKey?: string): Promise<string[]> {
  try {
    const headers: Record<string, string> = {}
    const resolvedApiKey = apiKey ?? process.env.OPENROUTER_API_KEY
    if (resolvedApiKey) {
      headers['Authorization'] = `Bearer ${resolvedApiKey}`
    }
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers,
    })
    if (response.ok) {
      interface OpenRouterModel {
        id: string
        pricing?: {
          prompt: string | number
          completion: string | number
        }
      }
      const json = await response.json()
      if (json && Array.isArray(json.data)) {
        const models = json.data as OpenRouterModel[]
        return models
          .filter((model) => {
            if (!model.id) return false;
            const id = model.id.toLowerCase();
            
            const isFreeSuffix = id.endsWith(':free');
            const isFreePrice = model.pricing && 
                                Number(model.pricing.prompt) === 0 && 
                                Number(model.pricing.completion) === 0;
                                
            const isMediaModel = id.includes('lyria') || id.includes('audio') || id.includes('image') || id.includes('/free');
            
            return (isFreeSuffix || isFreePrice) && !isMediaModel;
          })
          .map((model) => model.id)
      }
    }
  } catch (err) {
    console.error('[agent] Failed to fetch free models list dynamically:', err)
  }
  // Fallback to static free models if API fetch fails
  return [
    'meta-llama/llama-3.3-70b-instruct:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'nousresearch/hermes-3-llama-3.1-405b:free',
    'qwen/qwen3-coder:free',
    'openai/gpt-oss-120b:free',
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
  ]
}

/**
 * Generates an AI response for a WhatsApp conversation.
 *
 * @param messages - Recent messages from the conversation (wacrm schema)
 * @param options - Optional overrides for model, system prompt, and token limit
 * @returns The AI-generated response text and metadata
 */
export async function getAIResponse(
  messages: Pick<Message, 'sender_type' | 'content_text'>[],
  options: AIAgentOptions = {}
): Promise<AIAgentResult> {
  const client = getAIClient(undefined, options.openrouterApiKey)
  const initialModel = resolveModel(options.model)
  const systemPrompt = getSystemPrompt(options.systemPrompt)

  let currentModel = initialModel
  let freeModelsList: string[] = []

  if (options.onlyFree && !currentModel.endsWith(':free')) {
    freeModelsList = await fetchFreeModels(options.openrouterApiKey)
    currentModel = freeModelsList[0] || 'google/gemini-2.5-flash:free'
  }

  // Map wacrm message schema to OpenAI chat format
  const chatMessages = messages
    .filter((m) => m.content_text) // skip media-only messages
    .map((m) => ({
      role:
        m.sender_type === 'customer'
          ? ('user' as const)
          : ('assistant' as const),
      content: m.content_text!,
    }))

  let candidates = [currentModel]
  if (options.onlyFree) {
    if (freeModelsList.length === 0) {
      freeModelsList = await fetchFreeModels(options.openrouterApiKey)
    }
    candidates = [
      currentModel,
      ...freeModelsList.filter((m) => m !== currentModel)
    ]
  } else {
    freeModelsList = await fetchFreeModels(options.openrouterApiKey)
    candidates = [
      currentModel,
      ...freeModelsList.filter((m) => m !== currentModel)
    ]
  }

  let lastError: unknown = null
  // Try up to 4 models to bypass rate limits or API outages of individual free models
  for (const candidate of candidates.slice(0, 4)) {
    try {
      console.log(`[agent] Attempting AI response with model: ${candidate}`)
      const completion = await client.chat.completions.create({
        model: candidate,
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatMessages,
        ],
        max_tokens: options.maxTokens ?? 500,
      })

      const content =
        completion.choices[0]?.message?.content ??
        "I'm sorry, I couldn't generate a response at this time."

      return {
        content,
        model: candidate,
        provider: completion.object ?? 'chat.completion',
      }
    } catch (err) {
      console.warn(`[agent] Failed to generate response with model ${candidate}:`, err)
      lastError = err
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
  const client = getAIClient(undefined, options.openrouterApiKey)
  const initialModel = resolveModel(options.model)
  const systemPrompt = getSystemPrompt(options.systemPrompt)

  let currentModel = initialModel
  let freeModelsList: string[] = []

  if (options.onlyFree && !currentModel.endsWith(':free')) {
    freeModelsList = await fetchFreeModels(options.openrouterApiKey)
    currentModel = freeModelsList[0] || 'google/gemini-2.5-flash:free'
  }

  let candidates = [currentModel]
  if (options.onlyFree) {
    if (freeModelsList.length === 0) {
      freeModelsList = await fetchFreeModels(options.openrouterApiKey)
    }
    candidates = [
      currentModel,
      ...freeModelsList.filter((m) => m !== currentModel)
    ]
  } else {
    freeModelsList = await fetchFreeModels(options.openrouterApiKey)
    candidates = [
      currentModel,
      ...freeModelsList.filter((m) => m !== currentModel)
    ]
  }

  let lastError: unknown = null
  // Try up to 4 models to bypass rate limits or API outages of individual free models
  for (const candidate of candidates.slice(0, 4)) {
    try {
      console.log(`[agent] Attempting simple AI response with model: ${candidate}`)
      const completion = await client.chat.completions.create({
        model: candidate,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: options.maxTokens ?? 500,
      })

      return (
        completion.choices[0]?.message?.content ??
        "I'm sorry, I couldn't generate a response at this time."
      )
    } catch (err) {
      console.warn(`[agent] Failed to generate simple response with model ${candidate}:`, err)
      lastError = err
    }
  }

  throw lastError || new Error('All candidate models failed to generate a response.')
}
