/**
 * AI Sales Agent — higher-level agent wrapping getAIResponse().
 *
 * For every inbound WhatsApp message on an AI-enabled conversation:
 *   1. Loads the full knowledge context (company, products, FAQ, memory)
 *   2. Builds an enriched system prompt
 *   3. Generates the AI reply
 *   4. Extracts structured facts from the conversation (interest, budget, etc.)
 *   5. Updates ai_conversation_memory with extracted data
 *   6. Scores the lead
 *   7. Detects handoff triggers
 *
 * The caller (webhook route) decides what to do with the result:
 *   - Send the reply via WhatsApp
 *   - If shouldHandoff is true, trigger the handoff flow
 */

import type { Message } from '@/types'
import { getAIResponse } from './agent'
import { SALES_AGENT_SYSTEM_PROMPT } from './system-prompt'
import {
  getMemoryContext,
  getConversationMemory,
  upsertConversationMemory,
  type ConversationMemoryRecord,
} from './memory'
import {
  assembleKnowledgeContext,
  buildKnowledgePromptBlock,
} from './knowledge-engine'
import { scoreLeadFromConversation } from './lead-scorer'
import { getAdminClient } from '@/lib/supabase/admin'

// ─── Types ──────────────────────────────────────────────────────────────

export interface SalesAgentInput {
  accountId: string
  conversationId: string
  contactPhone: string
  contactName: string | null
  messages: Pick<Message, 'sender_type' | 'content_text'>[]
  inboundText: string
  /** AI config from whatsapp_config */
  aiConfig: {
    model?: string | null
    systemPrompt?: string | null
    onlyFree?: boolean
    openrouterApiKey?: string
  }
  /** Conversation-level overrides */
  conversationOverrides?: {
    model?: string | null
    systemPrompt?: string | null
  }
}

export interface SalesAgentResult {
  /** The AI-generated reply text */
  reply: string
  /** Model that generated the reply */
  model: string
  /** Whether the AI detected a handoff trigger */
  shouldHandoff: boolean
  /** Reason for handoff (if any) */
  handoffReason: string | null
  /** Updated lead score */
  leadScore: {
    score: 'HOT' | 'WARM' | 'COLD' | 'SPAM'
    reasons: string[]
  } | null
  /** Facts extracted from this message */
  extractedFacts: Record<string, string>
}

// ─── Handoff Detection ──────────────────────────────────────────────────

const HANDOFF_PATTERNS = [
  { pattern: /\b(quotation|quote|proforma|invoice|pi)\b/i, reason: 'Customer requested quotation' },
  { pattern: /\b(call me|phone call|speak to|talk to|call back|ring me)\b/i, reason: 'Customer requested phone call' },
  { pattern: /\b(negotiate|negotiation|better price|best price|final price|discount.*more)\b/i, reason: 'Customer wants negotiation' },
  { pattern: /\b(custom|customize|customiz|special order|bespoke|tailor)\b/i, reason: 'Customer needs customization' },
  { pattern: /\b(technical|specification|spec sheet|drawing|engineering|blueprint)\b/i, reason: 'Customer has technical questions' },
  { pattern: /\b(place order|confirm order|ready to buy|want to buy|proceed|go ahead)\b/i, reason: 'Customer ready to order' },
  { pattern: /\b(complaint|problem|issue|defective|damaged|wrong)\b/i, reason: 'Customer has a complaint' },
  { pattern: /\b(visit|meet|meeting|factory visit|showroom)\b/i, reason: 'Customer wants to visit/meet' },
  { pattern: /\b(bulk order|large order|container|full truck|wholesale)\b/i, reason: 'Customer wants bulk/wholesale pricing' },
]

