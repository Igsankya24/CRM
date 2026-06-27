/**
 * AI client factory for CRM with AI Integration.
 *
 * Returns an OpenAI-compatible client (the `openai` SDK) pointed at
 * the configured provider's base URL. OpenRouter is the default and
 * provides access to all supported models via a single API key.
 */

import OpenAI from 'openai'
import { detectProvider, getProviderConfig, type AIProvider } from './providers'

let _client: OpenAI | null = null
let _clientProvider: AIProvider | null = null
let _clientApiKey: string | null = null

/**
 * Returns a singleton AI client for the auto-detected provider.
 * Re-creates the client if the provider changes (e.g. in tests) or if a different API key is used.
 */
export function getAIClient(provider?: AIProvider, apiKey?: string): OpenAI {
  const resolvedProvider = provider ?? detectProvider()
  const config = getProviderConfig(resolvedProvider)
  const resolvedApiKey = apiKey ?? config.apiKey

  if (_client && _clientProvider === resolvedProvider && _clientApiKey === resolvedApiKey) {
    return _client
  }

  if (!resolvedApiKey) {
    throw new Error(
      `[ai/client] No API key configured for provider "${resolvedProvider}". ` +
        `Set the corresponding environment variable (e.g. OPENROUTER_API_KEY) or configure it in settings.`
    )
  }

  _client = new OpenAI({
    baseURL: config.baseURL,
    apiKey: resolvedApiKey,
    defaultHeaders:
      resolvedProvider === 'openrouter'
        ? {
            // OpenRouter attribution headers (optional but recommended)
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
            'X-Title': 'CRM with AI Integration',
          }
        : undefined,
  })

  _clientProvider = resolvedProvider
  _clientApiKey = resolvedApiKey
  return _client
}

/**
 * Returns the model string to use for completions.
 * Priority: conversation override → env AI_MODEL → provider default.
 */
export function resolveModel(conversationModel?: string | null): string {
  if (conversationModel) return conversationModel
  if (process.env.AI_MODEL) return process.env.AI_MODEL
  const provider = detectProvider()
  return getProviderConfig(provider).defaultModel
}
