import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminClient, adminDb } from "@/lib/supabase/admin";
import { toErrorResponse } from "@/lib/auth/account";

type Params = Promise<{ id: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const { id: userId } = await params;
    const ctx = await requirePermission("user_management", "edit");
    const body = await req.json();

    const { password } = body;

    // Check if the target user profile exists
    const { data: profile, error: fetchError } = await adminDb
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError || !profile) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Generate a temporary password if one was not provided
    const tempPassword = password || Math.random().toString(36).slice(-10) + "A1!";

    const adminClient = getAdminClient();
    
    // Reset the password in Supabase Auth
    const { error: resetError } = await adminClient.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (resetError) {
      return NextResponse.json(
        { error: resetError.message },
        { status: 400 }
      );
    }

    // Log the Audit Action
    await adminDb.rpc("log_audit_action", {
      p_module: "user_management",
      p_action: "reset_password",
      p_new_value: {
        user_id: userId,
        email: profile.email,
        full_name: profile.full_name,
      },
    });

    return NextResponse.json({
      success: true,
      password: tempPassword,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
