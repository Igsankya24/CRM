import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const accountId = profile.account_id

    const url = new URL(request.url)
    const platform = url.searchParams.get('platform')
    const limitStr = url.searchParams.get('limit') || '10'
    const offsetStr = url.searchParams.get('offset') || '0'

    const limit = parseInt(limitStr, 10)
    const offset = parseInt(offsetStr, 10)

    let query = supabase
      .from('sync_logs')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (platform) {
      query = query.eq('platform', platform.toUpperCase())
    }

    const { data: logs, count, error: logsError } = await query

    if (logsError) {
      return NextResponse.json({ error: logsError.message }, { status: 500 })
    }

    return NextResponse.json({
      logs: logs || [],
      count: count || 0
    })
  } catch (error) {
    console.error('[sync-logs GET] Fatal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
