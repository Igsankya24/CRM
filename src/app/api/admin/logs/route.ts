import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { adminDb } from "@/lib/supabase/admin";
import { toErrorResponse } from "@/lib/auth/account";

export async function GET() {
  try {
    // Check permission to view logs
    await requirePermission("user_management", "view");

    // Fetch the 100 most recent audit logs
    const { data: auditLogs, error: auditError } = await adminDb
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (auditError) throw auditError;

    // Fetch the 100 most recent login logs
    const { data: loginLogs, error: loginError } = await adminDb
      .from("user_login_logs")
      .select("*")
      .order("login_time", { ascending: false })
      .limit(100);

    if (loginError) throw loginError;

    // Gather all unique user IDs to fetch their profiles in a single query
    const userIds = new Set<string>();
    (auditLogs || []).forEach((log) => {
      if (log.user_id) userIds.add(log.user_id);
    });
    (loginLogs || []).forEach((log) => {
      if (log.user_id) userIds.add(log.user_id);
    });

    let profileMap: Record<string, { full_name: string; email: string }> = {};

    if (userIds.size > 0) {
      const { data: profiles, error: profilesError } = await adminDb
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", Array.from(userIds));

      if (profilesError) throw profilesError;

      profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = { full_name: p.full_name, email: p.email };
        return acc;
      }, {} as Record<string, { full_name: string; email: string }>);
    }

    // Map profiles onto logs
    const formattedAuditLogs = (auditLogs || []).map((log) => ({
      ...log,
      user: log.user_id ? profileMap[log.user_id] || { full_name: "Unknown User", email: "" } : { full_name: "System", email: "" },
    }));

    const formattedLoginLogs = (loginLogs || []).map((log) => ({
      ...log,
      user: log.user_id ? profileMap[log.user_id] || { full_name: "Unknown User", email: "" } : null,
    }));

    return NextResponse.json({
      auditLogs: formattedAuditLogs,
      loginLogs: formattedLoginLogs,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
