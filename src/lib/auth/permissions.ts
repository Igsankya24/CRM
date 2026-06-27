import { getCurrentAccount, ForbiddenError } from "./account";

/**
 * Ensures the logged-in user is a Super Admin.
 * Throws ForbiddenError if the user is not a Super Admin.
 */
export async function requireSuperAdmin() {
  const ctx = await getCurrentAccount();
  
  const { data: isSuper, error } = await ctx.supabase.rpc("is_super_admin");
  if (error || !isSuper) {
    throw new ForbiddenError("Only Super Admins can perform this action");
  }
  
  return ctx;
}

/**
 * Ensures the logged-in user has the specified module and action permission.
 * Throws ForbiddenError if permission is denied.
 *
 * Both old-style (`leads`, `view`) and new-style (`enquiries`, `view`) module
 * names are supported — the DB function `has_permission` handles both.
 */
export async function requirePermission(module: string, action: string) {
  const ctx = await getCurrentAccount();
  
  const { data: hasPerm, error } = await ctx.supabase.rpc("has_permission", {
    p_module: module,
    p_action: action,
  });
  
  if (error || !hasPerm) {
    throw new ForbiddenError(`You do not have permission to ${action} ${module}`);
  }
  
  return ctx;
}

/**
 * Ensures the logged-in user has ANY of the provided permission pairs.
 * Useful when a route supports both old-style and new-style permission names
 * (e.g., "leads/view" OR "enquiries/view").
 *
 * Throws ForbiddenError if none of the permissions match.
 */
export async function requireAnyPermission(
  permissions: Array<{ module: string; action: string }>
) {
  const ctx = await getCurrentAccount();

  for (const { module, action } of permissions) {
    const { data: hasPerm, error } = await ctx.supabase.rpc("has_permission", {
      p_module: module,
      p_action: action,
    });
    if (!error && hasPerm) {
      return ctx;
    }
  }

  throw new ForbiddenError(
    "You do not have the required permissions to perform this action"
  );
}

/**
 * Permission constants for the new naming convention.
 * Use these instead of raw strings to avoid typos and enable IDE auto-complete.
 */
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: { module: "dashboard", action: "view" },

  // Enquiries (formerly Leads)
  ENQUIRIES_VIEW:   { module: "enquiries", action: "view" },
  ENQUIRIES_CREATE: { module: "enquiries", action: "create" },
  ENQUIRIES_EDIT:   { module: "enquiries", action: "edit" },
  ENQUIRIES_DELETE: { module: "enquiries", action: "delete" },
  ENQUIRIES_ASSIGN: { module: "enquiries", action: "assign" },

  // Quotation Register (formerly Quotations)
  QUOTATION_VIEW:   { module: "quotation", action: "view" },
  QUOTATION_CREATE: { module: "quotation", action: "create" },
  QUOTATION_EDIT:   { module: "quotation", action: "edit" },
  QUOTATION_DELETE: { module: "quotation", action: "delete" },
  QUOTATION_EXPORT: { module: "quotation", action: "export" },
  QUOTATION_SEND:   { module: "quotation", action: "send" },
  QUOTATION_CONVERT:{ module: "quotation", action: "convert" },

  // Proforma Invoice
  PROFORMA_VIEW:    { module: "proforma", action: "view" },
  PROFORMA_CREATE:  { module: "proforma", action: "create" },
  PROFORMA_EDIT:    { module: "proforma", action: "edit" },
  PROFORMA_DELETE:  { module: "proforma", action: "delete" },
  PROFORMA_SEND:    { module: "proforma", action: "send" },
  PROFORMA_CONVERT: { module: "proforma", action: "convert" },

  // Sales Register
  SALES_VIEW:       { module: "sales", action: "view" },
  SALES_CREATE:     { module: "sales", action: "create" },
  SALES_EDIT:       { module: "sales", action: "edit" },
  SALES_DELETE:     { module: "sales", action: "delete" },
  SALES_DISPATCH:   { module: "sales", action: "dispatch" },
  SALES_COMPLETE:   { module: "sales", action: "complete" },

  // Inbox
  INBOX_VIEW:  { module: "inbox", action: "view" },
  INBOX_REPLY: { module: "inbox", action: "reply" },

  // Contacts
  CONTACTS_VIEW:   { module: "contacts", action: "view" },
  CONTACTS_CREATE: { module: "contacts", action: "create" },
  CONTACTS_EDIT:   { module: "contacts", action: "edit" },
  CONTACTS_DELETE: { module: "contacts", action: "delete" },

  // Reports
  REPORTS_VIEW: { module: "reports", action: "view" },

  // Automations
  AUTOMATIONS_VIEW: { module: "automations", action: "view" },

  // Broadcasts
  BROADCASTS_VIEW: { module: "broadcasts", action: "view" },

  // CRM Pipeline
  CRM_PIPELINE_VIEW: { module: "crm_pipeline", action: "view" },

  // User Management
  USER_MANAGEMENT_VIEW:   { module: "user_management", action: "view" },
  USER_MANAGEMENT_CREATE: { module: "user_management", action: "create" },
  USER_MANAGEMENT_EDIT:   { module: "user_management", action: "edit" },
  USER_MANAGEMENT_DELETE: { module: "user_management", action: "delete" },

  // Settings — Super Admin only
  SETTINGS_VIEW: { module: "settings", action: "view" },

  // Integrations — Super Admin only
  INTEGRATIONS_VIEW: { module: "integrations", action: "view" },

  // Company Settings — Super Admin only
  COMPANY_SETTINGS_VIEW: { module: "company_settings", action: "view" },

  // WhatsApp Settings — Super Admin only
  WHATSAPP_SETTINGS_VIEW: { module: "whatsapp_settings", action: "view" },

  // AI Settings — Super Admin only
  AI_SETTINGS_VIEW: { module: "ai_settings", action: "view" },

  // IndiaMART Settings — Super Admin only
  INDIAMART_SETTINGS_VIEW: { module: "indiamart_settings", action: "view" },

  // TradeIndia Settings — Super Admin only
  TRADEINDIA_SETTINGS_VIEW: { module: "tradeindia_settings", action: "view" },

  // ExportersIndia Settings — Super Admin only
  EXPORTERSINDIA_SETTINGS_VIEW: { module: "exportersindia_settings", action: "view" },

  // SMTP Settings — Super Admin only
  SMTP_SETTINGS_VIEW: { module: "smtp_settings", action: "view" },

  // Audit Logs — Super Admin only
  AUDIT_LOGS_VIEW: { module: "audit_logs", action: "view" },

  // Role Management — Super Admin only
  ROLE_MANAGEMENT_VIEW: { module: "role_management", action: "view" },
} as const;
