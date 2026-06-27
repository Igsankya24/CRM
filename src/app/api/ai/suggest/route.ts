import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSalesReply } from '@/lib/ai/sales-agent'
import { decrypt } from '@/lib/whatsapp/encryption'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const accountId = profile?.account_id
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { conversation_id } = body

    if (!conversation_id) {
      return NextResponse.json(
        { error: 'conversation_id is required' },
        { status: 400 }
      )
    }

    // Fetch conversation and contact details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('id', conversation_id)
      .eq('account_id', accountId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const contact = conversation.contact
    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 400 }
      )
    }

    // Fetch whatsapp_config for AI details
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (!config) {
      return NextResponse.json(
        { error: 'WhatsApp config not found' },
        { status: 400 }
      )
    }

    let openrouterApiKey: string | undefined
    if (config.openrouter_api_key) {
      try {
        openrouterApiKey = decrypt(config.openrouter_api_key)
      } catch (err) {
        console.error('[ai/suggest] Failed to decrypt OpenRouter API key:', err)
      }
    }

    // Get recent message history
    const { data: history } = await supabase
      .from('messages')
      .select('sender_type, content_text')
      .eq('conversation_id', conversation_id)
      .not('content_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)

    const messages = (history ?? []).reverse()

    // Determine latest message content
    const lastCustomerMsg = [...messages]
      .reverse()
      .find((m) => m.sender_type === 'customer')
    const inboundText = lastCustomerMsg?.content_text || 'hello'

    // Formulate a system prompt override to enforce:
    // "AI should generate replies using: Company Profile, Products, Pricing, Discount Rules, Terms & Conditions, Warranty, Bank Details, Delivery Time, Shipping, Stock Availability, Previous Conversations, Knowledge Base. AI should never invent pricing."
    const systemPromptOverride = `You are an AI assistant generating replies for the sales team inside the CRM Inbox.
Suggest a response to the customer based on the conversation history and the company knowledge base.

CRITICAL:
- ONLY reference actual product data and pricing from the catalog.
- DO NOT INVENT OR FABRICATE PRICES. If a price is not listed in the catalog, say that the sales team will check and provide pricing.
- Ground your replies in Company Profile, Products, Pricing, Discount Rules, Terms & Conditions, Warranty, Bank Details, Delivery Time, Shipping, Stock Availability, Previous Conversations, and Knowledge Base.
- Keep the response short, professional, and friendly.`

    // Call generateSalesReply helper
    const agentResult = await generateSalesReply({
      accountId,
      conversationId: conversation.id,
      contactPhone: contact.phone,
      contactName: contact.name,
      messages,
      inboundText,
      aiConfig: {
        model: config.ai_model ?? undefined,
        systemPrompt: systemPromptOverride, // Replaces default or injects rules
        onlyFree: config.ai_only_free_models === true,
        openrouterApiKey,
      },
      conversationOverrides: {
        model: conversation.ai_model ?? undefined,
        systemPrompt: conversation.ai_system_prompt ?? undefined,
      },
    })

    return NextResponse.json({
      reply: agentResult.reply,
    })
  } catch (error) {
    console.error('Error in AI suggest route:', error)
    return NextResponse.json(
      { error: 'Failed to generate AI suggestion' },
      { status: 500 }
    )
  }
}
