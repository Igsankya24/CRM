import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/proformas/[id]/send-whatsapp
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.account_id) return NextResponse.json({ error: "No account" }, { status: 403 });

    // Fetch the proforma
    const { data: proforma, error: qErr } = await supabase
      .from("proformas")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (qErr) throw qErr;
    if (!proforma) return NextResponse.json({ error: "Proforma not found" }, { status: 404 });

    // Get WhatsApp config
    const { data: waConfig } = await supabase
      .from("whatsapp_config")
      .select("phone_number_id, access_token, status")
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (!waConfig || waConfig.status !== "connected") {
      return NextResponse.json({ error: "WhatsApp is not connected" }, { status: 400 });
    }

    // Find conversation for this contact's phone number
    const phone = proforma.mobile?.replace(/\D/g, "");
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("account_id", profile.account_id)
      .eq("phone", proforma.mobile)
      .maybeSingle();

    let conversationId: string | null = null;
    if (contact) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("account_id", profile.account_id)
        .eq("contact_id", contact.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      conversationId = conv?.id ?? null;
    }

    // Build message text
    const body = req.body ? await req.json().catch(() => ({})) : {};
    const pdfUrl: string | undefined = body.pdf_url;

    const messageText =
      `*Proforma ${proforma.proforma_no}*\n\n` +
      `Dear ${proforma.contact_person || proforma.company_name},\n\n` +
      `Please find your proforma details:\n` +
      `📋 *Proforma No:* ${proforma.proforma_no}\n` +
      `📅 *Date:* ${proforma.entry_date}\n` +
      `🏢 *Company:* ${proforma.company_name}\n` +
      `💰 *Grand Total:* ₹${Number(proforma.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n\n` +
      (pdfUrl ? `📄 *PDF:* ${pdfUrl}\n\n` : "") +
      `Thank you for your interest. Please feel free to contact us for any queries.`;

    // Send via WhatsApp API
    let waMessageId: string | null = null;
    let sendError: string | null = null;

    try {
      if (conversationId) {
        const sendRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/whatsapp/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationId,
            message_type: "text",
            content_text: messageText,
          }),
        });
        const sendData = await sendRes.json();
        waMessageId = sendData?.message_id ?? null;
        if (!sendRes.ok) sendError = sendData?.error ?? "Send failed";
      } else {
        // Direct API send (no existing conversation)
        const metaRes = await fetch(
          `https://graph.facebook.com/v19.0/${waConfig.phone_number_id}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waConfig.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: phone,
              type: "text",
              text: { body: messageText },
            }),
          }
        );
        const metaData = await metaRes.json();
        waMessageId = metaData?.messages?.[0]?.id ?? null;
        if (!metaRes.ok) sendError = metaData?.error?.message ?? "Meta API error";
      }
    } catch (e) {
      sendError = e instanceof Error ? e.message : "Network error";
    }

    // Log the send
    await supabase.from("proforma_logs").insert({
      proforma_id: id,
      channel: "whatsapp",
      recipient: proforma.mobile,
      status: sendError ? "failed" : "sent",
      message_id: waMessageId,
      error: sendError,
      sent_by: user.id,
    });

    // Update proforma status to 'sent' if it was draft
    if (!sendError && proforma.status === "draft") {
      await supabase
        .from("proformas")
        .update({ status: "sent", updated_by: user.id })
        .eq("id", id);
      await supabase.from("proforma_status_history").insert({
        proforma_id: id,
        old_status: "draft",
        new_status: "sent",
        changed_by: user.id,
        note: "Sent via WhatsApp",
      });
    }

    if (sendError) {
      return NextResponse.json({ error: sendError }, { status: 400 });
    }

    return NextResponse.json({ success: true, message_id: waMessageId });
  } catch (err) {
    console.error("[POST /api/proformas/[id]/send-whatsapp]", err);
    return NextResponse.json({ error: "Failed to send WhatsApp" }, { status: 500 });
  }
}
