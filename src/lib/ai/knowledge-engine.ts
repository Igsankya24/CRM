/**
 * AI Knowledge Engine — reads all company knowledge sources and builds
 * an enriched system prompt for the AI sales agent.
 *
 * Before every AI reply, this module assembles context from:
 *   - company_settings (company info, policies)
 *   - company_products (catalog, pricing, MOQ)
 *   - company_faq (frequently asked questions)
 *   - customer_memory (per-phone facts)
 *   - ai_conversation_memory (per-conversation state)
 *   - crm_leads (linked lead info)
 *   - Recent messages (conversation context)
 *
 * The assembled context is injected into the system prompt so the AI
 * can answer with real company data instead of generic responses.
 *
 * All operations use the SERVICE ROLE client to bypass RLS.
 */

import { getAdminClient } from '@/lib/supabase/admin'

// ─── Types ──────────────────────────────────────────────────────────────

export interface CompanySettings {
  company_name: string | null
  company_description: string | null
  tagline: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  pincode: string | null
  phone: string | null
  alternate_phone: string | null
  email: string | null
  website: string | null
  gst_number: string | null
  working_hours: string | null
  catalog_pdf_url: string | null
  terms_and_conditions: string | null
  quotation_terms_text: string | null
  proforma_terms_text: string | null
  sales_register_terms_text: string | null
  shipping_policy: string | null
  payment_terms: string | null
  warranty_policy: string | null
  social_media: Record<string, string> | null
}

export interface CompanyProduct {
  product_name: string
  category: string | null
  description: string | null
  specification: string | null
  price: number | null
  discount_percent: number | null
  currency: string | null
  moq: number | null
  unit: string | null
  available_quantity: number | null
  delivery_time: string | null
}

export interface CompanyFaqItem {
  question: string
  answer: string
  category: string | null
}

export interface ConversationMemoryState {
  summary: string | null
  customer_interest: string | null
  budget: string | null
  product: string | null
  quantity: string | null
  urgency: string | null
  location: string | null
  need_date: string | null
  stage: string | null
  extracted_facts: Record<string, string> | null
}

export interface KnowledgeContext {
  companySettings: CompanySettings | null
  products: CompanyProduct[]
  faq: CompanyFaqItem[]
  conversationMemory: ConversationMemoryState | null
  customerMemoryBlock: string  // pre-formatted from customer_memory
  leadInfo: {
    buyer_name: string | null
    company_name: string | null
    product_name: string | null
    source: string | null
    stage: string | null
  } | null
}

// ─── Data Loaders ───────────────────────────────────────────────────────

/**
 * Loads all company settings for an account.
 */
export async function loadCompanySettings(
  accountId: string
): Promise<CompanySettings | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()

  if (error) {
    console.error('[knowledge-engine] Failed to load company settings:', error.message)
    return null
  }
  return data ?? null
}

/**
 * Loads active products for an account (limited to 50 for prompt size).
 */
export async function loadCompanyProducts(
  accountId: string
): Promise<CompanyProduct[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('company_products')
    .select('product_name, category, description, specification, price, discount_percent, currency, moq, unit, available_quantity, delivery_time')
    .eq('account_id', accountId)
    .eq('is_active', true)
    .order('product_name')
    .limit(50)

  if (error) {
    console.error('[knowledge-engine] Failed to load products:', error.message)
    return []
  }
  return data ?? []
}

/**
 * Loads active FAQ items for an account (limited to 30).
 */
export async function loadCompanyFaq(
  accountId: string
): Promise<CompanyFaqItem[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('company_faq')
    .select('question, answer, category')
    .eq('account_id', accountId)
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .limit(30)

  if (error) {
    console.error('[knowledge-engine] Failed to load FAQ:', error.message)
    return []
  }
  return data ?? []
}

/**
 * Loads AI conversation memory for a specific conversation.
 */
export async function loadConversationMemory(
  conversationId: string
): Promise<ConversationMemoryState | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('ai_conversation_memory')
    .select('summary, customer_interest, budget, product, quantity, urgency, location, need_date, stage, extracted_facts')
    .eq('conversation_id', conversationId)
    .maybeSingle()

  if (error) {
    console.error('[knowledge-engine] Failed to load conversation memory:', error.message)
    return null
  }
  return data ?? null
}

/**
 * Loads linked CRM lead info for a conversation.
 */
export async function loadLinkedLeadInfo(
  accountId: string,
  conversationId: string
): Promise<KnowledgeContext['leadInfo']> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('crm_leads')
    .select('buyer_name, company_name, product_name, source, stage')
    .eq('account_id', accountId)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[knowledge-engine] Failed to load lead info:', error.message)
    return null
  }
  return data ?? null
}

// ─── Prompt Builder ─────────────────────────────────────────────────────

/**
 * Assembles the full knowledge context for a conversation.
 */
export async function assembleKnowledgeContext(
  accountId: string,
  conversationId: string,
  customerMemoryBlock: string
): Promise<KnowledgeContext> {
  // Load all knowledge sources in parallel for speed
  const [companySettings, products, faq, conversationMemory, leadInfo] =
    await Promise.all([
      loadCompanySettings(accountId),
      loadCompanyProducts(accountId),
      loadCompanyFaq(accountId),
      loadConversationMemory(conversationId),
      loadLinkedLeadInfo(accountId, conversationId),
    ])

  return {
    companySettings,
    products,
    faq,
    conversationMemory,
    customerMemoryBlock,
    leadInfo,
  }
}

/**
 * Builds a knowledge block to inject into the AI system prompt.
 * Returns a structured text that gives the AI all the context it needs.
 */
