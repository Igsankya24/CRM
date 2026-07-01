import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { getAIClient } from '@/lib/ai/client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { model } = await request.json()
    if (!model) {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 400 })
    }

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('openrouter_api_key, gemini_api_key, ai_provider')
      .eq('account_id', profile.account_id)
      .maybeSingle()

    const provider = config?.ai_provider ?? 'gemini'
    let apiKey: string | undefined

    if (provider === 'gemini') {
      apiKey = config?.gemini_api_key ? decrypt(config.gemini_api_key) : process.env.GEMINI_API_KEY
      if (!apiKey) {
        return NextResponse.json({ error: 'Google Gemini API Key not configured' }, { status: 400 })
      }
    } else {
      apiKey = config?.openrouter_api_key ? decrypt(config.openrouter_api_key) : process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        return NextResponse.json({ error: 'OpenRouter API Key not configured' }, { status: 400 })
      }
    }

    const client = getAIClient(provider as any, apiKey)
    const startTime = Date.now()

    try {
      await client.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5,
      })

      const latency = Date.now() - startTime
      return NextResponse.json({
        connected: true,
        failed: false,
        latency,
        modelName: model,
        errorMessage: null,
      })
    } catch (err: any) {
      const latency = Date.now() - startTime
      return NextResponse.json({
        connected: false,
        failed: true,
        latency,
        modelName: model,
        errorMessage: err.message || String(err),
      })
    }
  } catch (err: any) {
    console.error('[api/ai/models/test] Error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
