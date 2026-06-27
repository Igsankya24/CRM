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
 * GET /api/settings/credentials
 *
 * Retrieves the masked credentials: Meta App Secret and OpenRouter API Key.
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

    // Check permissions (Admin/Owner/Super Admin or whatsapp_settings/ai_settings view permission)
    const { data: hasWaPerm } = await supabase.rpc('has_permission', {
      p_module: 'whatsapp_settings',
      p_action: 'view',
    });
    const { data: hasAiPerm } = await supabase.rpc('has_permission', {
      p_module: 'ai_settings',
      p_action: 'view',
    });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, account_role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === 'Super Admin';
    const isAdminOrOwner = profile?.account_role === 'owner' || profile?.account_role === 'admin';

    if (!isSuperAdmin && !isAdminOrOwner && !hasWaPerm && !hasAiPerm) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json({ config: null })
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('id, app_secret, openrouter_api_key')
      .eq('account_id', accountId)
      .maybeSingle()

    if (configError) {
      console.error('[api/settings/credentials GET] Database error:', configError)
      return NextResponse.json({ error: 'Failed to retrieve credentials' }, { status: 500 })
    }

    if (!config) {
      return NextResponse.json({ config: null })
    }

    const hasAppSecret = Boolean(config.app_secret)
    const maskedAppSecret = hasAppSecret ? '••••••••••••••••' : ''

    const hasOpenRouterKey = Boolean(config.openrouter_api_key)
    const maskedOpenRouterKey = hasOpenRouterKey ? '••••••••••••••••' : ''

    return NextResponse.json({
      config: {
        id: config.id,
        app_secret: maskedAppSecret,
        openrouter_api_key: maskedOpenRouterKey,
      },
    })
  } catch (error) {
    console.error('[api/settings/credentials GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/settings/credentials
 *
 * Saves credentials, securely encrypting them.
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

    // Check permissions (Admin/Owner/Super Admin or whatsapp_settings/ai_settings view permission)
    const { data: hasWaPerm } = await supabase.rpc('has_permission', {
      p_module: 'whatsapp_settings',
      p_action: 'view',
    });
    const { data: hasAiPerm } = await supabase.rpc('has_permission', {
      p_module: 'ai_settings',
      p_action: 'view',
    });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, account_role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === 'Super Admin';
    const isAdminOrOwner = profile?.account_role === 'owner' || profile?.account_role === 'admin';

    if (!isSuperAdmin && !isAdminOrOwner && !hasWaPerm && !hasAiPerm) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json({ error: 'Your profile is not linked to an account.' }, { status: 403 })
    }

    const body = await request.json()
    const { app_secret, openrouter_api_key } = body

    const { data: existing, error: fetchError } = await supabase
      .from('whatsapp_config')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle()

    if (fetchError) {
      console.error('[api/settings/credentials POST] Fetch error:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const updateData: Partial<Database["public"]["Tables"]["whatsapp_config"]["Update"]> = {
      updated_at: new Date().toISOString(),
    }

    // Process app_secret
    if (app_secret === '') {
      updateData.app_secret = null
    } else if (app_secret && app_secret !== '••••••••••••••••') {
      try {
        updateData.app_secret = encrypt(app_secret.trim())
      } catch (err) {
        console.error('[api/settings/credentials POST] App Secret encryption error:', err)
        return NextResponse.json({ error: 'Failed to securely encrypt App Secret' }, { status: 500 })
      }
    }

    // Process openrouter_api_key
    if (openrouter_api_key === '') {
      updateData.openrouter_api_key = null
    } else if (openrouter_api_key && openrouter_api_key !== '••••••••••••••••') {
      try {
        updateData.openrouter_api_key = encrypt(openrouter_api_key.trim())
      } catch (err) {
        console.error('[api/settings/credentials POST] OpenRouter API key encryption error:', err)
        return NextResponse.json({ error: 'Failed to securely encrypt OpenRouter API key' }, { status: 500 })
      }
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('whatsapp_config')
        .update(updateData)
        .eq('id', existing.id)

      if (updateError) {
        console.error('[api/settings/credentials POST] Update error:', updateError)
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
      }
    } else {
      const { error: insertError } = await supabase
        .from('whatsapp_config')
        .insert({
          account_id: accountId,
          user_id: user.id,
          ...updateData,
        })

      if (insertError) {
        console.error('[api/settings/credentials POST] Insert error:', insertError)
        return NextResponse.json({ error: 'Failed to create configuration with credentials' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[api/settings/credentials POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
