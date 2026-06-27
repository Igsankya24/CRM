import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

export function usePermissions() {
  const { user, profile, profileLoading } = useAuth();
  const [permissions, setPermissions] = useState<{ module: string; action: string }[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileLoading || !user) {
      if (!user) {
        Promise.resolve().then(() => {
          setLoading(false);
        });
      }
      return;
    }

    interface RawUserRole {
      role: {
        id: string;
        name: string;
        role_permissions: {
          permission: {
            id: string;
            module: string;
            action: string;
          } | null;
        }[] | {
          permission: {
            id: string;
            module: string;
            action: string;
          } | null;
        } | null;
      } | null;
    }

    interface RawUserPermission {
      permission: {
        id: string;
        module: string;
        action: string;
      } | null;
    }

    const fetchPermissions = async () => {
      const supabase = createClient();
      try {
        // Fetch role-based permissions
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select(`
            role:roles (
              id,
              name,
              role_permissions (
                permission:permissions (
                  id,
                  module,
                  action
                )
              )
            )
          `)
          .eq("user_id", user.id);

        if (roleError) throw roleError;

        // Fetch direct user_permissions (per-user grants)
        const { data: directData } = await supabase
          .from("user_permissions")
          .select(`
            permission:permissions (
              id,
              module,
              action
            )
          `)
          .eq("user_id", user.id);

        const resolvedRoles: string[] = [];
        const resolvedPerms: { module: string; action: string }[] = [];

        // Process role-based permissions
        (roleData as unknown as RawUserRole[] || []).forEach((ur) => {
          const role = ur.role;
          if (role) {
            resolvedRoles.push(role.name);
            const rolePerms = role.role_permissions;
            if (rolePerms) {
              const permsArr = Array.isArray(rolePerms) ? rolePerms : [rolePerms];
              permsArr.forEach((rp) => {
                const perm = rp.permission;
                if (perm) {
                  resolvedPerms.push({
                    module: perm.module.toLowerCase(),
                    action: perm.action.toLowerCase(),
                  });
                }
              });
            }
          }
        });

        // Process direct user_permissions (per-user overrides)
        (directData as unknown as RawUserPermission[] || []).forEach((up) => {
          const perm = up.permission;
          if (perm) {
            const entry = {
              module: perm.module.toLowerCase(),
              action: perm.action.toLowerCase(),
            };
            // Avoid duplicates
            const exists = resolvedPerms.some(
              (p) => p.module === entry.module && p.action === entry.action
            );
            if (!exists) {
              resolvedPerms.push(entry);
            }
          }
        });

        setRoles(resolvedRoles);
        setPermissions(resolvedPerms);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn("Failed to load user permissions, falling back to legacy role:", errMsg);
        
        const resolvedRoles: string[] = [];
        const resolvedPerms: { module: string; action: string }[] = [];
        const legacyRole = profile?.account_role;
        
        if (legacyRole === "owner" || legacyRole === "admin") {
          resolvedRoles.push(legacyRole === "owner" ? "Super Admin" : "Admin");
          
          const ACTIONS = ["view", "create", "edit", "delete", "approve", "assign", "export", "import", "print", "manage", "reply", "send", "convert", "dispatch", "complete"];
          const MODULES = [
            "dashboard",
            "enquiries", "quotation", "proforma", "inbox", "contacts", "reports", "automations", "broadcasts", "crm_pipeline",
            "user_management", "settings", "integrations", "company_settings",
            "whatsapp_settings", "ai_settings", "indiamart_settings", "tradeindia_settings",
            "exportersindia_settings", "smtp_settings", "audit_logs", "role_management",
            // Legacy
            "customers", "leads", "indiamart", "tradeindia", "exportersindia",
            "whatsapp", "sales", "crm", "analytics", "ai_assistant", "notifications", "integrations",
          ];
          
          MODULES.forEach(mod => {
            ACTIONS.forEach(act => {
              resolvedPerms.push({ module: mod, action: act });
            });
          });
        } else if (legacyRole === "agent") {
          resolvedRoles.push("Sales");
          
          // Sales agent gets basic view permissions on CRM modules
          const agentModules = [
            "dashboard",
            "enquiries", "leads",
            "quotation", "proforma", "sales",
            "inbox", "whatsapp",
            "contacts", "customers",
          ];
          agentModules.forEach(mod => {
            resolvedPerms.push({ module: mod, action: "view" });
          });
          resolvedPerms.push({ module: "enquiries", action: "create" });
          resolvedPerms.push({ module: "enquiries", action: "edit" });
          resolvedPerms.push({ module: "leads", action: "create" });
          resolvedPerms.push({ module: "leads", action: "edit" });
          resolvedPerms.push({ module: "quotation", action: "create" });
          resolvedPerms.push({ module: "quotation", action: "edit" });
          resolvedPerms.push({ module: "proforma", action: "create" });
          resolvedPerms.push({ module: "proforma", action: "edit" });
          resolvedPerms.push({ module: "sales", action: "create" });
          resolvedPerms.push({ module: "sales", action: "edit" });
          resolvedPerms.push({ module: "inbox", action: "reply" });
        }
        
        setRoles(resolvedRoles);
        setPermissions(resolvedPerms);
      } finally {
        setLoading(false);
      }
    };

    Promise.resolve().then(() => {
      fetchPermissions();
    });
  }, [user, profile, profileLoading]);

  const isSuperAdmin = roles.includes("Super Admin");

  const hasPermission = (module: string, action: string): boolean => {
    if (isSuperAdmin) return true;
    return permissions.some(
      (p) => p.module === module.toLowerCase() && p.action === action.toLowerCase()
    );
  };

  /**
   * Returns true if the user has ANY of the supplied permission pairs.
   * Useful for checking both new-style ("enquiries", "view") and
   * legacy ("leads", "view") in a single call.
   */
  const hasAnyPermission = (
    checks: Array<{ module: string; action: string }>
  ): boolean => {
    if (isSuperAdmin) return true;
    return checks.some(({ module, action }) => hasPermission(module, action));
  };

  return {
    roles,
    permissions,
    loading: loading || profileLoading,
    isSuperAdmin,
    hasPermission,
    hasAnyPermission,
  };
}
