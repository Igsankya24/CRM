import { NextResponse } from "next/server";
import { requirePermission, requireSuperAdmin } from "@/lib/auth/permissions";
import { getAdminClient, adminDb } from "@/lib/supabase/admin";
import { toErrorResponse } from "@/lib/auth/account";
import type { Database } from "@/types/database.types";

type AccountRole = Database["public"]["Enums"]["account_role_enum"];

function mapRbacRoleToAccountRole(roleNames: string[]): AccountRole {
  if (roleNames.includes("Super Admin") || roleNames.includes("Admin")) {
    return "admin";
  }
  if (roleNames.includes("Viewer")) {
    return "viewer";
  }
  return "agent";
}

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    const { id: userId } = await params;
    const ctx = await requirePermission("user_management", "edit");
    const body = await req.json();

    const {
      full_name,
      mobile,
      department,
      designation,
      is_active,
      role_ids,
    } = body;

    // Get the old values for audit logging
    const { data: oldProfileData, error: fetchOldError } = await adminDb
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchOldError || !oldProfileData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Fetch user roles separately to avoid PostgREST relationship mapping cache error
    const { data: userRolesData, error: fetchRolesError } = await adminDb
      .from("user_roles")
      .select("role_id, roles(name)")
      .eq("user_id", userId);

    if (fetchRolesError) throw fetchRolesError;

    const oldProfile = {
      ...oldProfileData,
      user_roles: (userRolesData || []) as unknown as { role_id: string; roles: { name: string } | null }[],
    };

    const adminClient = getAdminClient();

    // 1. Update Auth User if status (is_active) changed or if email/password needs change
    if (is_active !== undefined && is_active !== oldProfile.is_active) {
      const { error: authUpdateError } =
        await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: is_active ? "none" : "876000h", // 100 years ban if deactivated
        });

      if (authUpdateError) {
        return NextResponse.json(
          { error: `Auth status update failed: ${authUpdateError.message}` },
          { status: 400 }
        );
      }
    }

    // 2. Prepare profile updates
    const profileUpdates: Partial<Database["public"]["Tables"]["profiles"]["Update"]> = {};
    if (full_name !== undefined) profileUpdates.full_name = full_name;
    if (mobile !== undefined) profileUpdates.mobile = mobile;
    if (department !== undefined) profileUpdates.department = department;
    if (designation !== undefined) profileUpdates.designation = designation;
    if (is_active !== undefined) profileUpdates.is_active = is_active;

    // 3. Update roles if specified
    let newRoleNames: string[] = [];
    if (role_ids !== undefined) {
      // Fetch role names
      const { data: roles, error: rError } = await adminDb
        .from("roles")
        .select("id, name")
        .in("id", role_ids);

      if (rError) throw rError;

      newRoleNames = (roles || []).map((r) => r.name);
      profileUpdates.account_role = mapRbacRoleToAccountRole(newRoleNames);

      // Remove existing role assignments
      const { error: deleteRolesError } = await adminDb
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (deleteRolesError) throw deleteRolesError;

      // Add new role assignments
      if (role_ids.length > 0) {
        const roleAssignments = role_ids.map((roleId: string) => ({
          user_id: userId,
          role_id: roleId,
        }));

        const { error: insertRolesError } = await adminDb
          .from("user_roles")
          .insert(roleAssignments);

        if (insertRolesError) throw insertRolesError;
      }
    }

    // 4. Update the profile table
    if (Object.keys(profileUpdates).length > 0) {
      // If full_name is updated, also update it in auth.users metadata
      if (full_name !== undefined && full_name !== oldProfile.full_name) {
        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: { full_name },
        });
      }

      const { error: updateProfileError } = await adminDb
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", userId);

      if (updateProfileError) throw updateProfileError;
    }

    // 5. Log the Audit Action
    const oldRoleNames = (oldProfile.user_roles || [])
      .map((ur: { role_id: string; roles: { name: string } | null }) => ur.roles?.name)
      .filter(Boolean);

    await adminDb.rpc("log_audit_action", {
      p_module: "user_management",
      p_action: "edit",
      p_old_value: {
        full_name: oldProfile.full_name,
        mobile: oldProfile.mobile,
        department: oldProfile.department,
        designation: oldProfile.designation,
        is_active: oldProfile.is_active,
        roles: oldRoleNames,
      },
      p_new_value: {
        full_name: full_name !== undefined ? full_name : oldProfile.full_name,
        mobile: mobile !== undefined ? mobile : oldProfile.mobile,
        department: department !== undefined ? department : oldProfile.department,
        designation: designation !== undefined ? designation : oldProfile.designation,
        is_active: is_active !== undefined ? is_active : oldProfile.is_active,
        roles: role_ids !== undefined ? newRoleNames : oldRoleNames,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  const { id: userId } = await params;
  console.log(`[delete-user] Received request to delete user ID: ${userId}`);

  try {
    // Only Super Admin can delete users
    const ctx = await requireSuperAdmin();
    console.log(`[delete-user] Authorized caller (Super Admin): ${ctx.userId}, account: ${ctx.accountId}`);

    // Fetch the target user's profile to check details
    const { data: profile, error: fetchError } = await adminDb
      .from("profiles")
      .select("email, full_name, account_id, account_role")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error(`[delete-user] Error fetching profile for user ${userId}:`, fetchError);
      return NextResponse.json(
        { success: false, error: `Failed to fetch profile: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!profile) {
      console.warn(`[delete-user] User profile not found for ID: ${userId}`);
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    console.log(`[delete-user] Found target user: ${profile.full_name} (${profile.email}), role: ${profile.account_role}, account: ${profile.account_id}`);

    // Step 8: Protect Default Super Admin
    if (profile.email?.toLowerCase() === "sanket@auto.com") {
      console.warn(`[delete-user] Blocked deletion attempt on Default Super Admin: ${profile.email}`);
      return NextResponse.json(
        { success: false, error: "Default Super Admin cannot be deleted." },
        { status: 400 }
      );
    }

    // Step 5: Protect active account owner of caller's account
    if (profile.account_id === ctx.accountId && profile.account_role === "owner") {
      console.warn(`[delete-user] Blocked deletion attempt on account owner of active account: ${profile.email}`);
      return NextResponse.json(
        { success: false, error: "Cannot delete the account owner. Please transfer ownership first." },
        { status: 400 }
      );
    }

    // Step 5: Check foreign key constraints and delete accounts owned by the user (except current account)
    // to resolve ON DELETE RESTRICT on accounts.owner_user_id
    console.log(`[delete-user] Deleting accounts owned by user ${userId} (excluding current account ${ctx.accountId})...`);
    const { data: deletedAccs, error: accDeleteError } = await adminDb
      .from("accounts")
      .delete()
      .eq("owner_user_id", userId)
      .neq("id", ctx.accountId)
      .select();

    if (accDeleteError) {
      console.error(`[delete-user] Error deleting accounts owned by user ${userId}:`, accDeleteError);
      return NextResponse.json(
        { success: false, error: `Database error while cleaning user accounts: ${accDeleteError.message}` },
        { status: 500 }
      );
    }

    console.log(`[delete-user] Cleaned up ${deletedAccs?.length || 0} owned account(s):`, deletedAccs);

    const adminClient = getAdminClient();
    
    // Delete user from Supabase Auth (cascades to profiles, user_roles, etc.)
    console.log(`[delete-user] Calling Supabase Auth deleteUser for ${userId}...`);
    const { data: authDeleteData, error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error(`[delete-user] Supabase Auth delete failed for user ${userId}:`, deleteError);
      return NextResponse.json(
        { success: false, error: `Auth deletion failed: ${deleteError.message}` },
        { status: 500 }
      );
    }

    console.log(`[delete-user] Supabase Auth delete successful for user ${userId}:`, authDeleteData);

    // Log the Audit Action
    try {
      await adminDb.rpc("log_audit_action", {
        p_module: "user_management",
        p_action: "delete",
        p_old_value: {
          user_id: userId,
          email: profile.email,
          full_name: profile.full_name,
        },
      });
    } catch (auditErr) {
      console.error(`[delete-user] Non-fatal audit log error:`, auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (err) {
    console.error(`[delete-user] Unexpected server error:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error"
      },
      { status: 500 }
    );
  }
}
