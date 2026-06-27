import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleDocumentAutomation } from "@/lib/crm/automations";

// GET /api/sales-registers — list sales registers with pagination, search, status filter
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.account_id) return NextResponse.json({ error: "No account" }, { status: 403 });

    // Permission check: sales.view
    const { data: hasPerm } = await supabase.rpc("has_permission", { p_module: "sales", p_action: "view" });
    if (!hasPerm) return NextResponse.json({ error: "Forbidden: You do not have permission to view sales registers" }, { status: 403 });

    const url = req.nextUrl;
    const page   = Math.max(1, parseInt(url.searchParams.get("page")   ?? "1"));
    const limit  = Math.min(100, parseInt(url.searchParams.get("limit") ?? "20"));
    const search = url.searchParams.get("search") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const sortBy = url.searchParams.get("sortBy") ?? "entry_date";
    const sortDir= url.searchParams.get("sortDir") === "asc" ? true : false;

    let query = supabase
      .from("sales_registers")
      .select(
        `*,
         lead:b2b_leads(id, buyer_name, company_name, platform),
         parent_proforma:proformas(id, proforma_no),
         items:sales_register_items(*)`,
        { count: "exact" }
      )
      .eq("account_id", profile.account_id)
      .is("deleted_at", null);

    if (search) {
      query = query.or(
        `sales_register_no.ilike.%${search}%,company_name.ilike.%${search}%,contact_person.ilike.%${search}%,mobile.ilike.%${search}%`
      );
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const allowedSort: Record<string, string> = {
      entry_date: "entry_date",
      sales_register_no: "sales_register_no",
      company_name: "company_name",
      grand_total: "grand_total",
      status: "status",
      created_at: "created_at",
    };
    const sortCol = allowedSort[sortBy] ?? "entry_date";
    query = query.order(sortCol, { ascending: sortDir });
    query = query.range((page - 1) * limit, page * limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    // Hydrate creators
    if (data && data.length > 0) {
      const userIds = Array.from(new Set(data.map((q) => q.created_by).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        
        const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
        data.forEach((q) => {
          (q as any).creator = q.created_by ? (profileMap.get(q.created_by) ?? null) : null;
        });
      }
    }

    return NextResponse.json({
      salesRegisters: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("[GET /api/sales-registers]", err);
    return NextResponse.json({ error: "Failed to fetch sales registers" }, { status: 500 });
  }
}

// POST /api/sales-registers — create new sales register
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.account_id) return NextResponse.json({ error: "No account" }, { status: 403 });

    // Permission check: sales.create
    const { data: hasPerm } = await supabase.rpc("has_permission", { p_module: "sales", p_action: "create" });
    if (!hasPerm) return NextResponse.json({ error: "Forbidden: You do not have permission to create sales registers" }, { status: 403 });

    const body = await req.json();
    const { items = [], terms_text = "", ...salesRegisterData } = body;

    // Check for duplicate lead_id
    if (salesRegisterData.lead_id) {
      const { data: existingSR, error: checkErr } = await supabase
        .from("sales_registers")
        .select("id, sales_register_no")
        .eq("lead_id", salesRegisterData.lead_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (checkErr) throw checkErr;
      if (existingSR) {
        return NextResponse.json(
          { error: "A sales register has already been generated for this lead. Duplicate invoice found." },
          { status: 400 }
        );
      }
    }

    // Generate sales register number
    const { data: srNo, error: noErr } = await supabase
      .rpc("next_sales_register_no", { p_account_id: profile.account_id });
    if (noErr) throw noErr;

    // Insert sales register
    const { data: salesRegister, error: srErr } = await supabase
      .from("sales_registers")
      .insert({
        ...salesRegisterData,
        account_id: profile.account_id,
        sales_register_no: srNo,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();
    if (srErr) throw srErr;

    // Insert items
    if (items.length > 0) {
      const { error: itemErr } = await supabase
        .from("sales_register_items")
        .insert(
          items.map((item: Record<string, unknown>, idx: number) => ({
            ...item,
            sales_register_id: salesRegister.id,
            position: idx,
          }))
        );
      if (itemErr) throw itemErr;
    }

    // Insert terms
    const { error: termErr } = await supabase
      .from("sales_register_terms")
      .insert({ sales_register_id: salesRegister.id, terms_text });
    if (termErr) throw termErr;

    // Status history
    await supabase.from("sales_register_status_history").insert({
      sales_register_id: salesRegister.id,
      old_status: null,
      new_status: salesRegister.status,
      changed_by: user.id,
      note: "Sales Register created",
    });

    // Trigger INVOICE_GENERATED automation
    if (salesRegister.lead_id) {
      await handleDocumentAutomation(supabase, profile.account_id, salesRegister.lead_id, "INVOICE_GENERATED");
    }

    return NextResponse.json({ salesRegister, sales_register: salesRegister }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/sales-registers]", err);
    const msg = err instanceof Error ? err.message : "Failed to create sales register";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
