import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleDocumentAutomation } from "@/lib/crm/automations";

// GET /api/proformas — list proformas with pagination, search, status filter
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

    // Permission check: proforma.view
    const { data: hasPerm } = await supabase.rpc("has_permission", { p_module: "proforma", p_action: "view" });
    if (!hasPerm) return NextResponse.json({ error: "Forbidden: You do not have permission to view proformas" }, { status: 403 });

    const url = req.nextUrl;
    const page   = Math.max(1, parseInt(url.searchParams.get("page")   ?? "1"));
    const limit  = Math.min(100, parseInt(url.searchParams.get("limit") ?? "20"));
    const search = url.searchParams.get("search") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const sortBy = url.searchParams.get("sortBy") ?? "entry_date";
    const sortDir= url.searchParams.get("sortDir") === "asc" ? true : false;

    let query = supabase
      .from("proformas")
      .select(
        `*,
         lead:b2b_leads(id, buyer_name, company_name, platform),
         parent_quotation:quotations(id, quotation_no),
         items:proforma_items(*)`,
        { count: "exact" }
      )
      .eq("account_id", profile.account_id)
      .is("deleted_at", null);

    if (search) {
      query = query.or(
        `proforma_no.ilike.%${search}%,company_name.ilike.%${search}%,contact_person.ilike.%${search}%,mobile.ilike.%${search}%`
      );
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const allowedSort: Record<string, string> = {
      entry_date: "entry_date",
      proforma_no: "proforma_no",
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
      proformas: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("[GET /api/proformas]", err);
    return NextResponse.json({ error: "Failed to fetch proformas" }, { status: 500 });
  }
}

// POST /api/proformas — create new proforma
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

    // Permission check: proforma.create
    const { data: hasPerm } = await supabase.rpc("has_permission", { p_module: "proforma", p_action: "create" });
    if (!hasPerm) return NextResponse.json({ error: "Forbidden: You do not have permission to create proformas" }, { status: 403 });

    const body = await req.json();
    const { items = [], terms_text = "", ...proformaData } = body;

    // Check for duplicate lead_id
    if (proformaData.lead_id) {
      const { data: existingPI, error: checkErr } = await supabase
        .from("proformas")
        .select("id, proforma_no")
        .eq("lead_id", proformaData.lead_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (checkErr) throw checkErr;
      if (existingPI) {
        return NextResponse.json(
          { error: "A proforma invoice has already been generated for this lead. Duplicate invoice found." },
          { status: 400 }
        );
      }
    }

    // Generate proforma number
    const { data: piNo, error: noErr } = await supabase
      .rpc("next_proforma_no", { p_account_id: profile.account_id });
    if (noErr) throw noErr;

    // Insert proforma
    const { data: proforma, error: pErr } = await supabase
      .from("proformas")
      .insert({
        ...proformaData,
        account_id: profile.account_id,
        proforma_no: piNo,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();
    if (pErr) throw pErr;

    // Insert items
    if (items.length > 0) {
      const { error: itemErr } = await supabase
        .from("proforma_items")
        .insert(
          items.map((item: Record<string, unknown>, idx: number) => ({
            ...item,
            proforma_id: proforma.id,
            position: idx,
          }))
        );
      if (itemErr) throw itemErr;
    }

    // Insert terms
    const { error: termErr } = await supabase
      .from("proforma_terms")
      .insert({ proforma_id: proforma.id, terms_text });
    if (termErr) throw termErr;

    // Status history
    await supabase.from("proforma_status_history").insert({
      proforma_id: proforma.id,
      old_status: null,
      new_status: proforma.status,
      changed_by: user.id,
      note: "Proforma Invoice created",
    });

    // Trigger PO_UPLOADED automation
    if (proforma.lead_id) {
      await handleDocumentAutomation(supabase, profile.account_id, proforma.lead_id, "PO_UPLOADED");
    }

    return NextResponse.json({ proforma }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/proformas]", err);
    const msg = err instanceof Error ? err.message : "Failed to create proforma";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
