/**
 * Smart Lead Scorer — calculates lead temperature (Part 11).
 *
 * Analyzes conversation metrics and extracted facts to produce
 * a lead score: HOT, WARM, COLD, or SPAM.
 *
 * Scoring factors:
 *   - Response speed (how quickly customer replies)
 *   - Budget mentioned
 *   - Quantity mentioned
 *   - Interest level (product identified, multiple questions)
 *   - Follow-up count (returning customer)
 *   - Message count (engagement depth)
 *   - Urgency signals
 *
 * This is a rule-based scorer — fast, deterministic, no LLM call.
 * Can be extended with ML-based scoring in the future.
 */

import type { ConversationMemoryRecord } from './memory'

export interface LeadScoreResult {
  score: 'HOT' | 'WARM' | 'COLD' | 'SPAM'
  reasons: string[]
  numericScore: number  // 0-100 for granular ranking
}

/**
 * Scores a lead based on conversation memory, extracted facts, and message count.
 */
export function scoreLeadFromConversation(
  memory: ConversationMemoryRecord | null,
  newFacts: Record<string, string>,
  totalMessages: number
): LeadScoreResult {
  let score = 0
  const reasons: string[] = []

  // ── Message Engagement ──
  const customerMsgs = memory?.customer_message_count ?? 0
  if (customerMsgs >= 10) {
    score += 25
    reasons.push('High engagement (10+ messages)')
  } else if (customerMsgs >= 5) {
    score += 15
    reasons.push('Good engagement (5+ messages)')
  } else if (customerMsgs >= 2) {
    score += 5
    reasons.push('Some engagement')
  }

  // ── Budget Mentioned ──
  const budget = memory?.budget || newFacts.budget
  if (budget) {
    score += 20
    reasons.push(`Budget mentioned: ${budget}`)
  }

  // ── Quantity Mentioned ──
  const quantity = memory?.quantity || newFacts.quantity
  if (quantity) {
    score += 15
    reasons.push(`Quantity specified: ${quantity}`)
  }

  // ── Product Interest ──
  const product = memory?.product || newFacts.product
  if (product) {
    score += 10
    reasons.push(`Product interest: ${product}`)
  }

  const interest = memory?.customer_interest
  if (interest) {
    score += 5
    reasons.push(`Expressed interest: ${interest}`)
  }

  // ── Urgency ──
  const urgency = memory?.urgency || newFacts.urgency
  if (urgency === 'HIGH' || urgency === 'CRITICAL') {
    score += 15
    reasons.push('High urgency detected')
  } else if (urgency === 'MEDIUM') {
    score += 8
    reasons.push('Medium urgency')
  }

  // ── Response Speed ──
  if (memory?.first_response_at && memory?.last_customer_message_at) {
    const firstAt = new Date(memory.first_response_at).getTime()
    const lastAt = new Date(memory.last_customer_message_at).getTime()
    const hoursSinceFirst = (lastAt - firstAt) / (1000 * 60 * 60)

    // Customer came back within 24h = more serious
    if (hoursSinceFirst <= 1 && customerMsgs >= 3) {
      score += 10
      reasons.push('Fast-paced conversation (within 1hr)')
    } else if (hoursSinceFirst <= 24 && customerMsgs >= 3) {
      score += 5
      reasons.push('Active within 24 hours')
    }
  }

  // ── Need Date ──
  const needDate = memory?.need_date || newFacts.need_date
  if (needDate) {
    score += 10
    reasons.push(`Delivery date specified: ${needDate}`)
  }

  // ── Location ──
  const location = memory?.location || newFacts.location
  if (location) {
    score += 5
    reasons.push(`Location: ${location}`)
  }

  // ── Stage-based boost ──
  const stage = memory?.stage
  if (stage === 'serious_buyer') {
    score += 15
    reasons.push('Identified as serious buyer')
  } else if (stage === 'product_identified') {
    score += 8
    reasons.push('Product identified')
  } else if (stage === 'ready_for_handoff') {
    score += 20
    reasons.push('Ready for human handoff')
  }

  // ── Spam Detection ──
  // Very short messages, single emoji, or very few words across many messages
  const avgWordsPerMsg = totalMessages > 0
    ? (memory?.summary?.split(' ').length ?? 10) / Math.max(customerMsgs, 1)
    : 0
  if (customerMsgs >= 3 && avgWordsPerMsg < 2 && !budget && !quantity && !product) {
    return {
      score: 'SPAM',
      reasons: ['Very short messages with no substance'],
      numericScore: Math.min(score, 10),
    }
  }

  // ── Classify ──
  let classification: 'HOT' | 'WARM' | 'COLD' | 'SPAM'
  if (score >= 60) {
    classification = 'HOT'
  } else if (score >= 30) {
    classification = 'WARM'
  } else {
    classification = 'COLD'
  }

  return {
    score: classification,
    reasons,
    numericScore: Math.min(score, 100),
  }
}
