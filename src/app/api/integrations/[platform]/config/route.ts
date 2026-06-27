import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { encryptSecret } from '@/integrations/shared/crypto'

const MASKED_SECRET = '••••••••'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params
    const platformUpper = platform.toUpperCase()

    if (!['INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA'].includes(platformUpper)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve account_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const accountId = profile.account_id

    const { data: integration, error: dbError } = await supabase
      .from('b2b_integrations')
      .select('*')
      .eq('account_id', accountId)
      .eq('platform', platformUpper)
      .maybeSingle()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    if (!integration) {
      return NextResponse.json({ config: null })
    }

    // Mask secrets
    return NextResponse.json({
      config: {
        ...integration,
        api_key: integration.api_key ? MASKED_SECRET : null,
        client_secret: integration.client_secret ? MASKED_SECRET : null,
        password: integration.password ? MASKED_SECRET : null
      }
    })
  } catch (error) {
    console.error('[config-route GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params
    const platformUpper = platform.toUpperCase()

    if (!['INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA'].includes(platformUpper)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve account_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const accountId = profile.account_id
    const body = await req.json()

    // Fetch existing integration config to preserve secrets if they weren't edited
    const adminSupabase = getAdminClient()
    const { data: existing } = await adminSupabase
      .from('b2b_integrations')
      .select('*')
      .eq('account_id', accountId)
      .eq('platform', platformUpper)
      .maybeSingle()

    // Resolve secrets
    const resolveAndEncrypt = (incoming: string | null | undefined, stored: string | null | undefined) => {
      if (incoming === MASKED_SECRET) {
        return stored || null
      }
      if (!incoming) {
        return null
      }
      return encryptSecret(incoming)
    }

    const apiKey = resolveAndEncrypt(body.api_key, existing?.api_key)
    const clientSecret = resolveAndEncrypt(body.client_secret, existing?.client_secret)
    const password = resolveAndEncrypt(body.password, existing?.password)

    const payload = {
      account_id: accountId,
      platform: platformUpper,
      enabled: body.enabled ?? false,
      api_url: body.api_url || null,
      api_key: apiKey,
      client_id: body.client_id || null,
      client_secret: clientSecret,
      username: body.username || null,
      password: password,
      sync_interval: body.sync_interval || '15m',
      updated_at: new Date().toISOString()
    }

    let upsertResult
    if (existing) {
      upsertResult = await adminSupabase
        .from('b2b_integrations')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single()
    } else {
      upsertResult = await adminSupabase
        .from('b2b_integrations')
        .insert({
          ...payload,
          created_at: new Date().toISOString()
        })
        .select('*')
        .single()
    }

    if (upsertResult.error) {
      console.error('[config-route POST] Save failed:', upsertResult.error)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${platformUpper} settings saved successfully.`,
      config: {
        ...upsertResult.data,
        api_key: upsertResult.data.api_key ? MASKED_SECRET : null,
        client_secret: upsertResult.data.client_secret ? MASKED_SECRET : null,
        password: upsertResult.data.password ? MASKED_SECRET : null
      }
    })
  } catch (error) {
    console.error('[config-route POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
