/**
 * POST /api/ai/chat
 *
 * General-purpose AI chat endpoint for the CRM dashboard.
 * Used by the AI agent monitor page and any future AI features.
 *
 * Request body:
 *   { messages: [{ role: "user"|"assistant", content: string }[], model?: string, systemPrompt?: string }
 *
 * Response:
 *   { content: string, model: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAIResponseSimple } from '@/lib/ai/agent'
import { decrypt } from '@/lib/whatsapp/encryption'

export async function POST(request: NextRequest) {
  // Require authentication
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    messages?: { role: 'user' | 'assistant'; content: string }[]
    model?: string
    systemPrompt?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { messages, model, systemPrompt } = body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: 'messages array is required and must not be empty' },
      { status: 400 }
    )
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let openrouterApiKey: string | undefined
    let onlyFree = false
    if (profile?.account_id) {
      const { data: config } = await supabase
        .from('whatsapp_config')
        .select('openrouter_api_key, ai_only_free_models')
        .eq('account_id', profile.account_id)
        .maybeSingle()

      if (config) {
        onlyFree = config.ai_only_free_models === true
        if (config.openrouter_api_key) {
          try {
            openrouterApiKey = decrypt(config.openrouter_api_key)
          } catch (err) {
            console.error('[api/ai/chat] Failed to decrypt OpenRouter API key:', err)
          }
        }
      }
    }

    const content = await getAIResponseSimple(messages, {
      model,
      systemPrompt,
      onlyFree,
      openrouterApiKey,
    })
    return NextResponse.json({ content, model: model ?? process.env.AI_MODEL ?? 'auto' })
  } catch (err) {
    console.error('[api/ai/chat] Error:', err)
    return NextResponse.json(
      { error: 'AI provider error. Check server logs.' },
      { status: 500 }
    )
  }
}
