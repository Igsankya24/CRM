import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
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
    const { leadId, staffId } = await req.json()

    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 })
    }

    // Verify staffId belongs to this account
    if (staffId) {
      const { data: targetProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', staffId)
        .eq('account_id', accountId)
        .maybeSingle()

      if (profileError || !targetProfile) {
        return NextResponse.json({ error: 'Target staff member does not exist in your account.' }, { status: 400 })
      }
    }

    // Update lead assignment using the user's client to enforce RLS
    const { error: updateError } = await supabase
      .from('b2b_leads')
      .update({
        assigned_to: staffId || null,
        status: staffId ? 'assigned' : 'pending'
      })
      .eq('id', leadId)
      .eq('account_id', accountId)

    if (updateError) {
      console.error('[assign-route] Error updating lead:', updateError)
      return NextResponse.json({ error: 'Failed to update lead assignment. Ensure you have agent permissions.' }, { status: 403 })
    }

    // Log the assignment history if assigned
    if (staffId) {
      const { error: historyError } = await supabase
        .from('lead_assignments')
        .insert({
          account_id: accountId,
          lead_id: leadId,
          staff_id: staffId,
          assigned_at: new Date().toISOString()
        })

      if (historyError) {
        console.error('[assign-route] Warning: Failed to insert assignment log:', historyError)
      }
    }

    return NextResponse.json({
      success: true,
      message: staffId ? 'Lead successfully assigned.' : 'Lead unassigned.'
    })
  } catch (error) {
    console.error('[assign-route] Unexpected assignment error:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMsg || 'Server error assigning lead' },
      { status: 500 }
    )
  }
}
