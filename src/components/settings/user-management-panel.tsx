"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Plus,
  Search,
  User,
  Shield,
  History,
  FileText,
  RefreshCw,
  Key,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const DEPARTMENTS = [
  "Sales Department",
  "Accounts Department",
  "Production Department",
  "Management Department",
];

/** Module checkboxes shown when creating/editing a Sales user. 
 *  Each entry maps a display label to a permission (module, action) pair.
 *  All granted module 'view' permissions are stored in user_permissions. */
const MODULE_PERMISSIONS: Array<{
  label: string;
  module: string;
  action: string;
  description: string;
}> = [
  { label: "Dashboard",             module: "dashboard",     action: "view",    description: "View dashboard metrics" },
  { label: "Enquiries",             module: "enquiries",     action: "view",    description: "View and manage enquiries" },
  { label: "Create Enquiries",      module: "enquiries",     action: "create",  description: "Create new enquiries" },
  { label: "Edit Enquiries",        module: "enquiries",     action: "edit",    description: "Edit enquiries" },
  { label: "Quotation Register",    module: "quotation",     action: "view",    description: "View quotations" },
  { label: "Create Quotations",     module: "quotation",     action: "create",  description: "Create new quotations" },
  { label: "Edit Quotations",       module: "quotation",     action: "edit",    description: "Edit quotations" },
  { label: "Send Quotations",       module: "quotation",     action: "send",    description: "Send quotations via WhatsApp/Email" },
  { label: "Export Quotations",     module: "quotation",     action: "export",  description: "Export quotations as PDF" },
  { label: "Convert Quotations",    module: "quotation",     action: "convert", description: "Convert quotation to Proforma Invoice" },
  { label: "Proforma Invoice",      module: "proforma",      action: "view",    description: "View proforma invoices" },
  { label: "Create Proformas",      module: "proforma",      action: "create",  description: "Create new proforma invoices" },
  { label: "Edit Proformas",        module: "proforma",      action: "edit",    description: "Edit proforma invoices" },
  { label: "Send Proformas",        module: "proforma",      action: "send",    description: "Send proformas via WhatsApp/Email" },
  { label: "Convert Proformas",     module: "proforma",      action: "convert", description: "Convert proforma to Sales Register" },
  { label: "Sales Register",        module: "sales",         action: "view",    description: "View sales register" },
  { label: "Create Sales Entries",  module: "sales",         action: "create",  description: "Create new sales register entries" },
  { label: "Edit Sales Entries",    module: "sales",         action: "edit",    description: "Edit sales register entries" },
  { label: "Dispatch Sales",        module: "sales",         action: "dispatch", description: "Mark sales as dispatched" },
  { label: "Inbox",                 module: "inbox",         action: "view",    description: "View WhatsApp inbox" },
  { label: "Reply in Inbox",        module: "inbox",         action: "reply",   description: "Reply to WhatsApp messages" },
  { label: "Contacts",              module: "contacts",      action: "view",    description: "View contacts" },
  { label: "Create Contacts",       module: "contacts",      action: "create",  description: "Create contacts" },
  { label: "Edit Contacts",         module: "contacts",      action: "edit",    description: "Edit contacts" },
  { label: "Reports",               module: "reports",       action: "view",    description: "View reports" },
  { label: "Automations",           module: "automations",   action: "view",    description: "View automations" },
  { label: "Broadcasts",            module: "broadcasts",    action: "view",    description: "View broadcasts" },
  { label: "CRM Pipeline",          module: "crm_pipeline",  action: "view",    description: "View CRM pipeline" },
  { label: "User Management",       module: "user_management", action: "view",  description: "View user management" },
];

