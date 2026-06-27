import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleDocumentAutomation } from "@/lib/crm/automations";

// GET /api/quotations/[id] — full quotation with items, terms, logs
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Permission: quotation.view OR sales.view
    const { data: hpv } = await supabase.rpc("has_permission", { p_module: "quotation", p_action: "view" });
    const { data: hlv } = await supabase.rpc("has_permission", { p_module: "sales", p_action: "view" });
    if (!hpv && !hlv) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabase
      .from("quotations")
      .select(
        `*,
         items:quotation_items(* ),
         terms:quotation_terms(*),
         logs:quotation_logs(*),
         lead:b2b_leads(id, buyer_name, company_name, platform)`
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Fetch creator profile manually since created_by references auth.users(id) rather than profiles(id)
    if (data.created_by) {
      const { data: creatorProfile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("user_id", data.created_by)
        .maybeSingle();
      data.creator = creatorProfile;
    } else {
      data.creator = null;
    }

    // Fetch child proforma if exists
    const { data: childProforma } = await supabase
      .from("proformas")
      .select(`
        id, proforma_no, company_name, grand_total, status, entry_date,
        sales_register:sales_registers(id, sales_register_no, status)
      `)
      .eq("parent_quotation_id", data.id)
      .is("deleted_at", null)
      .maybeSingle();
    data.proforma = childProforma || null;

    // Fetch company details from company_settings
    if (data.account_id) {
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select(`
          logo_url, company_name, tagline, address, city, state, country, pincode,
          phone, alternate_phone, email, website, gst_number,
          bank_account_name, bank_account_type, bank_account_number, bank_name, bank_ifsc,
          manager_name, manager_designation, signature_url,
          terms_and_conditions, quotation_terms_text, contact_numbers, email_details, jurisdiction
        `)
        .eq("account_id", data.account_id)
        .maybeSingle();
      data.company_details = companySettings || null;
      data.company_logo_url = companySettings?.logo_url || null;

      // Fallback manager details if not snapshotted on the quotation itself
      if (!data.manager_name) {
        data.manager_name = companySettings?.manager_name || "Darshan Ladi";
      }
      if (!data.manager_designation) {
        data.manager_designation = companySettings?.manager_designation || "Manager";
      }
    } else {
      data.company_details = null;
      data.company_logo_url = null;
    }

    // Sort items by position
    if (data.items) {
      data.items.sort((a: { position: number }, b: { position: number }) => a.position - b.position);
    }

    return NextResponse.json({ quotation: data });
  } catch (err) {
    console.error("[GET /api/quotations/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch quotation" }, { status: 500 });
  }
}

// PATCH /api/quotations/[id] — update quotation
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Permission: quotation.edit OR sales.view
    const { data: hpe } = await supabase.rpc("has_permission", { p_module: "quotation", p_action: "edit" });
    const { data: hle } = await supabase.rpc("has_permission", { p_module: "sales", p_action: "view" });
    if (!hpe && !hle) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { items, terms_text, ...quotationData } = body;

    // Fetch old status for history
    const { data: existing } = await supabase
      .from("quotations")
      .select("status, account_id, lead_id")
      .eq("id", id)
      .maybeSingle();

    const { data: quotation, error: qErr } = await supabase
      .from("quotations")
      .update({ ...quotationData, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (qErr) throw qErr;

    // Status history if status changed
    if (existing && quotationData.status && quotationData.status !== existing.status) {
      await supabase.from("quotation_status_history").insert({
        quotation_id: id,
        old_status: existing.status,
        new_status: quotationData.status,
        changed_by: user.id,
      });

      // Trigger quotation accepted automation
      if (quotationData.status === "accepted" && existing.lead_id) {
        await handleDocumentAutomation(supabase, existing.account_id, existing.lead_id, "QUOTATION_APPROVED");
      }
    }

    // Replace items if provided
    if (Array.isArray(items)) {
      await supabase.from("quotation_items").delete().eq("quotation_id", id);
      if (items.length > 0) {
        await supabase.from("quotation_items").insert(
          items.map((item: Record<string, unknown>, idx: number) => ({
            ...item,
            id: undefined,       // let DB assign new id
            quotation_id: id,
            position: idx,
          }))
        );
      }
    }

    // Update terms if provided
    if (typeof terms_text === "string") {
      await supabase
        .from("quotation_terms")
        .upsert({ quotation_id: id, terms_text, updated_at: new Date().toISOString() },
          { onConflict: "quotation_id" });
    }

    return NextResponse.json({ quotation });
  } catch (err) {
    console.error("[PATCH /api/quotations/[id]]", err);
    const msg = err instanceof Error ? err.message : "Failed to update quotation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/quotations/[id] — soft delete
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Permission: quotation.delete (higher privilege)
    const { data: hpd } = await supabase.rpc("has_permission", { p_module: "quotation", p_action: "delete" });
    const { data: hadmin } = await supabase.rpc("has_permission", { p_module: "user_management", p_action: "manage" });
    if (!hpd && !hadmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await supabase
      .from("quotations")
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true, message: "Quotation deleted" });
  } catch (err) {
    console.error("[DELETE /api/quotations/[id]]", err);
    return NextResponse.json({ error: "Failed to delete quotation" }, { status: 500 });
  }
}
