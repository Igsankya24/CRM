import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/quotations/[id]/send-email
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
      .select("account_id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.account_id) return NextResponse.json({ error: "No account" }, { status: 403 });

    const { data: quotation } = await supabase
      .from("quotations")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("company_name, email")
      .eq("account_id", profile.account_id)
      .maybeSingle();

    const body = await req.json().catch(() => ({}));
    const pdfUrl: string | undefined = body.pdf_url;
    const recipientEmail = body.email || quotation.email;

    if (!recipientEmail) {
      return NextResponse.json({ error: "No recipient email address available" }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      // Log as attempted but no email provider configured
      await supabase.from("quotation_logs").insert({
        quotation_id: id,
        channel: "email",
        recipient: recipientEmail,
        status: "failed",
        error: "RESEND_API_KEY not configured",
        sent_by: user.id,
      });
      return NextResponse.json(
        { error: "Email sending is not configured. Please add RESEND_API_KEY to your environment variables." },
        { status: 400 }
      );
    }

    const senderName = companySettings?.company_name || "Phoenix CRM";
    const senderEmail = process.env.RESEND_FROM_EMAIL || "noreply@phoenixcrm.com";
    const subject = `Quotation ${quotation.quotation_no} from ${senderName}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
  <div style="background: #1e293b; padding: 24px; border-radius: 8px 8px 0 0;">
    <h2 style="color: #fff; margin: 0;">${senderName}</h2>
    <p style="color: #94a3b8; margin: 4px 0 0;">Quotation</p>
  </div>
  <div style="padding: 24px; background: #f8fafc; border-radius: 0 0 8px 8px;">
    <p>Dear ${quotation.contact_person || quotation.company_name},</p>
    <p>Thank you for your inquiry. Please find your quotation details below:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr style="background: #e2e8f0;">
        <td style="padding: 10px 14px; font-weight: bold;">Quotation No</td>
        <td style="padding: 10px 14px;">${quotation.quotation_no}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: bold;">Date</td>
        <td style="padding: 10px 14px;">${quotation.entry_date}</td>
      </tr>
      <tr style="background: #e2e8f0;">
        <td style="padding: 10px 14px; font-weight: bold;">Subject</td>
        <td style="padding: 10px 14px;">${quotation.subject || "—"}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: bold; color: #0f4c81;">Grand Total</td>
        <td style="padding: 10px 14px; font-size: 18px; font-weight: bold; color: #0f4c81;">
          ₹${Number(quotation.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </td>
      </tr>
    </table>
    ${pdfUrl ? `<p><a href="${pdfUrl}" style="background: #0f4c81; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">📄 Download PDF Quotation</a></p>` : ""}
    <p>Please review and let us know if you have any questions.</p>
    <p>Best regards,<br>${profile.full_name || senderName}</p>
  </div>
</body>
</html>`;

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [recipientEmail],
        subject,
        html: htmlBody,
      }),
    });

    const resendData = await resendRes.json();
    const emailId = resendData?.id ?? null;
    const sendError = !resendRes.ok ? (resendData?.message ?? "Email send failed") : null;

    await supabase.from("quotation_logs").insert({
      quotation_id: id,
      channel: "email",
      recipient: recipientEmail,
      status: sendError ? "failed" : "sent",
      message_id: emailId,
      error: sendError,
      sent_by: user.id,
    });

    if (!sendError && quotation.status === "draft") {
      await supabase.from("quotations")
        .update({ status: "sent", updated_by: user.id })
        .eq("id", id);
      await supabase.from("quotation_status_history").insert({
        quotation_id: id, old_status: "draft", new_status: "sent",
        changed_by: user.id, note: "Sent via Email",
      });
    }

    if (sendError) return NextResponse.json({ error: sendError }, { status: 400 });
    return NextResponse.json({ success: true, email_id: emailId });
  } catch (err) {
    console.error("[POST /api/quotations/[id]/send-email]", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
