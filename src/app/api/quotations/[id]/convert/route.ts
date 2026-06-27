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

    // Permission: quotation.convert
    const { data: hasPerm } = await supabase.rpc("has_permission", { p_module: "quotation", p_action: "convert" });
    if (!hasPerm) return NextResponse.json({ error: "Forbidden: You do not have permission to convert quotations" }, { status: 403 });

    // 1. Fetch source quotation with items, terms, and attachments
    const { data: quotation, error: qErr } = await supabase
      .from("quotations")
      .select(`
        *,
        items:quotation_items(*),
        terms:quotation_terms(*),
        attachments:quotation_attachments(*)
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (qErr) throw qErr;
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

    // Check if quotation has already been converted to a proforma
    const { data: existingProforma, error: checkErr } = await supabase
      .from("proformas")
      .select("id, proforma_no")
      .eq("parent_quotation_id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (checkErr) throw checkErr;
    if (existingProforma) {
      return NextResponse.json(
        { error: `This quotation has already been converted to Proforma Invoice ${existingProforma.proforma_no}` },
        { status: 400 }
      );
    }

    // Check if the lead already has a proforma invoice
    if (quotation.lead_id) {
      const { data: dupPI, error: dupPIErr } = await supabase
        .from("proformas")
        .select("id, proforma_no")
        .eq("lead_id", quotation.lead_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (dupPIErr) throw dupPIErr;
      if (dupPI) {
        return NextResponse.json(
          { error: "A proforma invoice has already been generated for this lead. Duplicate invoice found." },
          { status: 400 }
        );
      }
    }

    // 2. Generate new PI Number
    const { data: piNo, error: noErr } = await supabase.rpc("next_proforma_no", { p_account_id: quotation.account_id });
    if (noErr) throw noErr;

    // 3. Create Proforma Invoice
    const { data: proforma, error: pErr } = await supabase
      .from("proformas")
      .insert({
        account_id: quotation.account_id,
        proforma_no: piNo,
        parent_quotation_id: quotation.id,
        entry_date: new Date().toISOString().split("T")[0],
        company_name: quotation.company_name,
        kind_attention: quotation.kind_attention,
        contact_person: quotation.contact_person,
        email: quotation.email,
        mobile: quotation.mobile,
        alt_mobile: quotation.alt_mobile,
        address: quotation.address,
        state: quotation.state,
        pincode: quotation.pincode,
        gst_no: quotation.gst_no,
        source: quotation.source,
        subject: quotation.subject,
        basic_total: quotation.basic_total,
        tax_type: quotation.tax_type,
        custom_tax_rate: quotation.custom_tax_rate,
        tax_amount: quotation.tax_amount,
        grand_total: quotation.grand_total,
        amount_words: quotation.amount_words,
        status: "draft",
        bank_account_name: quotation.bank_account_name,
        bank_account_type: quotation.bank_account_type,
        bank_account_number: quotation.bank_account_number,
        bank_name: quotation.bank_name,
        bank_ifsc: quotation.bank_ifsc,
        manager_name: quotation.manager_name,
        manager_designation: quotation.manager_designation,
        lead_id: quotation.lead_id,
        valid_until: quotation.valid_until,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (pErr) throw pErr;

    // 4. Copy Items
    if (quotation.items && quotation.items.length > 0) {
      const itemsPayload = quotation.items.map((it: any) => ({
        proforma_id: proforma.id,
        position: it.position,
        product_name: it.product_name,
        description: it.description,
        hsn_code: it.hsn_code,
        uom: it.uom,
        rate: it.rate,
        quantity: it.quantity,
        image_url: it.image_url,
      }));
      const { error: itemsErr } = await supabase.from("proforma_items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;
    }

    // 5. Fetch and insert proforma terms from company settings
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("proforma_terms_text")
      .eq("account_id", quotation.account_id)
      .maybeSingle();

    const proformaTerms = companySettings?.proforma_terms_text || "";

    const { error: termsErr } = await supabase
      .from("proforma_terms")
      .insert({
        proforma_id: proforma.id,
        terms_text: proformaTerms,
      });
    if (termsErr) throw termsErr;

    // 6. Copy Attachments
    if (quotation.attachments && quotation.attachments.length > 0) {
      const attachmentsPayload = quotation.attachments.map((at: any) => ({
        proforma_id: proforma.id,
        file_name: at.file_name,
        file_url: at.file_url,
        mime_type: at.mime_type,
        size_bytes: at.size_bytes,
        uploaded_by: user.id,
      }));
      const { error: attachErr } = await supabase.from("proforma_attachments").insert(attachmentsPayload);
      if (attachErr) throw attachErr;
    }

    // 7. Write Status History
    await supabase.from("proforma_status_history").insert({
      proforma_id: proforma.id,
      old_status: null,
      new_status: "draft",
      changed_by: user.id,
      note: `Converted from Quotation ${quotation.quotation_no}`,
    });

    return NextResponse.json({ proforma }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/quotations/[id]/convert]", err);
    const msg = err instanceof Error ? err.message : "Failed to convert quotation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
