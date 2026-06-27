import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'

interface OpenRouterModel {
  id: string
  name: string
  pricing?: {
    prompt: string
    completion: string
  }
}

export async function GET(request: NextRequest) {
  // Require authentication
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let apiKey = process.env.OPENROUTER_API_KEY
    if (profile?.account_id) {
      const { data: config } = await supabase
        .from('whatsapp_config')
        .select('openrouter_api_key')
        .eq('account_id', profile.account_id)
        .maybeSingle()

      if (config?.openrouter_api_key) {
        try {
          apiKey = decrypt(config.openrouter_api_key)
        } catch (err) {
          console.error('[api/ai/models] Failed to decrypt OpenRouter API key:', err)
        }
      }
    }

    const headers: Record<string, string> = {}
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers,
      next: { revalidate: 3600 }, // Cache models list for 1 hour
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API returned status ${response.status}`)
    }

    const json = await response.json()
    if (!json || !Array.isArray(json.data)) {
      throw new Error('Invalid response structure from OpenRouter')
    }

    // Filter models ending with :free or having prompt/completion pricing of 0, excluding media models
    const freeModels = json.data
      .filter((model: OpenRouterModel) => {
        if (!model.id) return false;
        const id = model.id.toLowerCase();
        
        const isFreeSuffix = id.endsWith(':free');
        const isFreePrice = model.pricing && 
                            Number(model.pricing.prompt) === 0 && 
                            Number(model.pricing.completion) === 0;
                            
        const isMediaModel = id.includes('lyria') || id.includes('audio') || id.includes('image') || id.includes('/free');
        
        return (isFreeSuffix || isFreePrice) && !isMediaModel;
      })
      .map((model: OpenRouterModel) => ({
        id: model.id,
        name: model.name,
      }))

    return NextResponse.json({ models: freeModels })
  } catch (err) {
    console.error('[api/ai/models] Failed to fetch OpenRouter models:', err)
    // Return empty list so client can fallback gracefully
    return NextResponse.json({ models: [], error: 'Failed to fetch models dynamically' })
  }
}