interface Role {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

interface User {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  mobile?: string | null;
  department?: string | null;
  designation?: string | null;
  is_active: boolean;
  roles: Role[];
  created_at?: string;
  updated_at?: string;
}

interface AuditLog {
  id: string;
  created_at: string;
  user?: {
    full_name: string;
    email?: string;
  } | null;
  module: string;
  action: string;
  old_value?: unknown;
  new_value?: unknown;
}

interface LoginLog {
  id: string;
  user?: {
    full_name: string;
    email: string;
  } | null;
  ip_address?: string | null;
  device?: string | null;
  browser?: string | null;
  login_time?: string | null;
  logout_time?: string | null;
}

interface Permission {
  id: string;
  module: string;
  action: string;
  description?: string;
}

export function UserManagementPanel({ defaultTab = "users" }: { defaultTab?: string }) {
  const { isSuperAdmin, hasPermission } = usePermissions();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  // Modals state
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [resetPassOpen, setResetPassOpen] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [rolePermsOpen, setRolePermsOpen] = useState(false);

  // Selected entities for edit
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // Form states
  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    full_name: "",
    mobile: "",
    department: "",
    designation: "",
    role_ids: [] as string[],
    module_permissions: [] as string[], // "module:action" strings for direct grants
  });

  const [editUserForm, setEditUserForm] = useState({
    full_name: "",
    mobile: "",
    department: "",
    designation: "",
    is_active: true,
    role_ids: [] as string[],
  });

  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
  });

  // Password reset temporary display
  const [tempPassword, setTempPassword] = useState("");

  // Role permissions Matrix state
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]); // Array of permission IDs mapped to selected role

  const [activeTab, setActiveTab] = useState(defaultTab);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch users and roles
      const usersRes = await fetch("/api/admin/users");
      const usersData = await usersRes.json();
      if (usersData.users) {
        setUsers(usersData.users);
      }
      if (usersData.roles) {
        setRoles(usersData.roles);
      }

      // Fetch logs
      const logsRes = await fetch("/api/admin/logs");
      const logsData = await logsRes.json();
      if (logsData.auditLogs) {
        setAuditLogs(logsData.auditLogs);
      }
      if (logsData.loginLogs) {
        setLoginLogs(logsData.loginLogs);
      }

      // Fetch all system permissions if Super Admin
      if (isSuperAdmin) {
        const supabaseClient = createClient();
        const { data: perms } = await supabaseClient.from("permissions").select("*");
        setAllPermissions(perms || []);
      }
    } catch (err) {
      console.error("Failed to load user management details:", err);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setActiveTab(defaultTab);
    });
  }, [defaultTab]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadData();
    });
  }, [loadData]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        return;
      }
      toast.success("User created successfully");
      setAddUserOpen(false);
      setUserForm({
        email: "",
        password: "",
        full_name: "",
        mobile: "",
        department: "",
        designation: "",
        role_ids: [],
        module_permissions: [],
      });
      loadData();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "An error occurred while creating user");
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editUserForm),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        return;
      }
      toast.success("User details updated successfully");
      setEditUserOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "An error occurred while updating user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) {
        toast.error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        return;
      }
      toast.success("User deleted successfully");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "An error occurred while deleting user");
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        return;
      }
      toast.success("Password reset link/temporary password generated");
      setTempPassword(data.password);
      setResetPassOpen(true);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "An error occurred while resetting password");
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("roles").insert({
        name: roleForm.name,
        description: roleForm.description,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Role created successfully");
      setAddRoleOpen(false);
      setRoleForm({ name: "", description: "" });
      loadData();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "An error occurred while creating role");
    }
  };

  const openRolePermissions = async (role: Role) => {
    setSelectedRole(role);
    setLoading(true);
    try {
      const { data: mapped } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", role.id);

      setRolePermissions((mapped || []).map((m) => m.permission_id));
      setRolePermsOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (permId: string) => {
    if (!selectedRole) return;
    const isMapped = rolePermissions.includes(permId);

    try {
      if (isMapped) {
        await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", selectedRole.id)
          .eq("permission_id", permId);
        setRolePermissions(rolePermissions.filter((id) => id !== permId));
      } else {
        await supabase.from("role_permissions").insert({
          role_id: selectedRole.id,
          permission_id: permId,
        });
        setRolePermissions([...rolePermissions, permId]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = deptFilter === "all" || u.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">User Management & Roles</h2>
          <p className="text-sm text-slate-400">
            Create users, edit profiles, reset passwords, manage custom roles, and configure system permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="border-slate-800 bg-slate-900/50 text-slate-400">
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
          {hasPermission("user_management", "create") && (
            <Button size="sm" onClick={() => setAddUserOpen(true)} className="bg-primary text-white hover:bg-primary/95">
              <Plus className="mr-2 size-4" />
              Add User
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="border border-slate-800 bg-slate-950 p-1">
          <TabsTrigger value="users" className="data-active:text-white text-slate-400 data-active:bg-slate-900">
            <User className="mr-2 size-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="data-active:text-white text-slate-400 data-active:bg-slate-900">
            <Shield className="mr-2 size-4" />
            Roles & Permissions
          </TabsTrigger>
          <TabsTrigger value="logins" className="data-active:text-white text-slate-400 data-active:bg-slate-900">
            <History className="mr-2 size-4" />
            Login History
          </TabsTrigger>
          <TabsTrigger value="audit" className="data-active:text-white text-slate-400 data-active:bg-slate-900">
            <FileText className="mr-2 size-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4 pt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-500" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-slate-800 bg-slate-900/50 pl-9 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="w-full sm:w-[220px]">
              <Select value={deptFilter} onValueChange={(val) => setDeptFilter(val || "all")}>
                <SelectTrigger className="border-slate-800 bg-slate-900/50 text-white">
                  <SelectValue placeholder="Filter by Department" />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-950 text-white">
                  <SelectItem value="all">All Departments</SelectItem>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-slate-900/20">
                    <TableHead className="text-slate-400">User</TableHead>
                    <TableHead className="text-slate-400">Mobile</TableHead>
                    <TableHead className="text-slate-400">Department</TableHead>
                    <TableHead className="text-slate-400">Designation</TableHead>
                    <TableHead className="text-slate-400">Roles</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-right text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                        Loading users...
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="border-slate-800 hover:bg-slate-900/20">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-white">{user.full_name}</span>
                            <span className="text-xs text-slate-500">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-300">{user.mobile || "-"}</TableCell>
                        <TableCell className="text-slate-300">
                          {user.department ? (
                            <Badge variant="outline" className="border-sky-500/20 bg-sky-500/5 text-sky-400">
                              {user.department}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300">{user.designation || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((r) => (
                              <Badge key={r.id} className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/20">
                                {r.name}
                              </Badge>
                            ))}
                            {user.roles.length === 0 && <span className="text-xs text-slate-500">No Roles</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.is_active ? (
                            <div className="flex items-center text-emerald-400 text-xs gap-1.5">
                              <CheckCircle className="size-3.5" />
                              Active
                            </div>
                          ) : (
                            <div className="flex items-center text-red-400 text-xs gap-1.5">
                              <XCircle className="size-3.5" />
                              Disabled
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasPermission("user_management", "edit") && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setEditUserForm({
                                      full_name: user.full_name,
                                      mobile: user.mobile || "",
                                      department: user.department || "",
                                      designation: user.designation || "",
                                      is_active: user.is_active,
                                      role_ids: user.roles.map((r) => r.id),
                                    });
                                    setEditUserOpen(true);
                                  }}
                                  className="size-8 text-slate-400 hover:text-white hover:bg-slate-800"
                                >
                                  <Edit2 className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Reset Password"
                                  onClick={() => handleResetPassword(user.user_id)}
                                  className="size-8 text-slate-400 hover:text-white hover:bg-slate-800"
                                >
                                  <Key className="size-4" />
                                </Button>
                              </>
                            )}
                            {isSuperAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUser(user.user_id)}
                                className="size-8 text-red-500/70 hover:text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles & Permissions Tab */}
        <TabsContent value="roles" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-medium text-white">System & Custom Roles</h3>
            {isSuperAdmin && (
              <Button size="sm" onClick={() => setAddRoleOpen(true)} className="bg-primary text-white hover:bg-primary/95">
                <Plus className="mr-2 size-4" />
                Add Custom Role
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <Card key={role.id} className="border-slate-800 bg-slate-900/30 backdrop-blur hover:border-slate-700 transition">
                <CardHeader>
                  <CardTitle className="text-md flex items-center justify-between text-white">
                    <span>{role.name}</span>
                    {role.name === "Super Admin" || role.name === "Admin" ? (
                      <Badge variant="outline" className="border-amber-500/20 bg-amber-500/5 text-amber-400">
                        System Default
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-700 text-slate-400">
                        Customisable
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 min-h-[40px]">
                    {role.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-end gap-2 pt-2 border-t border-slate-800/60">
                  {isSuperAdmin && role.name !== "Super Admin" ? (
                    <Button variant="ghost" size="sm" onClick={() => openRolePermissions(role)} className="text-primary hover:text-primary-foreground hover:bg-primary/20">
                      <Shield className="mr-2 size-4" />
                      Edit Permissions
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled className="text-slate-600">
                      <Shield className="mr-2 size-4" />
                      Full Access
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Login History Tab */}
        <TabsContent value="logins" className="pt-4">
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-slate-900/20">
                    <TableHead className="text-slate-400">User</TableHead>
                    <TableHead className="text-slate-400">IP Address</TableHead>
                    <TableHead className="text-slate-400">Device</TableHead>
                    <TableHead className="text-slate-400">Browser</TableHead>
                    <TableHead className="text-slate-400">Login Time</TableHead>
                    <TableHead className="text-slate-400">Logout Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                        Loading login records...
                      </TableCell>
                    </TableRow>
                  ) : loginLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                        No login history found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    loginLogs.map((log) => (
                      <TableRow key={log.id} className="border-slate-800 hover:bg-slate-900/20">
                        <TableCell>
                          {log.user ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-white">{log.user.full_name}</span>
                              <span className="text-xs text-slate-500">{log.user.email}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500">Unknown User</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-slate-300">{log.ip_address || "-"}</TableCell>
                        <TableCell className="text-slate-300">{log.device || "-"}</TableCell>
                        <TableCell className="text-slate-300">{log.browser || "-"}</TableCell>
                        <TableCell className="text-slate-300">
                          {log.login_time ? new Date(log.login_time).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {log.logout_time ? new Date(log.logout_time).toLocaleString() : "Active"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="pt-4">
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-slate-900/20">
                    <TableHead className="text-slate-400">Timestamp</TableHead>
                    <TableHead className="text-slate-400">Actor</TableHead>
                    <TableHead className="text-slate-400">Module</TableHead>
                    <TableHead className="text-slate-400">Action</TableHead>
                    <TableHead className="text-slate-400">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                        Loading audit logs...
                      </TableCell>
                    </TableRow>
                  ) : auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                        No audit logs recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => (
                      <TableRow key={log.id} className="border-slate-800 hover:bg-slate-900/20">
                        <TableCell className="text-slate-300">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-white">{log.user?.full_name || "System"}</span>
                            {log.user?.email && <span className="text-xs text-slate-500">{log.user.email}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-slate-700 bg-slate-800/40 text-slate-300">
                            {log.module}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-800 text-white">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[400px]">
                          <div className="flex flex-col gap-1 text-xs text-slate-400">
                            {!!log.old_value && (
                              <div>
                                <span className="text-slate-500 font-medium mr-1">Before:</span>
                                <code className="bg-slate-950 p-1 rounded border border-slate-800 text-[10px] break-all max-h-[60px] overflow-y-auto block">
                                  {JSON.stringify(log.old_value)}
                                </code>
                              </div>
                            )}
                            {!!log.new_value && (
                              <div>
                                <span className="text-slate-500 font-medium mr-1">After:</span>
                                <code className="bg-slate-950 p-1 rounded border border-slate-800 text-[10px] break-all max-h-[60px] overflow-y-auto block">
                                  {JSON.stringify(log.new_value)}
                                </code>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add User Modal */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white max-w-lg">
          <form onSubmit={handleAddUser}>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription className="text-slate-400">
                Create a login account for a new staff member and assign their system roles.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name" className="text-slate-300">Full Name</Label>
                  <Input
                    id="add-name"
                    required
                    placeholder="Jane Doe"
                    value={userForm.full_name}
                    onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                    className="border-slate-800 bg-slate-900 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-email" className="text-slate-300">Email Address</Label>
                  <Input
                    id="add-email"
                    type="email"
                    required
                    placeholder="jane@company.com"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="border-slate-800 bg-slate-900 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-password" className="text-slate-300">Temporary Password</Label>
                  <Input
                    id="add-password"
                    type="password"
                    placeholder="Auto-generated if left blank"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="border-slate-800 bg-slate-900 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-mobile" className="text-slate-300">Mobile Number</Label>
                  <Input
                    id="add-mobile"
                    placeholder="+1 (555) 019-2834"
                    value={userForm.mobile}
                    onChange={(e) => setUserForm({ ...userForm, mobile: e.target.value })}
                    className="border-slate-800 bg-slate-900 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-dept" className="text-slate-300">Department</Label>
                  <Select
                    value={userForm.department}
                    onValueChange={(val) => setUserForm({ ...userForm, department: val || "" })}
                  >
                    <SelectTrigger className="border-slate-800 bg-slate-900 text-white">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-950 text-white">
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-desig" className="text-slate-300">Designation</Label>
                  <Input
                    id="add-desig"
                    placeholder="Sales Associate"
                    value={userForm.designation}
                    onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
                    className="border-slate-800 bg-slate-900 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Roles</Label>
                <div className="grid grid-cols-2 gap-2 border border-slate-800 bg-slate-900/20 p-3 rounded-lg max-h-[120px] overflow-y-auto">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={userForm.role_ids.includes(role.id)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setUserForm({
                            ...userForm,
                            role_ids: isChecked
                              ? [...userForm.role_ids, role.id]
                              : userForm.role_ids.filter((id) => id !== role.id),
                          });
                        }}
                        className="rounded border-slate-800 bg-slate-900 text-primary focus:ring-primary/20"
                      />
                      {role.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* Module Permissions Checkboxes (for Sales users) */}
              <div className="space-y-2">
                <Label className="text-slate-300">
                  Module Access
                  <span className="ml-1.5 text-xs text-slate-500">(Grant specific modules — mainly for Sales role)</span>
                </Label>
                <div className="border border-slate-800 bg-slate-900/20 p-3 rounded-lg max-h-[200px] overflow-y-auto">
                  <div className="grid grid-cols-1 gap-1.5">
                    {MODULE_PERMISSIONS.map((mp) => {
                      const key = `${mp.module}:${mp.action}`;
                      return (
                        <label
                          key={key}
                          className="flex items-start gap-2.5 text-sm text-slate-300 cursor-pointer hover:text-white py-0.5"
                        >
                          <input
                            type="checkbox"
                            checked={userForm.module_permissions.includes(key)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUserForm({
                                ...userForm,
                                module_permissions: checked
                                  ? [...userForm.module_permissions, key]
                                  : userForm.module_permissions.filter((k) => k !== key),
                              });
                            }}
                            className="mt-0.5 rounded border-slate-800 bg-slate-900 text-primary focus:ring-primary/20"
                          />
                          <div className="flex flex-col">
                            <span className="font-medium leading-tight">{mp.label}</span>
                            <span className="text-[11px] text-slate-500">{mp.description}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddUserOpen(false)} className="border-slate-800 bg-slate-900 text-slate-400">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-white hover:bg-primary/95">
                Save User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white max-w-lg">
          <form onSubmit={handleEditUser}>
            <DialogHeader>
              <DialogTitle>Edit User Profile</DialogTitle>
              <DialogDescription className="text-slate-400">
                Update details, status, and permissions for {selectedUser?.full_name}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-slate-300">Full Name</Label>
                  <Input
                    id="edit-name"
                    required
                    value={editUserForm.full_name}
                    onChange={(e) => setEditUserForm({ ...editUserForm, full_name: e.target.value })}
                    className="border-slate-800 bg-slate-900 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-mobile" className="text-slate-300">Mobile Number</Label>
                  <Input
                    id="edit-mobile"
                    value={editUserForm.mobile}
                    onChange={(e) => setEditUserForm({ ...editUserForm, mobile: e.target.value })}
                    className="border-slate-800 bg-slate-900 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-dept" className="text-slate-300">Department</Label>
                  <Select
                    value={editUserForm.department}
                    onValueChange={(val) => setEditUserForm({ ...editUserForm, department: val || "" })}
                  >
                    <SelectTrigger className="border-slate-800 bg-slate-900 text-white">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-950 text-white">
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-desig" className="text-slate-300">Designation</Label>
                  <Input
                    id="edit-desig"
                    value={editUserForm.designation}
                    onChange={(e) => setEditUserForm({ ...editUserForm, designation: e.target.value })}
                    className="border-slate-800 bg-slate-900 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Roles</Label>
                <div className="grid grid-cols-2 gap-2 border border-slate-800 bg-slate-900/20 p-3 rounded-lg max-h-[120px] overflow-y-auto">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={editUserForm.role_ids.includes(role.id)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setEditUserForm({
                            ...editUserForm,
                            role_ids: isChecked
                              ? [...editUserForm.role_ids, role.id]
                              : editUserForm.role_ids.filter((id) => id !== role.id),
                          });
                        }}
                        className="rounded border-slate-800 bg-slate-900 text-primary focus:ring-primary/20"
                      />
                      {role.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border border-slate-800 bg-slate-900/10 p-3 rounded-lg">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-slate-300">Active Status</span>
                  <span className="text-xs text-slate-500">Disable account to immediately revoke CRM access.</span>
                </div>
                <Switch
                  checked={editUserForm.is_active}
                  onCheckedChange={(val) => setEditUserForm({ ...editUserForm, is_active: val })}
                  className="data-state-checked:bg-primary"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUserOpen(false)} className="border-slate-800 bg-slate-900 text-slate-400">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-white hover:bg-primary/95">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Temporary Confirmation Modal */}
      <Dialog open={resetPassOpen} onOpenChange={setResetPassOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="size-5" />
              Password Reset Successful
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              A temporary password has been successfully generated. Please copy it and share it securely with the user.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label className="text-slate-400 text-xs">Temporary Password</Label>
            <div className="mt-1 flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono text-md text-white select-all">
              {tempPassword}
            </div>
            <p className="mt-2 text-slate-500 text-[11px]">
              * The user will be able to change this password from their profile page after logging in.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setResetPassOpen(false)} className="w-full bg-slate-900 text-white hover:bg-slate-800 border-slate-800">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Custom Role Modal */}
      <Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white max-w-md">
          <form onSubmit={handleCreateRole}>
            <DialogHeader>
              <DialogTitle>Create Custom Role</DialogTitle>
              <DialogDescription className="text-slate-400">
                Add a new security role to map fine-grained module access.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role-name" className="text-slate-300">Role Name</Label>
                <Input
                  id="role-name"
                  required
                  placeholder="e.g. Sales Coordinator"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="border-slate-800 bg-slate-900 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-desc" className="text-slate-300">Description</Label>
                <Input
                  id="role-desc"
                  placeholder="e.g. Manages sales pipelines and lead assignments"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  className="border-slate-800 bg-slate-900 text-white"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddRoleOpen(false)} className="border-slate-800 bg-slate-900 text-slate-400">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-white hover:bg-primary/95">
                Create Role
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Role Permissions Matrix Modal */}
      <Dialog open={rolePermsOpen} onOpenChange={setRolePermsOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white max-w-5xl max-h-[90vh] overflow-hidden flex flex-col w-full">
          <DialogHeader className="px-1">
            <DialogTitle>Manage Role Permissions: {selectedRole?.name}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Grant or revoke fine-grained capabilities across system modules.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 border-t border-b border-slate-800/80 my-2 px-1">
            {allPermissions.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Loading permissions matrix...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800/60 hover:bg-transparent">
                    <TableHead className="text-slate-400 w-[250px] min-w-[250px]">Module</TableHead>
                    <TableHead className="text-slate-400 w-[100px] min-w-[100px] text-center text-xs">Grant</TableHead>
                    <TableHead className="text-slate-400 w-[180px] min-w-[180px] text-xs">Permission</TableHead>
                    <TableHead className="text-slate-400 text-xs">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPermissions
                    .sort((a, b) => a.module.localeCompare(b.module) || a.action.localeCompare(b.action))
                    .map((perm) => (
                      <TableRow key={perm.id} className="border-slate-800/40 hover:bg-slate-900/10">
                        <TableCell className="font-medium text-slate-300 text-xs w-[250px] min-w-[250px] capitalize">
                          {perm.module.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-center w-[100px] min-w-[100px]">
                          <input
                            type="checkbox"
                            checked={rolePermissions.includes(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            className="size-4 rounded border-slate-800 bg-slate-900 text-primary focus:ring-primary/20 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="text-slate-400 text-xs w-[180px] min-w-[180px]">{perm.action}</TableCell>
                        <TableCell className="text-slate-500 text-xs whitespace-normal break-words">{perm.description || "—"}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter className="px-1 pt-2">
            <Button onClick={() => setRolePermsOpen(false)} className="bg-primary text-white hover:bg-primary/95">
              Close & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
