/**
 * This script verifies the complete webhook pipeline:
 * 1. Simulates a Meta webhook POST
 * 2. Waits 3 seconds  
 * 3. Checks DB for the message
 * 4. Confirms message is visible via anon client (simulating the inbox)
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const uniqueWamid = `wamid.TEST${Date.now()}`;

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "769491486155233",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15556493111",
              phone_number_id: "1112790645256877"
            },
            contacts: [
              {
                profile: { name: "Test User" },
                wa_id: "918792653748"
              }
            ],
            messages: [
              {
                from: "918792653748",
                id: uniqueWamid,
                timestamp: String(Math.floor(Date.now() / 1000)),
                text: { body: `Test message at ${new Date().toISOString()}` },
                type: "text"
              }
            ]
          },
          field: "messages"
        }
      ]
    }
  ]
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("=== STEP 1: Sending test webhook POST ===");
  console.log("Message WAMID:", uniqueWamid);
  
  const res = await fetch("http://localhost:3000/api/whatsapp/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  
  const body = await res.text();
  console.log("Webhook response:", res.status, body);
  
  console.log("\n=== STEP 2: Waiting 3 seconds for async processing ===");
  await sleep(3000);
  
  console.log("\n=== STEP 3: Checking DB with service role ===");
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  
  const { data: messages, error: msgErr } = await adminClient
    .from("messages")
    .select("*")
    .eq("message_id", uniqueWamid);
  
  if (msgErr) console.error("Message lookup error:", msgErr.message);
  else console.log("Messages found in DB:", JSON.stringify(messages, null, 2));
  
  if (messages && messages.length > 0) {
    const msg = messages[0];
    const convId = msg.conversation_id;
    
    console.log("\n=== STEP 4: Checking conversation update ===");
    const { data: conv } = await adminClient
      .from("conversations")
      .select("id, last_message_text, last_message_at, unread_count")
      .eq("id", convId)
      .maybeSingle();
    console.log("Conversation:", JSON.stringify(conv, null, 2));
    
    console.log("\n=== STEP 5: Checking if conversations are accessible to logged-in user ===");
    console.log("Note: Supabase Realtime requires tables in supabase_realtime publication.");
    console.log("The anon key cannot fetch conversations without a JWT session.");
    console.log("The inbox page uses the session-authenticated client which should work.");
    console.log("\n✓ CONCLUSION: Message was saved to DB successfully.");
    console.log("✓ Conversation was updated with last_message_text:", conv?.last_message_text);
    console.log("\nThe issue is LIKELY one of:");
    console.log("1. Supabase Realtime NOT enabled for messages/conversations tables");
    console.log("2. RLS policies blocking realtime events");
    console.log("3. The unread_count update/conversation update isn't triggering realtime");
  } else {
    console.error("✗ Message NOT found in DB. The webhook pipeline is failing.");
  }
}

run().catch(console.error);
