import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Permission check: proforma.convert
    const { data: hasPerm } = await supabase.rpc("has_permission", { p_module: "proforma", p_action: "convert" });
    if (!hasPerm) return NextResponse.json({ error: "Forbidden: You do not have permission to convert proformas" }, { status: 403 });

    // 1. Fetch source proforma with items, terms, and attachments
    const { data: proforma, error: pErr } = await supabase
      .from("proformas")
      .select(`
        *,
        items:proforma_items(*),
        terms:proforma_terms(*),
        attachments:proforma_attachments(*)
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!proforma) return NextResponse.json({ error: "Proforma not found" }, { status: 404 });

    // Check if proforma has already been converted to a sales register
    const { data: existingSalesRegister, error: checkErr } = await supabase
      .from("sales_registers")
      .select("id, sales_register_no")
      .eq("parent_proforma_id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (checkErr) throw checkErr;
    if (existingSalesRegister) {
      return NextResponse.json(
        { error: `This proforma has already been converted to Sales Register ${existingSalesRegister.sales_register_no}` },
        { status: 400 }
      );
    }

    // Check if the lead already has a sales register
    if (proforma.lead_id) {
      const { data: dupSR, error: dupSRErr } = await supabase
        .from("sales_registers")
        .select("id, sales_register_no")
        .eq("lead_id", proforma.lead_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (dupSRErr) throw dupSRErr;
      if (dupSR) {
        return NextResponse.json(
          { error: "A sales register has already been generated for this lead. Duplicate invoice found." },
          { status: 400 }
        );
      }
    }

    // 2. Generate new SR Number
    const { data: srNo, error: noErr } = await supabase.rpc("next_sales_register_no", { p_account_id: proforma.account_id });
    if (noErr) throw noErr;

    // 3. Create Sales Register
    const { data: salesRegister, error: srErr } = await supabase
      .from("sales_registers")
      .insert({
        account_id: proforma.account_id,
        sales_register_no: srNo,
        parent_proforma_id: proforma.id,
        entry_date: new Date().toISOString().split("T")[0],
        company_name: proforma.company_name,
        kind_attention: proforma.kind_attention,
        contact_person: proforma.contact_person,
        email: proforma.email,
        mobile: proforma.mobile,
        alt_mobile: proforma.alt_mobile,
        address: proforma.address,
        state: proforma.state,
        pincode: proforma.pincode,
        gst_no: proforma.gst_no,
        source: proforma.source,
        subject: proforma.subject,
        basic_total: proforma.basic_total,
        tax_type: proforma.tax_type,
        custom_tax_rate: proforma.custom_tax_rate,
        tax_amount: proforma.tax_amount,
        grand_total: proforma.grand_total,
        amount_words: proforma.amount_words,
        status: "pending",
        bank_account_name: proforma.bank_account_name,
        bank_account_type: proforma.bank_account_type,
        bank_account_number: proforma.bank_account_number,
        bank_name: proforma.bank_name,
        bank_ifsc: proforma.bank_ifsc,
        manager_name: proforma.manager_name,
        manager_designation: proforma.manager_designation,
        lead_id: proforma.lead_id,
        valid_until: proforma.valid_until,
        transportation_charges: proforma.transportation_charges || 0,
        packing_charges: proforma.packing_charges || 0,
        other_charges: proforma.other_charges || 0,
        reference_number: proforma.reference_number,
        notes: proforma.notes,
        approval_status: proforma.approval_status || "pending",
        document_type: "sales_register",
        document_relationships: [
          ...(proforma.document_relationships || []),
          {
            type: "parent_proforma",
            id: proforma.id,
            number: proforma.proforma_no,
            date: proforma.entry_date,
          }
        ],
        audit_history: [
          ...(proforma.audit_history || []),
          {
            timestamp: new Date().toISOString(),
            user_id: user.id,
            action: "convert_from_proforma",
            details: `Converted from Proforma Invoice ${proforma.proforma_no}`
          }
        ],
        conversion_history: [
          ...(proforma.conversion_history || []),
          {
            timestamp: new Date().toISOString(),
            from: "proforma",
            from_id: proforma.id,
            to: "sales_register",
            by: user.id
          }
        ],
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (srErr) throw srErr;

    // 4. Copy Items
    if (proforma.items && proforma.items.length > 0) {
      const itemsPayload = proforma.items.map((it: any) => ({
        sales_register_id: salesRegister.id,
        position: it.position,
        product_name: it.product_name,
        description: it.description,
        hsn_code: it.hsn_code,
        uom: it.uom,
        rate: it.rate,
        quantity: it.quantity,
        image_url: it.image_url,
      }));
      const { error: itemsErr } = await supabase.from("sales_register_items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;
    }

    // 5. Fetch and insert sales register terms from company settings
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("sales_register_terms_text")
      .eq("account_id", proforma.account_id)
      .maybeSingle();

    const salesTerms = companySettings?.sales_register_terms_text || "";

    const { error: termsErr } = await supabase
      .from("sales_register_terms")
      .insert({
        sales_register_id: salesRegister.id,
        terms_text: salesTerms,
      });
    if (termsErr) throw termsErr;

    // 6. Copy Attachments
    if (proforma.attachments && proforma.attachments.length > 0) {
      const attachmentsPayload = proforma.attachments.map((at: any) => ({
        sales_register_id: salesRegister.id,
        file_name: at.file_name,
        file_url: at.file_url,
        mime_type: at.mime_type,
        size_bytes: at.size_bytes,
        uploaded_by: user.id,
      }));
      const { error: attachErr } = await supabase.from("sales_register_attachments").insert(attachmentsPayload);
      if (attachErr) throw attachErr;
    }

    // 7. Write Status History
    await supabase.from("sales_register_status_history").insert({
      sales_register_id: salesRegister.id,
      old_status: null,
      new_status: "pending",
      changed_by: user.id,
      note: `Converted from Proforma Invoice ${proforma.proforma_no}`,
    });

    return NextResponse.json({ salesRegister, sales_register: salesRegister }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proformas/[id]/convert]", err);
    const msg = err instanceof Error ? err.message : "Failed to convert proforma";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
