/**
 * Customer Memory Service — per-contact AI fact store.
 *
 * Reads and writes the `customer_memory` table (migration 031).
 * The AI agent calls `getMemoryContext()` to enrich its system prompt
 * with known facts about the customer before composing a reply,
 * and `saveCustomerFact()` / `saveCustomerSummary()` when it discovers
 * new information during a conversation.
 *
 * Design:
 *   - Facts are a JSONB map of key → value strings (lightweight, structured).
 *   - Summary is a single free-text paragraph (richer, less queryable).
 *   - Both are merged into the system prompt via `buildMemoryBlock()`.
 *   - All operations use the SERVICE ROLE client to bypass RLS —
 *     this module is server-side only (called from API routes / webhook).
 *
 * Usage:
 *   import { getMemoryContext, saveCustomerFact, saveCustomerSummary } from '@/lib/ai/memory'
 */

import { getAdminClient } from '@/lib/supabase/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerMemoryRecord {
  id: string
  account_id: string
  phone: string
  facts: Record<string, string>
  summary: string | null
  created_at: string
  updated_at: string
}

// ─── Core Operations ──────────────────────────────────────────────────────────

/**
 * Returns the current memory record for a given (account, phone) pair.
 * Returns null if no memory exists yet.
 */
export async function getCustomerMemory(
  accountId: string,
  phone: string
): Promise<CustomerMemoryRecord | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('customer_memory')
    .select('*')
    .eq('account_id', accountId)
    .eq('phone', phone)
    .maybeSingle()

  if (error) {
    console.error('[memory] Failed to read customer memory:', error.message)
    return null
  }
  return data ?? null
}

/**
 * Builds a formatted text block to inject into the AI system prompt.
 * Returns an empty string if there is no memory for this customer.
 *
 * Example output:
 *   ## Customer Memory
 *   **Known facts about this customer:**
 *   - interest: bulk pricing (min 100 units)
 *   - preferred_language: Hindi
 *   - last_product_enquiry: CRM Software
 *
 *   **Agent notes:**
 *   Customer is a repeat enquirer from Pune. Very price-sensitive.
 */
export async function getMemoryContext(
  accountId: string,
  phone: string
): Promise<string> {
  const memory = await getCustomerMemory(accountId, phone)
  if (!memory) return ''

  const lines: string[] = []

  const factEntries = Object.entries(memory.facts ?? {})
  if (factEntries.length > 0) {
    lines.push('## Customer Memory')
    lines.push('**Known facts about this customer:**')
    for (const [k, v] of factEntries) {
      lines.push(`- ${k}: ${v}`)
    }
  }

  if (memory.summary) {
    if (lines.length === 0) lines.push('## Customer Memory')
    lines.push('')
    lines.push('**Agent notes:**')
    lines.push(memory.summary)
  }

  return lines.length > 0 ? lines.join('\n') : ''
}

/**
 * Upserts a single fact key/value for a customer.
 * Creates the memory record if it doesn't exist yet.
 *
 * @param accountId  - The account that owns this customer relationship
 * @param phone      - Customer's phone number (E.164 format recommended)
 * @param key        - Fact key, e.g. 'interest', 'preferred_language'
 * @param value      - Fact value, e.g. 'bulk pricing (min 100 units)', 'Hindi'
 */
export async function saveCustomerFact(
  accountId: string,
  phone: string,
  key: string,
  value: string
): Promise<void> {
  const supabase = getAdminClient()

  // Read existing facts first so we can merge (jsonb_set would require raw SQL)
  const existing = await getCustomerMemory(accountId, phone)
  const currentFacts = existing?.facts ?? {}
  const updatedFacts = { ...currentFacts, [key]: value }

  const { error } = await supabase
    .from('customer_memory')
    .upsert(
      {
        account_id: accountId,
        phone,
        facts: updatedFacts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,phone' }
    )

  if (error) {
    console.error('[memory] Failed to save customer fact:', error.message)
  }
}

/**
 * Updates (or creates) the free-text summary for a customer.
 * The summary is a paragraph-length overview written by an agent or AI.
 */
export async function saveCustomerSummary(
  accountId: string,
  phone: string,
  summary: string
): Promise<void> {
  const supabase = getAdminClient()

  const { error } = await supabase
    .from('customer_memory')
    .upsert(
      {
        account_id: accountId,
        phone,
        summary,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,phone' }
    )

  if (error) {
    console.error('[memory] Failed to save customer summary:', error.message)
  }
}

/**
 * Merges multiple facts at once (batch upsert).
 * Useful after an AI pass that extracts several facts simultaneously.
 */
export async function mergeCustomerFacts(
  accountId: string,
  phone: string,
  newFacts: Record<string, string>
): Promise<void> {
  if (Object.keys(newFacts).length === 0) return

  const supabase = getAdminClient()
  const existing = await getCustomerMemory(accountId, phone)
  const updatedFacts = { ...(existing?.facts ?? {}), ...newFacts }

  const { error } = await supabase
    .from('customer_memory')
    .upsert(
      {
        account_id: accountId,
        phone,
        facts: updatedFacts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,phone' }
    )

  if (error) {
    console.error('[memory] Failed to merge customer facts:', error.message)
  }
}

/**
 * Deletes ALL memory for a customer.
 * Should be called only on explicit user request (privacy / GDPR).
 */
export async function clearCustomerMemory(
  accountId: string,
  phone: string
): Promise<void> {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('customer_memory')
    .delete()
    .eq('account_id', accountId)
    .eq('phone', phone)

  if (error) {
    console.error('[memory] Failed to clear customer memory:', error.message)
  }
}

// ─── Conversation Memory (ai_conversation_memory) ─────────────────────

export interface ConversationMemoryRecord {
  id?: string
  account_id: string
  conversation_id: string
  summary: string | null
  customer_interest: string | null
  budget: string | null
  product: string | null
  quantity: string | null
  urgency: string | null
  location: string | null
  need_date: string | null
  preferred_language: string | null
  stage: string | null
  message_count: number
  customer_message_count: number
  ai_message_count: number
  first_response_at: string | null
  last_customer_message_at: string | null
  extracted_facts: Record<string, string> | null
  created_at?: string
  updated_at?: string
}

/**
 * Returns the conversation memory for a specific conversation.
 * Returns null if no memory exists yet.
 */
export async function getConversationMemory(
  conversationId: string
): Promise<ConversationMemoryRecord | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('ai_conversation_memory')
    .select('*')
    .eq('conversation_id', conversationId)
    .maybeSingle()

  if (error) {
    console.error('[memory] Failed to read conversation memory:', error.message)
    return null
  }
  return data ?? null
}

/**
 * Upserts conversation memory. Creates the record if it doesn't exist,
 * or merges fields into the existing record.
 */
export async function upsertConversationMemory(
  memory: Partial<ConversationMemoryRecord> & {
    conversation_id: string
    account_id: string
  }
): Promise<void> {
  const supabase = getAdminClient()

  const { error } = await supabase
    .from('ai_conversation_memory')
    .upsert(
      {
        ...memory,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id' }
    )

  if (error) {
    console.error('[memory] Failed to upsert conversation memory:', error.message)
  }
}

/**
 * Updates specific fields on an existing conversation memory record.
 */
export async function updateConversationMemoryFields(
  conversationId: string,
  fields: Partial<Omit<ConversationMemoryRecord, 'id' | 'conversation_id' | 'account_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const supabase = getAdminClient()

  const { error } = await supabase
    .from('ai_conversation_memory')
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
    })
    .eq('conversation_id', conversationId)

  if (error) {
    console.error('[memory] Failed to update conversation memory fields:', error.message)
  }
}
