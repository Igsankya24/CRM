import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { getOrFetchModels, getOrFetchGeminiModels } from '@/lib/ai/agent'

async function resolveConfig(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile?.account_id) return null

  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('openrouter_api_key, gemini_api_key, ai_available_models, ai_provider')
    .eq('account_id', profile.account_id)
    .maybeSingle()

  return {
    accountId: profile.account_id,
    openrouterApiKey: config?.openrouter_api_key ? decrypt(config.openrouter_api_key) : undefined,
    geminiApiKey: config?.gemini_api_key ? decrypt(config.gemini_api_key) : undefined,
    availableModels: config?.ai_available_models,
    aiProvider: config?.ai_provider ?? 'gemini',
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const config = await resolveConfig(supabase, user.id)
    if (!config) {
      return NextResponse.json({ models: [] })
    }

    const { searchParams } = new URL(request.url)
    const providerParam = searchParams.get('provider')
    const targetProvider = providerParam || config.aiProvider

    let modelsList = []
    if (config.availableModels && typeof config.availableModels === 'object') {
      const cache = config.availableModels as any
      if (cache.provider === targetProvider && Array.isArray(cache.models)) {
        modelsList = cache.models
      }
    }

    if (modelsList.length === 0) {
      if (targetProvider === 'gemini') {
        modelsList = await getOrFetchGeminiModels(config.accountId, config.geminiApiKey, false)
      } else {
        modelsList = await getOrFetchModels(config.accountId, config.openrouterApiKey, false)
      }
    }

    return NextResponse.json({ models: modelsList })
  } catch (err: any) {
    console.error('[api/ai/models GET] Failed:', err)
    return NextResponse.json({ models: [], error: err.message || String(err) })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const config = await resolveConfig(supabase, user.id)
    if (!config) {
      return NextResponse.json({ error: 'WhatsApp config not found' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const providerParam = searchParams.get('provider')
    const targetProvider = providerParam || config.aiProvider

    let modelsList = []
    if (targetProvider === 'gemini') {
      modelsList = await getOrFetchGeminiModels(config.accountId, config.geminiApiKey, true)
    } else {
      modelsList = await getOrFetchModels(config.accountId, config.openrouterApiKey, true)
    }
    return NextResponse.json({ success: true, models: modelsList })
  } catch (err: any) {
    console.error('[api/ai/models POST] Failed to refresh:', err)
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 })
  }
}
