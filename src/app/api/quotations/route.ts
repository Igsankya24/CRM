import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/quotations — list with pagination, search, status filter
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

    // Permission check: quotation.view OR legacy sales.view
    const { data: hasPermView } = await supabase.rpc("has_permission", { p_module: "quotation", p_action: "view" });
    const { data: hasLegacyPerm } = await supabase.rpc("has_permission", { p_module: "sales", p_action: "view" });
    if (!hasPermView && !hasLegacyPerm) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to view quotations" }, { status: 403 });
    }

    const url = req.nextUrl;
    const page   = Math.max(1, parseInt(url.searchParams.get("page")   ?? "1"));
    const limit  = Math.min(100, parseInt(url.searchParams.get("limit") ?? "20"));
    const search = url.searchParams.get("search") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const sortBy = url.searchParams.get("sortBy") ?? "entry_date";
    const sortDir= url.searchParams.get("sortDir") === "asc" ? true : false;

    let query = supabase
      .from("quotations")
      .select(
        `*,
         lead:b2b_leads(id, buyer_name, company_name, platform),
         items:quotation_items(*)`,
        { count: "exact" }
      )
      .eq("account_id", profile.account_id)
      .is("deleted_at", null);

    if (search) {
      query = query.or(
        `quotation_no.ilike.%${search}%,company_name.ilike.%${search}%,contact_person.ilike.%${search}%,mobile.ilike.%${search}%`
      );
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const allowedSort: Record<string, string> = {
      entry_date: "entry_date",
      quotation_no: "quotation_no",
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

    // Hydrate creator profiles manually since created_by references auth.users(id)
    if (data && data.length > 0) {
      const userIds = Array.from(new Set(data.map((q) => q.created_by).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        
        const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
        data.forEach((q) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (q as any).creator = q.created_by ? (profileMap.get(q.created_by) ?? null) : null;
        });
      }
    }

    return NextResponse.json({
      quotations: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("[GET /api/quotations]", err);
    return NextResponse.json({ error: "Failed to fetch quotations" }, { status: 500 });
  }
}

// POST /api/quotations — create new quotation
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

    // Permission check: quotation.create OR legacy sales.view
    const { data: hasPermCreate } = await supabase.rpc("has_permission", { p_module: "quotation", p_action: "create" });
    const { data: hasLegacyPerm } = await supabase.rpc("has_permission", { p_module: "sales", p_action: "view" });
    if (!hasPermCreate && !hasLegacyPerm) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to create quotations" }, { status: 403 });
    }

    const body = await req.json();
    const { items = [], terms_text = "", ...quotationData } = body;

    // Check for duplicate lead_id
    if (quotationData.lead_id) {
      const { data: existingQ, error: checkErr } = await supabase
        .from("quotations")
        .select("id, quotation_no")
        .eq("lead_id", quotationData.lead_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (checkErr) throw checkErr;
      if (existingQ) {
        return NextResponse.json(
          { error: "A quotation has already been generated for this lead. Duplicate quotation found." },
          { status: 400 }
        );
      }
    }

    // Generate quotation number
    const { data: qnoData, error: qnoErr } = await supabase
      .rpc("next_quotation_no", { p_account_id: profile.account_id });
    if (qnoErr) throw qnoErr;
    const quotationNo: string = qnoData as string;

    // Insert quotation
    const { data: quotation, error: qErr } = await supabase
      .from("quotations")
      .insert({
        ...quotationData,
        account_id: profile.account_id,
        quotation_no: quotationNo,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();
    if (qErr) throw qErr;

    // Insert items
    if (items.length > 0) {
      const { error: itemErr } = await supabase
        .from("quotation_items")
        .insert(
          items.map((item: Record<string, unknown>, idx: number) => ({
            ...item,
            quotation_id: quotation.id,
            position: idx,
          }))
        );
      if (itemErr) throw itemErr;
    }

    // Insert terms snapshot
    const { error: termErr } = await supabase
      .from("quotation_terms")
      .insert({ quotation_id: quotation.id, terms_text });
    if (termErr) throw termErr;

    // Insert initial status history
    await supabase.from("quotation_status_history").insert({
      quotation_id: quotation.id,
      old_status: null,
      new_status: quotation.status,
      changed_by: user.id,
      note: "Quotation created",
    });

    return NextResponse.json({ quotation }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/quotations]", err);
    const msg = err instanceof Error ? err.message : "Failed to create quotation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
