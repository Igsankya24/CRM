/**
 * Assignment Notification — sends WhatsApp message to assigned staff (Part 5).
 *
 * When a lead is assigned (via handoff or manual), sends a structured
 * notification message to the assigned staff member's WhatsApp number.
 *
 * Message format:
 *   🔔 *New Lead Assigned to You*
 *   👤 Buyer: John Doe
 *   🏢 Company: ABC Corp
 *   📱 Mobile: +919876543210
 *   📦 Product: CNC Machine
 *   📊 Quantity: 50 pcs
 *   🌐 Source: IndiaMART
 *   🎯 Priority: HOT
 *   💬 View Conversation: [link]
 */

import { sendWhatsAppMessage } from '@/lib/whatsapp/send'

export interface AssignmentNotificationInput {
  staffPhone: string | null
  staffName: string
  buyerName: string
  buyerPhone: string
  companyName: string | null
  product: string | null
  quantity: string | null
  source: string
  priority: string
  conversationId: string
  whatsappConfig: {
    phoneNumberId: string
    accessToken: string
  }
}

/**
 * Sends a WhatsApp notification to the assigned staff member.
 */
export async function sendAssignmentNotification(
  input: AssignmentNotificationInput
): Promise<void> {
  if (!input.staffPhone) {
    console.warn('[assignment-notification] No phone number for staff:', input.staffName)
    return
  }

  if (!input.whatsappConfig.phoneNumberId || !input.whatsappConfig.accessToken) {
    console.warn('[assignment-notification] WhatsApp config incomplete, skipping notification')
    return
  }

  // Build the notification message
  const lines: string[] = [
    '🔔 *New Lead Assigned to You*',
    '',
  ]

  lines.push(`👤 *Buyer:* ${input.buyerName}`)

  if (input.companyName) {
    lines.push(`🏢 *Company:* ${input.companyName}`)
  }

  lines.push(`📱 *Mobile:* ${input.buyerPhone}`)

  if (input.product) {
    lines.push(`📦 *Product:* ${input.product}`)
  }

  if (input.quantity) {
    lines.push(`📊 *Quantity:* ${input.quantity}`)
  }

  lines.push(`🌐 *Source:* ${input.source}`)

  // Priority with emoji
  const priorityEmoji = input.priority === 'HOT' ? '🔥'
    : input.priority === 'WARM' ? '🟡'
    : input.priority === 'COLD' ? '🔵'
    : '⚪'
  lines.push(`🎯 *Priority:* ${priorityEmoji} ${input.priority}`)

  // Add conversation link
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  lines.push('')
  lines.push(`💬 *View Conversation:*`)
  lines.push(`${baseUrl}/inbox?conversation=${input.conversationId}`)

  lines.push('')
  lines.push('_Please follow up with this lead promptly._')

  const message = lines.join('\n')

  try {
    await sendWhatsAppMessage(
      input.staffPhone,
      message,
      input.whatsappConfig.phoneNumberId,
      input.whatsappConfig.accessToken
    )
    console.log(
      `[assignment-notification] Notification sent to ${input.staffName} (${input.staffPhone})`
    )
  } catch (error) {
    console.error(
      '[assignment-notification] Failed to send notification:',
      error instanceof Error ? error.message : error
    )
    throw error
  }
}
