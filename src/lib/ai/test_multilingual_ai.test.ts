import { describe, test, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// Load environment variables immediately before imports
const envPath = path.resolve(process.cwd(), '.env.local');
console.log('ENV PATH:', envPath);
console.log('ENV EXISTS:', fs.existsSync(envPath));
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
}
console.log('LOADED OPENROUTER KEY:', process.env.OPENROUTER_API_KEY ? 'present' : 'missing');

let generateSalesReply: any;
let getAdminClient: any;
let decrypt: any;

beforeAll(async () => {
  const mod = await import('./sales-agent');
  generateSalesReply = mod.generateSalesReply;
  
  const adminMod = await import('@/lib/supabase/admin');
  getAdminClient = adminMod.getAdminClient;

  const encMod = await import('@/lib/whatsapp/encryption');
  decrypt = encMod.decrypt;
});

async function testLanguage(inboundText: string, conversationId = 'cae6d116-a09b-4c43-8528-9e6d38175fe6') {
  const supabase = getAdminClient();
  
  // Clear any existing preferred_language or facts to ensure clean tests
  await supabase
    .from('ai_conversation_memory')
    .update({
      preferred_language: null,
      extracted_facts: {}
    })
    .eq('conversation_id', conversationId);

  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('openrouter_api_key')
    .limit(1)
    .single();

  const openrouterApiKey = config?.openrouter_api_key ? decrypt(config.openrouter_api_key) : undefined;

  const input = {
    accountId: 'd47e7290-8900-4853-abb4-62c219459fef',
    conversationId: conversationId,
    contactPhone: '+918792653748',
    contactName: 'Sanket Test',
    messages: [
      { sender_type: 'customer' as const, content_text: inboundText }
    ],
    inboundText: inboundText,
    aiConfig: {
      onlyFree: true,
      openrouterApiKey,
    }
  };

  const result = await generateSalesReply(input);
  console.log(`\n==================================================`);
  console.log(`INBOUND: "${inboundText}"`);
  console.log(`DETECTED LANGUAGE: ${result.extractedFacts.detected_language}`);
  console.log(`DETECTED INTENT: ${result.extractedFacts.intent}`);
  console.log(`AI ACTIONS: ${result.extractedFacts.ai_actions}`);
  console.log(`REPLY: ${result.reply}`);
  console.log(`==================================================\n`);
  return result;
}

describe('Multilingual AI Support Tests', () => {
  test('English conversation', async () => {
    const result = await testLanguage("Hello, what is the price of Wood Cutting Machine?");
    expect(result.extractedFacts.detected_language).toBe('English');
    expect(result.reply.length).toBeGreaterThan(10);
  }, 60000);

  test('Devanagari Hindi conversation', async () => {
    const result = await testLanguage("नमस्ते, Biomass Dryer कितने का है?");
    expect(result.extractedFacts.detected_language).toBe('Hindi');
    expect(result.reply.length).toBeGreaterThan(10);
  }, 60000);

  test('Hinglish conversation', async () => {
    const result = await testLanguage("Solar Cooker ka price bataiye, mujhe buy karna hai.");
    expect(result.extractedFacts.detected_language).toBe('Hinglish');
    expect(result.reply.length).toBeGreaterThan(10);
  }, 60000);

  test('Devanagari Marathi conversation', async () => {
    const result = await testLanguage("नमस्कार, Charcoal Stove ची किंमत सांगा.");
    expect(result.extractedFacts.detected_language).toBe('Marathi');
    expect(result.reply.length).toBeGreaterThan(10);
  }, 60000);

  test('Roman Marathi conversation', async () => {
    const result = await testLanguage("Charcoal Stove chi price kay aahe?");
    expect(result.extractedFacts.detected_language).toBe('Roman Marathi');
    expect(result.reply.length).toBeGreaterThan(10);
  }, 60000);

  test('Kannada script conversation', async () => {
    const result = await testLanguage("ನಮಸ್ಕಾರ, Wood Cutting Machine ಬೆಲೆ ಎಷ್ಟು?");
    expect(result.extractedFacts.detected_language).toBe('Kannada');
    expect(result.reply.length).toBeGreaterThan(10);
  }, 60000);

  test('Roman Kannada conversation', async () => {
    const result = await testLanguage("Solar Cooker price yestu?");
    expect(result.extractedFacts.detected_language).toBe('Roman Kannada');
    expect(result.reply.length).toBeGreaterThan(10);
  }, 60000);
});
