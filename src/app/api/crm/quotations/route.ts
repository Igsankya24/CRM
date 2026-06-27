// ============================================================
// CRM Quotations API
// GET  /api/crm/quotations         — List quotations
// POST /api/crm/quotations         — Create a new quotation
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createActivity } from '@/lib/crm/crm-lifecycle';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const lead_id = searchParams.get('lead_id');

  let query = supabase
    .from('crm_quotations')
    .select('*')
    .eq('account_id', profile.account_id)
    .order('created_at', { ascending: false });

  if (lead_id) query = query.eq('crm_lead_id', lead_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch items for each quotation
  const quotations = [];
  for (const q of data || []) {
    const { data: items } = await supabase
      .from('crm_quotation_items')
      .select('*')
      .eq('quotation_id', q.id)
      .order('position', { ascending: true });
    quotations.push({ ...q, items: items || [] });
  }

  return NextResponse.json({ quotations });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, account_id')
    .eq('user_id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const body = await request.json();

  if (!body.crm_lead_id) {
    return NextResponse.json({ error: 'crm_lead_id is required' }, { status: 400 });
  }

  // Calculate totals
  const items = body.items || [];
  const subtotal = items.reduce(
    (sum: number, item: { quantity: number; unit_price: number }) =>
      sum + (item.quantity || 0) * (item.unit_price || 0),
    0,
  );
  const discountPercent = body.discount_percent || 0;
  const discountAmount = (subtotal * discountPercent) / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxPercent = body.tax_percent || 0;
  const taxAmount = (afterDiscount * taxPercent) / 100;
  const total = afterDiscount + taxAmount;

  // Create quotation
  const { data: quotation, error: qError } = await supabase
    .from('crm_quotations')
    .insert({
      account_id: profile.account_id,
      crm_lead_id: body.crm_lead_id,
      quotation_number: body.quotation_number || null,
      status: 'DRAFT',
      subtotal,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      total,
      currency: body.currency || 'INR',
      valid_until: body.valid_until || null,
      notes: body.notes || null,
      terms_conditions: body.terms_conditions || null,
      created_by: profile.id,
    })
    .select()
    .single();

  if (qError) return NextResponse.json({ error: qError.message }, { status: 500 });

  // Create line items
  if (items.length > 0) {
    const itemRows = items.map(
      (
        item: {
          product_name: string;
          description: string;
          quantity: number;
          unit: string;
          unit_price: number;
        },
        index: number,
      ) => ({
        quotation_id: quotation.id,
        product_name: item.product_name,
        description: item.description || null,
        quantity: item.quantity || 1,
        unit: item.unit || 'pcs',
        unit_price: item.unit_price || 0,
        total: (item.quantity || 1) * (item.unit_price || 0),
        position: index,
      }),
    );

    await supabase.from('crm_quotation_items').insert(itemRows);
  }

  // Create activity
  await createActivity(supabase, profile.account_id, {
    crm_lead_id: body.crm_lead_id,
    activity_type: 'QUOTATION',
    title: `Quotation ${body.quotation_number || ''} created`,
    description: `Total: ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
    metadata: { quotation_id: quotation.id, total },
    performed_by: profile.id,
  });

  return NextResponse.json({ quotation }, { status: 201 });
}
