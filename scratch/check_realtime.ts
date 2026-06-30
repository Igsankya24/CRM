import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function run() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    db: { schema: 'public' }
  });

  // Use direct fetch via Supabase REST API to check realtime
  // Check the conversations table RLS policies to understand what the anon user can see
  console.log("=== CHECKING CONVERSATIONS TABLE RLS POLICIES ===");
  const { data: policiesData, error: policiesError } = await supabase
    .rpc('debug_rls' as any, {});
  
  console.log("RLS check result:", { policiesData, policiesError: policiesError?.message });

  // Try to replicate what the browser does - anon client
  console.log("\n=== CHECKING WHAT ANON CLIENT SEES ===");
  const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", {
    auth: { persistSession: false }
  });
  
  const { data: conversations, error: convErr } = await anonClient
    .from("conversations")
    .select("id, last_message_text, last_message_at, unread_count, account_id")
    .limit(5);
  
  console.log("Anon conversations:", { conversations, error: convErr?.message });
  console.log("Code:", convErr?.code);
}

run().catch(console.error);
