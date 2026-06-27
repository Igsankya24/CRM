import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getStableExternalLeadId } from '@/integrations/shared/crypto'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const secret = url.searchParams.get('secret')
  const expectedSecret = process.env.AUTOMATION_CRON_SECRET

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()

  try {
    // 1. Fetch all active B2B leads
    const { data: leads, error: fetchError } = await admin
      .from('b2b_leads')
      .select('*')
      .is('deleted_at', null)

    if (fetchError) {
      throw fetchError
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ success: true, message: 'No leads found to clean up.' })
    }

    // 2. Group leads by account_id, platform, and stable external_lead_id
    const groups: Record<string, typeof leads> = {}

    for (const lead of leads) {
      const stableId = getStableExternalLeadId(
        lead.platform,
        lead.external_lead_id,
        lead.mobile,
        lead.product_name,
        lead.inquiry_at || lead.received_at
      )
      const groupKey = `${lead.account_id}:${lead.platform}:${stableId}`
      
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(lead)
    }

    const duplicateGroups = Object.entries(groups).filter(([_, list]) => list.length > 1)

    console.log(`[cleanup] Found ${duplicateGroups.length} groups of duplicate leads.`)

    let mergedCount = 0
    let deletedCount = 0

    const statusPriority: Record<string, number> = {
      converted: 5,
      rejected: 4,
      contacted: 3,
      assigned: 2,
      pending: 1
    }

    for (const [groupKey, list] of duplicateGroups) {
      const parts = groupKey.split(':')
      const stableId = parts[2]

      // Sort by created_at ascending (oldest first)
      const sorted = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const survivor = sorted[0]
      const duplicates = sorted.slice(1)

      // Merge Status
      let bestStatus = survivor.status
      for (const item of list) {
        const p1 = statusPriority[bestStatus] || 0
        const p2 = statusPriority[item.status] || 0
        if (p2 > p1) {
          bestStatus = item.status
        }
      }

      // Merge Assigned To (oldest non-null)
      const bestAssignedTo = list.map(item => item.assigned_to).find(Boolean) || null

      // Merge Notes
      const notesList = list
        .map(item => (item.notes || '').trim())
        .filter(Boolean)
      const mergedNotes = Array.from(new Set(notesList)).join('\n---\n') || null

      // Merge Message
      const messageList = list
        .map(item => (item.message || '').trim())
        .filter(Boolean)
      const mergedMessage = messageList.sort((a, b) => b.length - a.length)[0] || null

      // Update survivor
      const { error: updateError } = await admin
        .from('b2b_leads')
        .update({
          status: bestStatus,
          assigned_to: bestAssignedTo,
          notes: mergedNotes,
          message: mergedMessage,
          external_lead_id: stableId,
          updated_at: new Date().toISOString()
        })
        .eq('id', survivor.id)

      if (updateError) {
        console.error(`[cleanup] Failed to update survivor lead ${survivor.id}:`, updateError)
        continue
      }

      // For each duplicate lead, repair references
      for (const dup of duplicates) {
        // lead_assignments: Update lead_id
        await admin
          .from('lead_assignments')
          .update({ lead_id: survivor.id })
          .eq('lead_id', dup.id)

        // followup_tasks: Update lead_id
        await admin
          .from('followup_tasks')
          .update({ lead_id: survivor.id })
          .eq('lead_id', dup.id)

        // lead_conversations: Update or delete
        const { data: dupConvs } = await admin
          .from('lead_conversations')
          .select('*')
          .eq('lead_id', dup.id)

        if (dupConvs && dupConvs.length > 0) {
          for (const dupConv of dupConvs) {
            // Check if survivor already has a mapping for this conversation
            const { data: survConv } = await admin
              .from('lead_conversations')
              .select('id')
              .eq('lead_id', survivor.id)
              .eq('conversation_id', dupConv.conversation_id)
              .maybeSingle()

            if (survConv) {
              // Duplicate mapping -> delete it
              await admin
                .from('lead_conversations')
                .delete()
                .eq('id', dupConv.id)
            } else {
              // Update to survivor
              await admin
                .from('lead_conversations')
                .update({ lead_id: survivor.id })
                .eq('id', dupConv.id)
            }
          }
        }

        // Delete duplicate lead
        const { error: deleteError } = await admin
          .from('b2b_leads')
          .delete()
          .eq('id', dup.id)

        if (deleteError) {
          console.error(`[cleanup] Failed to delete duplicate lead ${dup.id}:`, deleteError)
        } else {
          deletedCount++
        }
      }

      mergedCount++
    }

    return NextResponse.json({
      success: true,
      processedGroups: duplicateGroups.length,
      mergedSurvivorCount: mergedCount,
      deletedDuplicateCount: deletedCount
    })
  } catch (err) {
    console.error('[cleanup] Fatal error cleaning up duplicates:', err)
    const errorMsg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errorMsg || 'Fatal error' }, { status: 500 })
  }
}
