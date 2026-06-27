/**
 * AI Provider configurations for CRM with AI Integration.
 *
 * Supports: OpenRouter (primary), OpenAI, Gemini, Claude, DeepSeek, Ollama.
 * Configure via environment variables — see .env.example.
 */

export type AIProvider =
  | 'openrouter'
  | 'openai'
  | 'gemini'
  | 'claude'
  | 'deepseek'
  | 'ollama'

export interface ProviderConfig {
  baseURL: string
  apiKey: string | undefined
  defaultModel: string
}

/**
 * Returns the configuration for each AI provider.
 * Called at runtime so env vars are read from the current process.
 */
export function getProviderConfig(provider: AIProvider): ProviderConfig {
  switch (provider) {
    case 'openrouter':
      return {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultModel: 'google/gemini-2.5-flash:free',
      }
    case 'openai':
      return {
        baseURL: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-4o',
      }
    case 'gemini':
      return {
        // Gemini via OpenAI-compatible endpoint
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: process.env.GEMINI_API_KEY,
        defaultModel: 'gemini-2.0-flash',
      }
    case 'claude':
      return {
        baseURL: 'https://api.anthropic.com/v1',
        apiKey: process.env.CLAUDE_API_KEY,
        defaultModel: 'claude-sonnet-4-20250514',
      }
    case 'deepseek':
      return {
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: process.env.DEEPSEEK_API_KEY,
        defaultModel: 'deepseek-chat',
      }
    case 'ollama':
      return {
        baseURL: process.env.OLLAMA_URL ?? 'http://localhost:11434/v1',
        apiKey: 'ollama', // Ollama doesn't need a real key
        defaultModel: 'llama3.2',
      }
    default:
      throw new Error(`[ai/providers] Unknown provider: ${provider}`)
  }
}

/**
 * Detects which provider to use based on available env vars.
 * Priority: OPENROUTER > OPENAI > CLAUDE > GEMINI > DEEPSEEK > OLLAMA
 */
export function detectProvider(): AIProvider {
  if (process.env.OPENROUTER_API_KEY) return 'openrouter'
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.CLAUDE_API_KEY) return 'claude'
  if (process.env.GEMINI_API_KEY) return 'gemini'
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek'
  if (process.env.OLLAMA_URL) return 'ollama'
  // Fallback — will fail at runtime if no key configured
  return 'openrouter'
}
