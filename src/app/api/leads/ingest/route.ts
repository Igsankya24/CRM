/**
 * POST /api/leads/ingest — Lead-to-Inbox Pipeline endpoint.
 *
 * Called by:
 *   - B2B integration sync (after saving a lead to b2b_leads)
 *   - Website lead forms
 *   - Manual lead creation
 *
 * Triggers the full pipeline: contact → conversation → crm_lead → AI takeover.
 */

import { NextResponse } from 'next/server'
import { ingestLeadToInbox, type LeadIngestInput } from '@/lib/ai/lead-inbox-pipeline'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }
    if (!body.phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 })
    }
    if (!body.source) {
      return NextResponse.json({ error: 'source is required' }, { status: 400 })
    }

    const validSources = ['INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA', 'WEBSITE', 'WHATSAPP', 'MANUAL', 'REFERRAL']
    if (!validSources.includes(body.source)) {
      return NextResponse.json({ error: `source must be one of: ${validSources.join(', ')}` }, { status: 400 })
    }

    // Verify account exists
    const supabase = getAdminClient()
    const { data: account, error: accountErr } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', body.accountId)
      .maybeSingle()

    if (accountErr || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const input: LeadIngestInput = {
      accountId: body.accountId,
      source: body.source,
      buyerName: body.buyerName ?? body.buyer_name ?? null,
      companyName: body.companyName ?? body.company_name ?? null,
      phone: body.phone,
      email: body.email ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      country: body.country ?? null,
      productName: body.productName ?? body.product_name ?? null,
      quantity: body.quantity ?? null,
      message: body.message ?? null,
      b2bLeadId: body.b2bLeadId ?? body.b2b_lead_id ?? undefined,
      sendGreeting: body.sendGreeting ?? body.send_greeting ?? true,
    }

    const result = await ingestLeadToInbox(input)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Pipeline failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      contactId: result.contactId,
      conversationId: result.conversationId,
      crmLeadId: result.crmLeadId,
    })
  } catch (error) {
    console.error('[api/leads/ingest] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