function detectHandoffTrigger(
  text: string,
  memory: ConversationMemoryRecord | null
): { shouldHandoff: boolean; reason: string | null } {
  // Check pattern-based triggers
  for (const { pattern, reason } of HANDOFF_PATTERNS) {
    if (pattern.test(text)) {
      return { shouldHandoff: true, reason }
    }
  }

  // Check if conversation is mature enough for handoff
  // (serious buyer with enough messages)
  if (memory) {
    const customerMsgCount = memory.customer_message_count ?? 0
    const stage = memory.stage

    // If customer has sent 8+ messages and is at product_identified or serious_buyer stage
    if (customerMsgCount >= 8 && (stage === 'product_identified' || stage === 'serious_buyer')) {
      return { shouldHandoff: true, reason: 'Customer appears serious — sufficient engagement' }
    }
  }

  return { shouldHandoff: false, reason: null }
}

// ─── Fact Extraction ────────────────────────────────────────────────────

/**
 * Extracts structured facts from the customer's latest message.
 * Uses simple pattern matching — fast and doesn't cost an LLM call.
 */
function extractFactsFromMessage(text: string): Record<string, string> {
  const facts: Record<string, string> = {}
  const lower = text.toLowerCase()

  // Budget detection
  const budgetMatch = text.match(/(?:budget|spend|price range|afford)[\s:]*(?:(?:Rs\.?|INR|₹|USD|\$)\s*)?(\d[\d,]*(?:\.\d+)?(?:\s*(?:lakh|lac|crore|cr|k|L|lakhs|crores))?)/i)
  if (budgetMatch) {
    facts.budget = budgetMatch[1].trim()
  }

  // Quantity detection
  const qtyMatch = text.match(/(?:need|want|require|order|quantity|qty)[\s:]*(\d[\d,]*)\s*(?:pcs|pieces|units|kg|tons?|metres?|meters?|sets?|boxes?|cartons?|rolls?|sheets?)?/i)
  if (qtyMatch) {
    facts.quantity = qtyMatch[0].replace(/(?:need|want|require|order|quantity|qty)[\s:]*/i, '').trim()
  }

  // Location detection
  const locationMatch = text.match(/(?:from|in|at|based in|located|location|city|deliver to)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)
  if (locationMatch && locationMatch[1].length > 2 && locationMatch[1].length < 30) {
    facts.location = locationMatch[1].trim()
  }

  // Urgency detection
  if (/\b(urgent|asap|immediately|rush|emergency|today|tomorrow)\b/i.test(lower)) {
    facts.urgency = 'HIGH'
  } else if (/\b(soon|this week|next week|quickly)\b/i.test(lower)) {
    facts.urgency = 'MEDIUM'
  }

  // Need date detection
  const dateMatch = text.match(/(?:need by|deliver by|before|deadline|by)\s+(\d{1,2}[\s/-]\w+[\s/-]?\d{0,4}|\w+\s+\d{1,2}(?:\s*,?\s*\d{4})?)/i)
  if (dateMatch) {
    facts.need_date = dateMatch[1].trim()
  }

  return facts
}

/**
 * Determines the conversation stage based on extracted memory.
 */
function determineStage(
  memory: ConversationMemoryRecord | null,
  newFacts: Record<string, string>,
  shouldHandoff: boolean
): string {
  if (shouldHandoff) return 'ready_for_handoff'

  const customerMsgCount = (memory?.customer_message_count ?? 0) + 1

  if (customerMsgCount <= 1) return 'greeting'

  // Check what we know so far
  const hasProduct = !!(memory?.product || newFacts.product)
  const hasBudget = !!(memory?.budget || newFacts.budget)
  const hasQuantity = !!(memory?.quantity || newFacts.quantity)

  if (hasProduct && hasBudget && hasQuantity) return 'serious_buyer'
  if (hasProduct && (hasBudget || hasQuantity)) return 'product_identified'
  if (hasProduct) return 'collecting_requirements'
  if (customerMsgCount >= 3) return 'answering_queries'
  return 'collecting_requirements'
}

// ─── Main Agent ─────────────────────────────────────────────────────────

