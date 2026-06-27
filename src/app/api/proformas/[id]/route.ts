import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/proformas/[id] — fetch single proforma with items, terms, logs, parent quotation
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Permission check: proforma.view
    const { data: hasPerm } = await supabase.rpc("has_permission", { p_module: "proforma", p_action: "view" });
    if (!hasPerm) return NextResponse.json({ error: "Forbidden: You do not have permission to view proformas" }, { status: 403 });

    const { data, error } = await supabase
      .from("proformas")
      .select(`
        *,
        items:proforma_items(*),
        terms:proforma_terms(*),
        logs:proforma_logs(*),
        lead:b2b_leads(id, buyer_name, company_name, platform),
        parent_quotation:quotations(id, quotation_no, company_name, grand_total, status, entry_date)
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Fetch creator profile
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

    // Fetch child sales register if exists
    const { data: childSR } = await supabase
      .from("sales_registers")
      .select("id, sales_register_no, company_name, grand_total, status, entry_date")
      .eq("parent_proforma_id", data.id)
      .is("deleted_at", null)
      .maybeSingle();
    data.sales_register = childSR || null;

    // Fetch company settings details
    if (data.account_id) {
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select(`
          logo_url, company_name, tagline, address, city, state, country, pincode,
          phone, alternate_phone, email, website, gst_number,
          bank_account_name, bank_account_type, bank_account_number, bank_name, bank_ifsc,
          manager_name, manager_designation, signature_url,
          proforma_terms_text, contact_numbers, email_details, jurisdiction
        `)
        .eq("account_id", data.account_id)
        .maybeSingle();
      data.company_details = companySettings || null;
      data.company_logo_url = companySettings?.logo_url || null;

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

    return NextResponse.json({ proforma: data });
  } catch (err) {
    console.error("[GET /api/proformas/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch proforma" }, { status: 500 });
  }
}

// PATCH /api/proformas/[id] — update proforma
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Permission check: proforma.edit
    const { data: hasPerm } = await supabase.rpc("has_permission", { p_module: "proforma", p_action: "edit" });
    if (!hasPerm) return NextResponse.json({ error: "Forbidden: You do not have permission to edit proformas" }, { status: 403 });

    const body = await req.json();
    const { items, terms_text, ...proformaData } = body;

    // Fetch old status for history
    const { data: existing } = await supabase
      .from("proformas")
      .select("status")
      .eq("id", id)
      .maybeSingle();

    const { data: proforma, error: pErr } = await supabase
      .from("proformas")
      .update({ ...proformaData, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (pErr) throw pErr;

    // Record status history if changed
    if (existing && proformaData.status && proformaData.status !== existing.status) {
      await supabase.from("proforma_status_history").insert({
        proforma_id: id,
        old_status: existing.status,
        new_status: proformaData.status,
        changed_by: user.id,
      });
    }

    // Replace items if provided
    if (Array.isArray(items)) {
      await supabase.from("proforma_items").delete().eq("proforma_id", id);
      if (items.length > 0) {
        await supabase.from("proforma_items").insert(
          items.map((item: Record<string, unknown>, idx: number) => ({
            ...item,
            id: undefined,
            proforma_id: id,
            position: idx,
          }))
        );
      }
    }

    // Update terms if provided
    if (typeof terms_text === "string") {
      await supabase
        .from("proforma_terms")
        .upsert({ proforma_id: id, terms_text, updated_at: new Date().toISOString() }, { onConflict: "proforma_id" });
    }

    return NextResponse.json({ proforma });
  } catch (err) {
    console.error("[PATCH /api/proformas/[id]]", err);
    const msg = err instanceof Error ? err.message : "Failed to update proforma";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/proformas/[id] — soft delete proforma
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Permission check: proforma.delete
    const { data: hasPerm } = await supabase.rpc("has_permission", { p_module: "proforma", p_action: "delete" });
    if (!hasPerm) return NextResponse.json({ error: "Forbidden: You do not have permission to delete proformas" }, { status: 403 });

    const { error } = await supabase
      .from("proformas")
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true, message: "Proforma deleted" });
  } catch (err) {
    console.error("[DELETE /api/proformas/[id]]", err);
    return NextResponse.json({ error: "Failed to delete proforma" }, { status: 500 });
  }
}
