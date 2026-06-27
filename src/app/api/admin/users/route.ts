import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminClient, adminDb } from "@/lib/supabase/admin";
import { toErrorResponse } from "@/lib/auth/account";
import type { Database } from "@/types/database.types";

type AccountRole = Database["public"]["Enums"]["account_role_enum"];

/**
 * Map RBAC role names to standard legacy account_role
 */
function mapRbacRoleToAccountRole(roleNames: string[]): AccountRole {
  if (roleNames.includes("Super Admin") || roleNames.includes("Admin")) {
    return "admin";
  }
  return "agent"; // Sales and all others map to agent
}

export async function GET() {
  try {
    const ctx = await requirePermission("user_management", "view");
    const adminClient = getAdminClient();

    // 1. Fetch system roles first for sync and UI usage
    const { data: systemRoles, error: rError } = await adminDb
      .from("roles")
      .select("*")
      .order("name");

    if (rError) throw rError;

    // 2. Fetch all auth users to check for missing profiles
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers();
    if (authError) throw authError;
    const authUsers = authData.users || [];

    // 3. Fetch all profiles to find any missing profiles across all auth users
    const { data: allProfiles, error: allPError } = await adminDb
      .from("profiles")
      .select("*");
    if (allPError) throw allPError;

    // 4. Synchronize profiles for any auth users that do not have one
    for (const authUser of authUsers) {
      const hasProfile = (allProfiles || []).some((p) => p.user_id === authUser.id);
      if (!hasProfile) {
        const full_name = authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Unknown User";
        const email = authUser.email || "";
        const accountRole = email === "sanket@auto.com" ? "owner" : "agent";

        const { data: newProfile, error: insError } = await adminDb
          .from("profiles")
          .insert({
            user_id: authUser.id,
            full_name,
            email,
            account_id: ctx.accountId,
            account_role: accountRole,
            is_active: true,
            mobile: authUser.phone || "",
            department: "Sales Department",
            designation: "Agent",
          })
          .select()
          .single();

        if (insError) {
          console.error("Auto profile creation failed for user:", authUser.email, insError);
        } else if (newProfile && allProfiles) {
          allProfiles.push(newProfile);
        }
      }
    }

    // 5. Fetch all profiles for the current account
    const { data: profiles, error: pError } = await adminDb
      .from("profiles")
      .select("*")
      .eq("account_id", ctx.accountId);

    if (pError) throw pError;
    const currentProfiles = profiles || [];

    const profileUserIds = currentProfiles.map((p) => p.user_id);

    // 6. Fetch user_roles for the current account's users
    const { data: userRoles, error: urError } = await adminDb
      .from("user_roles")
      .select("*")
      .in("user_id", profileUserIds);

    if (urError) throw urError;
    const currentUserRoles = userRoles || [];

    // 7. Auto-assign role mapping if any profile has no role mapped in user_roles
    for (const profile of currentProfiles) {
      const hasRoleMapping = currentUserRoles.some((ur) => ur.user_id === profile.user_id);
      if (!hasRoleMapping) {
        let targetRoleName = "Viewer";
        if (profile.account_role === "owner") {
          targetRoleName = "Super Admin";
        } else if (profile.account_role === "admin") {
          targetRoleName = "Admin";
        } else if (profile.account_role === "agent") {
          targetRoleName = "Sales";
        }

        const targetRole = (systemRoles || []).find((r) => r.name === targetRoleName);
        if (targetRole) {
          const { data: newUr, error: insUrError } = await adminDb
            .from("user_roles")
            .insert({
              user_id: profile.user_id,
              role_id: targetRole.id,
            })
            .select()
            .single();

          if (insUrError) {
            console.error("Auto role assignment failed for user:", profile.email, insUrError);
          } else if (newUr) {
            currentUserRoles.push(newUr);
          }
        }
      }
    }

    // 8. Fetch user_roles with roles details joined properly (direct foreign key roles -> user_roles)
    const { data: userRolesWithDetails, error: urDetailsError } = await adminDb
      .from("user_roles")
      .select(`
        user_id,
        role_id,
        role:roles (
          id,
          name,
          description
        )
      `)
      .in("user_id", profileUserIds);

    if (urDetailsError) throw urDetailsError;

    interface UserRoleWithDetail {
      user_id: string;
      role_id: string;
      role: {
        id: string;
        name: string;
        description: string | null;
      } | {
        id: string;
        name: string;
        description: string | null;
      }[] | null;
    }

    // 9. Format response payload by joining profiles and roles in JS
    const formattedUsers = currentProfiles.map((user) => {
      const roles = (userRolesWithDetails as unknown as UserRoleWithDetail[] || [])
        .filter((ur) => ur.user_id === user.user_id)
        .map((ur) => ur.role)
        .filter(Boolean);

      return {
        id: user.id,
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        avatar_url: user.avatar_url,
        mobile: user.mobile,
        department: user.department,
        designation: user.designation,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
        roles,
      };
    });

    // Sort users by created_at DESC
    formattedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      users: formattedUsers,
      roles: systemRoles || [],
    });
  } catch (err) {
    console.error("Error in GET /api/admin/users:", err);
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requirePermission("user_management", "create");
    const body = await req.json();

    const {
      email,
      password,
      full_name,
      mobile,
      department,
      designation,
      role_ids = [],
      module_permissions = [], // "module:action" strings e.g. ["enquiries:view", "quotation:view"]
    } = body;

    if (!email || !full_name) {
      return NextResponse.json(
        { error: "Email and full name are required" },
        { status: 400 }
      );
    }

    // 1. Fetch the roles to map the account_role and check they exist
    const { data: roles, error: rError } = await adminDb
      .from("roles")
      .select("id, name")
      .in("id", role_ids);

    if (rError) throw rError;

    const roleNames = (roles || []).map((r) => r.name);
    const accountRole = mapRbacRoleToAccountRole(roleNames);

    // 2. Create the user in Supabase Auth via Admin Client
    const adminClient = getAdminClient();
    const { data: authData, error: createAuthError } =
      await adminClient.auth.admin.createUser({
        email,
        password: password || Math.random().toString(36).slice(-12), // auto-generate if not provided
        email_confirm: true,
        user_metadata: {
          full_name,
        },
      });

    if (createAuthError) {
      return NextResponse.json(
        { error: createAuthError.message },
        { status: 400 }
      );
    }

    const newUser = authData.user;
    if (!newUser) {
      return NextResponse.json(
        { error: "Failed to create authentication user" },
        { status: 500 }
      );
    }

    // 3. Update the automatically created profile with our metadata
    // Wait for the profile to be created by the trigger.
    // If not created yet, we'll upsert or retry.
    let profileUpdated = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data: existingProfile } = await adminDb
        .from("profiles")
        .select("id")
        .eq("user_id", newUser.id)
        .maybeSingle();

      if (existingProfile) {
        const { error: updateProfileError } = await adminDb
          .from("profiles")
          .update({
            mobile,
            department,
            designation,
            account_id: ctx.accountId,
            account_role: accountRole,
            is_active: true,
          })
          .eq("user_id", newUser.id);

        if (updateProfileError) {
          throw updateProfileError;
        }
        profileUpdated = true;
        break;
      }
      // Wait 100ms before retrying to let trigger execute
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!profileUpdated) {
      // Fallback: Manually insert profile if the trigger failed
      const { error: insertProfileError } = await adminDb
        .from("profiles")
        .insert({
          user_id: newUser.id,
          full_name,
          email,
          mobile,
          department,
          designation,
          account_id: ctx.accountId,
          account_role: accountRole,
          is_active: true,
        });

      if (insertProfileError) {
        throw insertProfileError;
      }
    }

    // 4. Assign Roles in user_roles
    if (role_ids.length > 0) {
      const roleAssignments = role_ids.map((roleId: string) => ({
        user_id: newUser.id,
        role_id: roleId,
      }));

      const { error: roleInsertError } = await adminDb
        .from("user_roles")
        .insert(roleAssignments);

      if (roleInsertError) {
        throw roleInsertError;
      }
    }

    // 5. Grant direct module permissions (user_permissions table)
    if (module_permissions.length > 0) {
      // Resolve permission IDs from the permissions table
      const modActionPairs = (module_permissions as string[]).map((key: string) => {
        const [mod, action] = key.split(":");
        return { module: mod, action };
      });

      // Batch lookup all matching permissions
      const { data: permRows, error: permLookupErr } = await adminDb
        .from("permissions")
        .select("id, module, action");

      if (permLookupErr) throw permLookupErr;

      const permInserts = modActionPairs
        .map(({ module, action }) => {
          const perm = (permRows || []).find(
            (p) => p.module === module && p.action === action
          );
          return perm ? { user_id: newUser.id, permission_id: perm.id } : null;
        })
        .filter((x): x is { user_id: string; permission_id: string } => x !== null);

      if (permInserts.length > 0) {
        const { error: permInsertError } = await adminDb
          .from("user_permissions")
          .insert(permInserts);

        if (permInsertError) {
          console.error("user_permissions insert error:", permInsertError);
          // Non-fatal: log but don't block user creation
        }
      }
    }

    // 6. Log the Audit Action
    await adminDb.rpc("log_audit_action", {
      p_module: "user_management",
      p_action: "create",
      p_new_value: {
        email,
        full_name,
        mobile,
        department,
        designation,
        roles: roleNames,
      },
    });

    return NextResponse.json({
      success: true,
      user_id: newUser.id,
      email: newUser.email,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