/**
 * The main sales agent entry point. Called from the webhook handler
 * on every inbound message for AI-enabled conversations.
 */
export async function generateSalesReply(
  input: SalesAgentInput
): Promise<SalesAgentResult> {
  const {
    accountId,
    conversationId,
    contactPhone,
    messages,
    inboundText,
    aiConfig,
    conversationOverrides,
  } = input

  // 1. Load knowledge context
  const customerMemoryBlock = await getMemoryContext(accountId, contactPhone)
  const knowledgeCtx = await assembleKnowledgeContext(
    accountId,
    conversationId,
    customerMemoryBlock
  )
  const knowledgeBlock = buildKnowledgePromptBlock(knowledgeCtx)

  // 2. Load conversation memory
  const convMemory = await getConversationMemory(conversationId)

  // 3. Build system prompt
  const basePrompt = conversationOverrides?.systemPrompt
    ?? aiConfig.systemPrompt
    ?? SALES_AGENT_SYSTEM_PROMPT

  const fullSystemPrompt = knowledgeBlock
    ? `${basePrompt}\n\n---\n\n${knowledgeBlock}`
    : basePrompt

  // 4. Generate AI reply
  const aiResult = await getAIResponse(messages, {
    model: conversationOverrides?.model ?? aiConfig.model ?? undefined,
    systemPrompt: fullSystemPrompt,
    onlyFree: aiConfig.onlyFree,
    openrouterApiKey: aiConfig.openrouterApiKey,
    maxTokens: 600,
  })

  // 5. Extract facts from inbound message
  const extractedFacts = extractFactsFromMessage(inboundText)

  // 6. Detect handoff
  const handoff = detectHandoffTrigger(inboundText, convMemory)

  // 7. Determine stage
  const newStage = determineStage(convMemory, extractedFacts, handoff.shouldHandoff)

  // 8. Update conversation memory
  const updatedMemory: Partial<ConversationMemoryRecord> & { conversation_id: string; account_id: string } = {
    conversation_id: conversationId,
    account_id: accountId,
    stage: newStage,
    customer_message_count: (convMemory?.customer_message_count ?? 0) + 1,
    ai_message_count: (convMemory?.ai_message_count ?? 0) + 1,
    message_count: (convMemory?.message_count ?? 0) + 2,
    last_customer_message_at: new Date().toISOString(),
  }

  if (extractedFacts.budget) updatedMemory.budget = extractedFacts.budget
  if (extractedFacts.quantity) updatedMemory.quantity = extractedFacts.quantity
  if (extractedFacts.urgency) updatedMemory.urgency = extractedFacts.urgency
  if (extractedFacts.location) updatedMemory.location = extractedFacts.location
  if (extractedFacts.need_date) updatedMemory.need_date = extractedFacts.need_date

  // Merge extracted_facts
  const existingFacts = convMemory?.extracted_facts ?? {}
  updatedMemory.extracted_facts = { ...existingFacts, ...extractedFacts }

  // Set first_response_at if this is the first exchange
  if (!convMemory?.first_response_at) {
    updatedMemory.first_response_at = new Date().toISOString()
  }

  await upsertConversationMemory(updatedMemory)

  // 9. Score the lead
  let leadScore: SalesAgentResult['leadScore'] = null
  try {
    leadScore = scoreLeadFromConversation(convMemory, extractedFacts, messages.length)
    // Update crm_leads if linked
    if (leadScore) {
      const supabase = getAdminClient()
      await supabase
        .from('crm_leads')
        .update({
          ai_score: leadScore.score,
          ai_score_reasons: leadScore.reasons,
        })
        .eq('account_id', accountId)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
    }
  } catch (err) {
    console.error('[sales-agent] Lead scoring failed:', err)
  }

  return {
    reply: aiResult.content,
    model: aiResult.model,
    shouldHandoff: handoff.shouldHandoff,
    handoffReason: handoff.reason,
    leadScore,
    extractedFacts,
  }
}
