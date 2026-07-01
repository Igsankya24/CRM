import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import OpenAI from 'openai'

async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.account_id) return null
  return data.account_id as string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { key } = await request.json()
    let apiKey = key

    if (apiKey === '••••••••••••••••') {
      const accountId = await resolveAccountId(supabase, user.id)
      if (accountId) {
        const { data: config } = await supabase
          .from('whatsapp_config')
          .select('gemini_api_key')
          .eq('account_id', accountId)
          .maybeSingle()
        if (config?.gemini_api_key) {
          try {
            apiKey = decrypt(config.gemini_api_key)
          } catch (err) {
            console.error('[api/settings/credentials/test] Failed to decrypt Gemini API key:', err)
          }
        }
      }
    }

    if (!apiKey) {
      return NextResponse.json({
        connected: false,
        errorType: 'invalid_key',
        errorMessage: 'Gemini API Key is not configured or provided.'
      })
    }

    const client = new OpenAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: apiKey,
    })

    const startTime = Date.now()
    try {
      // Test Gemini API connectivity using a simple completion request
      await client.chat.completions.create({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5,
      })

      const latency = Date.now() - startTime
      return NextResponse.json({
        connected: true,
        latency,
      })
    } catch (err: any) {
      const latency = Date.now() - startTime
      console.error('[api/settings/credentials/test] API failure:', err)
      const status = err.status || err.code
      let errorType = 'api_error'
      let errorMessage = err.message || String(err)

      if (
        status === 401 ||
        status === 403 ||
        errorMessage.includes('API_KEY_INVALID') ||
        errorMessage.includes('invalid key') ||
        errorMessage.includes('key is invalid') ||
        errorMessage.toLowerCase().includes('unauthorized')
      ) {
        errorType = 'invalid_key'
      } else if (
        errorMessage.includes('fetch') ||
        errorMessage.includes('network') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('timeout')
      ) {
        errorType = 'network_error'
      }

      return NextResponse.json({
        connected: false,
        errorType,
        errorMessage,
        latency,
      })
    }
  } catch (error: any) {
    console.error('[api/settings/credentials/test] Route failure:', error)
    return NextResponse.json({
      connected: false,
      errorType: 'api_error',
      errorMessage: error.message || String(error)
    }, { status: 500 })
  }
}
