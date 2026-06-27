// Force Next.js route compilation
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { IndiaMartService } from '@/integrations/indiamart/services/indiamart'
import { TradeIndiaService } from '@/integrations/tradeindia/services/tradeindia'
import { ExportersIndiaService } from '@/integrations/exportersindia/services/exportersindia'
import { encryptSecret } from '@/integrations/shared/crypto'
import type { B2BIntegration, B2BPlatform } from '@/types'

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

    // Load existing integration if we need to resolve placeholders
    const adminSupabase = getAdminClient()
    const { data: existingIntegration } = await adminSupabase
      .from('b2b_integrations')
      .select('*')
      .eq('account_id', accountId)
      .eq('platform', platformUpper)
      .maybeSingle()

    // Build configuration to test.
    // If a secret is omitted or is a placeholder like '••••••••', use the stored one.
    const resolveSecret = (incoming: string | undefined, stored: string | null | undefined) => {
      if (!incoming || incoming === '••••••••') {
        return stored || null
      }
      return encryptSecret(incoming) // encrypt new secret
    }

    const configToTest: B2BIntegration = {
      id: existingIntegration?.id || '',
      account_id: accountId,
      platform: platformUpper as B2BPlatform,
      enabled: body.enabled ?? false,
      api_url: body.api_url || null,
      api_key: resolveSecret(body.api_key, existingIntegration?.api_key),
      client_id: body.client_id || null,
      client_secret: resolveSecret(body.client_secret, existingIntegration?.client_secret),
      username: body.username || null,
      password: resolveSecret(body.password, existingIntegration?.password),
      sync_interval: body.sync_interval || '15m',
      created_at: '',
      updated_at: ''
    }

    let result: { success: boolean; message?: string } = { success: false, message: 'Not executed' }
    if (platformUpper === 'INDIAMART') {
      result = await IndiaMartService.testConnection(configToTest)
    } else if (platformUpper === 'TRADEINDIA') {
      result = await TradeIndiaService.testConnection(configToTest)
    } else if (platformUpper === 'EXPORTERSINDIA') {
      result = await ExportersIndiaService.testConnection(configToTest)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[test-route] Unexpected error testing connection:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, message: errorMsg || 'Unexpected server error' },
      { status: 500 }
    )
  }
}
