import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/whatsapp/encryption'
import type { Database } from '@/types/database.types'

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

/**
 * GET /api/ai/config
 *
 * Retrieves the AI settings and a masked OpenRouter API key if present.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json({ config: null })
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('id, ai_enabled, ai_only_free_models, ai_model, ai_system_prompt, openrouter_api_key')
      .eq('account_id', accountId)
      .maybeSingle()

    if (configError) {
      console.error('[api/ai/config GET] Database error:', configError)
      return NextResponse.json({ error: 'Failed to retrieve configuration' }, { status: 500 })
    }

    if (!config) {
      return NextResponse.json({ config: null })
    }

    const hasKey = Boolean(config.openrouter_api_key)
    const maskedKey = hasKey ? '••••••••••••••••' : ''

    return NextResponse.json({
      config: {
        id: config.id,
        ai_enabled: config.ai_enabled ?? false,
        ai_only_free_models: config.ai_only_free_models ?? true,
        ai_model: config.ai_model ?? 'google/gemini-2.5-flash:free',
        ai_system_prompt: config.ai_system_prompt ?? '',
        openrouter_api_key: maskedKey,
      },
    })
  } catch (error) {
    console.error('[api/ai/config GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/ai/config
 *
 * Saves AI settings and securely encrypts the OpenRouter API Key.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json({ error: 'Your profile is not linked to an account.' }, { status: 403 })
    }

    const body = await request.json()
    const { ai_enabled, ai_only_free_models, ai_model, ai_system_prompt, openrouter_api_key } = body

    const { data: existing, error: fetchError } = await supabase
      .from('whatsapp_config')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle()

    if (fetchError) {
      console.error('[api/ai/config POST] Fetch error:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!existing) {
      return NextResponse.json(
        { error: 'Connect your WhatsApp number in WhatsApp Config tab before updating AI settings.' },
        { status: 400 }
      )
    }

    const updateData: Partial<Database["public"]["Tables"]["whatsapp_config"]["Update"]> = {
      ai_enabled: Boolean(ai_enabled),
      ai_only_free_models: Boolean(ai_only_free_models),
      ai_model: ai_model || 'google/gemini-2.5-flash:free',
      ai_system_prompt: ai_system_prompt?.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (openrouter_api_key === '') {
      updateData.openrouter_api_key = null
    } else if (openrouter_api_key && openrouter_api_key !== '••••••••••••••••') {
      try {
        updateData.openrouter_api_key = encrypt(openrouter_api_key.trim())
      } catch (err) {
        console.error('[api/ai/config POST] Encryption error:', err)
        return NextResponse.json({ error: 'Failed to securely encrypt API key' }, { status: 500 })
      }
    }

    const { error: updateError } = await supabase
      .from('whatsapp_config')
      .update(updateData)
      .eq('id', existing.id)

    if (updateError) {
      console.error('[api/ai/config POST] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[api/ai/config POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