export function buildKnowledgePromptBlock(ctx: KnowledgeContext): string {
  const sections: string[] = []

  // ── Company Info ──
  if (ctx.companySettings) {
    const cs = ctx.companySettings
    const companyLines: string[] = ['## Company Information']
    if (cs.company_name) companyLines.push(`**Company Name:** ${cs.company_name}`)
    if (cs.company_description) companyLines.push(`**About:** ${cs.company_description}`)
    if (cs.tagline) companyLines.push(`**Tagline:** ${cs.tagline}`)
    if (cs.address || cs.city || cs.state || cs.country) {
      const addr = [cs.address, cs.city, cs.state, cs.country, cs.pincode].filter(Boolean).join(', ')
      companyLines.push(`**Address:** ${addr}`)
    }
    if (cs.phone) companyLines.push(`**Phone:** ${cs.phone}`)
    if (cs.email) companyLines.push(`**Email:** ${cs.email}`)
    if (cs.website) companyLines.push(`**Website:** ${cs.website}`)
    if (cs.gst_number) companyLines.push(`**GST:** ${cs.gst_number}`)
    if (cs.working_hours) companyLines.push(`**Working Hours:** ${cs.working_hours}`)

    // Policies
    if (cs.payment_terms) companyLines.push(`\n**Payment Terms:** ${cs.payment_terms}`)
    if (cs.shipping_policy) companyLines.push(`**Shipping Policy:** ${cs.shipping_policy}`)
    if (cs.warranty_policy) companyLines.push(`**Warranty Policy:** ${cs.warranty_policy}`)
    if (cs.terms_and_conditions) companyLines.push(`**Terms & Conditions:** ${cs.terms_and_conditions}`)
    if (cs.catalog_pdf_url) companyLines.push(`**Product Catalog:** ${cs.catalog_pdf_url}`)

    sections.push(companyLines.join('\n'))
  }

  // ── Products ──
  if (ctx.products.length > 0) {
    const prodLines: string[] = ['## Product Catalog']
    for (const p of ctx.products) {
      const parts: string[] = [`- **${p.product_name}**`]
      if (p.category) parts.push(`Category: ${p.category}`)
      if (p.description) parts.push(`${p.description}`)
      if (p.specification) parts.push(`Specs: ${p.specification}`)
      if (p.price != null) {
        let priceStr = `Price: ${p.currency ?? 'INR'} ${p.price}`
        if (p.discount_percent && p.discount_percent > 0) {
          priceStr += ` (${p.discount_percent}% discount available)`
        }
        parts.push(priceStr)
      }
      if (p.moq != null && p.moq > 1) parts.push(`MOQ: ${p.moq} ${p.unit ?? 'pcs'}`)
      if (p.available_quantity != null) parts.push(`Available: ${p.available_quantity} ${p.unit ?? 'pcs'}`)
      if (p.delivery_time) parts.push(`Delivery: ${p.delivery_time}`)
      prodLines.push(parts.join(' | '))
    }
    sections.push(prodLines.join('\n'))
  }

  // ── FAQ ──
  if (ctx.faq.length > 0) {
    const faqLines: string[] = ['## Frequently Asked Questions']
    for (const f of ctx.faq) {
      faqLines.push(`**Q: ${f.question}**`)
      faqLines.push(`A: ${f.answer}`)
      faqLines.push('')
    }
    sections.push(faqLines.join('\n'))
  }

  // ── Lead Info ──
  if (ctx.leadInfo) {
    const li = ctx.leadInfo
    const leadLines: string[] = ['## Current Lead Context']
    if (li.buyer_name) leadLines.push(`**Buyer:** ${li.buyer_name}`)
    if (li.company_name) leadLines.push(`**Company:** ${li.company_name}`)
    if (li.product_name) leadLines.push(`**Interested In:** ${li.product_name}`)
    if (li.source) leadLines.push(`**Source:** ${li.source}`)
    if (li.stage) leadLines.push(`**Stage:** ${li.stage}`)
    sections.push(leadLines.join('\n'))
  }

  // ── Conversation Memory ──
  if (ctx.conversationMemory) {
    const cm = ctx.conversationMemory
    const memLines: string[] = ['## Conversation Progress']
    if (cm.stage) memLines.push(`**Current Stage:** ${cm.stage}`)
    if (cm.summary) memLines.push(`**Summary So Far:** ${cm.summary}`)
    if (cm.customer_interest) memLines.push(`**Interest:** ${cm.customer_interest}`)
    if (cm.budget) memLines.push(`**Budget:** ${cm.budget}`)
    if (cm.product) memLines.push(`**Product:** ${cm.product}`)
    if (cm.quantity) memLines.push(`**Quantity:** ${cm.quantity}`)
    if (cm.urgency) memLines.push(`**Urgency:** ${cm.urgency}`)
    if (cm.location) memLines.push(`**Location:** ${cm.location}`)
    if (cm.need_date) memLines.push(`**Need Date:** ${cm.need_date}`)

    const facts = cm.extracted_facts ?? {}
    const factEntries = Object.entries(facts)
    if (factEntries.length > 0) {
      memLines.push('**Other known details:**')
      for (const [k, v] of factEntries) {
        memLines.push(`- ${k}: ${v}`)
      }
    }
    sections.push(memLines.join('\n'))
  }

  // ── Customer Memory (per-phone, from existing customer_memory table) ──
  if (ctx.customerMemoryBlock) {
    sections.push(ctx.customerMemoryBlock)
  }

  return sections.join('\n\n')
}
