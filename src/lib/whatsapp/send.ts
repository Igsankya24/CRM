/**
 * Simple WhatsApp text message sender via Meta Cloud API.
 *
 * Migrated from Whatsapp-Agent-main/src/lib/whatsapp.ts.
 * Used by the AI auto-reply agent in the webhook handler.
 *
 * For full-featured messaging (templates, media, interactive),
 * use the functions in @/lib/whatsapp/meta-api.ts instead.
 */

/**
 * Sends a plain text WhatsApp message to a phone number.
 * Uses the WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID env vars.
 *
 * @param to - Recipient phone number (E.164 format, e.g. "919876543210")
 * @param body - Message text
 * @returns Meta API response JSON
 */
export async function sendWhatsAppMessage(
  to: string,
  body: string,
  phoneNumberId: string,
  accessToken: string
): Promise<{ messages?: { id: string }[]; error?: unknown }> {
  if (!phoneNumberId || !accessToken) {
    throw new Error(
      '[whatsapp/send] phoneNumberId and accessToken must be provided'
    )
  }

  const res = await fetch(
    `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    }
  )

  return res.json()
}
