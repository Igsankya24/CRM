import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function run() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  const testProformaId = "6711a984-a356-4ae9-8eaa-eefcfe6e5c33";

  // Fetch current status
  const { data: original, error: getErr } = await supabase
    .from("proformas")
    .select("status")
    .eq("id", testProformaId)
    .single();

  if (getErr) {
    console.error("Get error:", getErr);
    return;
  }
  console.log("Original status:", original.status);

  // Try updating to 'converted'
  console.log("Attempting to update status to 'converted'...");
  const { data, error: updErr } = await supabase
    .from("proformas")
    .update({ status: "converted" })
    .eq("id", testProformaId)
    .select("status");

  if (updErr) {
    console.error("Update to 'converted' failed:", updErr);
  } else {
    console.log("Update to 'converted' succeeded:", data);
    // restore original status
    await supabase.from("proformas").update({ status: original.status }).eq("id", testProformaId);
  }
}

run().catch(console.error);
