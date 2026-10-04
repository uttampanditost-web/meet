import React, { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  UserPlus,
  Trash2,
  Check,
  X,
  Search,
  KeyRound,
  Eye,
  Crown,
  Lock,
  Mail,
  User,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { AppUser, loadAllUsers, saveUser, deleteUser, SUPERADMIN_EMAIL } from "../lib/userService";
import { UserRole } from "../types";

interface AccessManagementTabProps {
  currentUser: AppUser | null;
  isAdmin: boolean;
}

export const AccessManagementTab: React.FC<AccessManagementTabProps> = ({
  currentUser,
  isAdmin,
}) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add User Form State
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("viewer");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const all = await loadAllUsers();
      setUsers(all);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanPassword = newPassword.trim();
    const cleanName = newName.trim() || cleanEmail.split("@")[0];

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newUser: AppUser = {
        id: `user-${Date.now()}`,
        email: cleanEmail,
        password: cleanPassword,
        name: cleanName,
        role: newRole,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };

      await saveUser(newUser);
      await fetchUsers();

      setFormSuccess(`Successfully created ${newRole === "admin" ? "Admin" : "Viewer"} account for ${cleanEmail}`);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("viewer");

      setTimeout(() => {
        setIsAddModalOpen(false);
        setFormSuccess(null);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || "Failed to create user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (targetEmail: string, newRoleValue: UserRole) => {
    if (!isAdmin) return;
    if (targetEmail.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()) {
      alert("Cannot change role of root SuperAdmin.");
      return;
    }

    const targetUser = users.find((u) => u.email.toLowerCase() === targetEmail.toLowerCase());
    if (!targetUser) return;

    const updated = { ...targetUser, role: newRoleValue };
    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.email.toLowerCase() === targetEmail.toLowerCase() ? updated : u))
    );

    await saveUser(updated);
  };

  const handleDeleteUser = async (targetEmail: string) => {
    if (!isAdmin) return;
    if (targetEmail.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()) {
      alert("Cannot delete root SuperAdmin.");
      return;
    }

    if (!window.confirm(`Are you sure you want to revoke access for ${targetEmail}?`)) {
      return;
    }

    setUsers((prev) => prev.filter((u) => u.email.toLowerCase() !== targetEmail.toLowerCase()));
    await deleteUser(targetEmail);
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const adminCount = users.filter((u) => u.role === "admin").length;
  const viewerCount = users.filter((u) => u.role === "viewer").length;

  const formatLastSeen = (isoStr?: string) => {
    if (!isoStr) return "--";
    try {
      const d = new Date(isoStr);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      const sec = String(d.getSeconds()).padStart(2, "0");
      return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${sec}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Banner with Summary & Add User Button */}
      <div className="ios-glass-card rounded-3xl p-6 border border-white/15 backdrop-blur-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Access & Role Management</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {users.length} Users
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage staff permissions. Admins have full edit and scheduling powers; Viewers have read-only access.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email..."
              className="w-full bg-white/[0.04] border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white/[0.07] transition-all font-medium shadow-inner"
            />
          </div>

          {/* Add User Button */}
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add User Access</span>
            </button>
          ) : (
            <span className="text-xs text-slate-400 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              🔒 Read-Only View
            </span>
          )}
        </div>
      </div>

      {/* Main Access Table Card */}
      <div className="ios-glass-card rounded-3xl border border-white/15 overflow-hidden shadow-2xl backdrop-blur-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.02] text-slate-400 uppercase text-[11px] font-bold tracking-wider">
                <th className="py-3.5 px-5">User</th>
                <th className="py-3.5 px-5">Role</th>
                <th className="py-3.5 px-5">Access Level</th>
                <th className="py-3.5 px-5">Last Seen</th>
                {isAdmin && <th className="py-3.5 px-5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    <span>Loading authorized accounts...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No accounts found matching "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentUser?.email.toLowerCase() === u.email.toLowerCase();
                  const isSuper = u.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();

                  return (
                    <tr
                      key={u.id || u.email}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* User Avatar + Name + Email */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-md shrink-0 border border-white/20">
                            {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs flex items-center gap-1.5">
                              <span>{u.name || u.email.split("@")[0]}</span>
                              {isCurrent && (
                                <span className="text-[10px] text-sky-400 font-semibold">(you)</span>
                              )}
                              {isSuper && (
                                <Crown className="w-3 h-3 text-amber-400" title="Root SuperAdmin" />
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role Dropdown */}
                      <td className="py-3.5 px-5">
                        {isAdmin && !isSuper ? (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.email, e.target.value as UserRole)}
                            className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold border focus:outline-none transition-all cursor-pointer ${
                              u.role === "admin"
                                ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                : "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                            }`}
                          >
                            <option value="admin" className="bg-slate-900 text-amber-300 font-semibold">
                              Admin
                            </option>
                            <option value="viewer" className="bg-slate-900 text-cyan-300 font-semibold">
                              Viewer
                            </option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                              u.role === "admin"
                                ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                : "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                            }`}
                          >
                            {u.role === "admin" ? <Crown className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{u.role === "admin" ? "Admin" : "Viewer"}</span>
                          </span>
                        )}
                      </td>

                      {/* Access Level Description */}
                      <td className="py-3.5 px-5">
                        <span className="text-slate-300 font-medium">
                          {u.role === "admin"
                            ? "Full edit + manage user access"
                            : "View only"}
                        </span>
                      </td>

                      {/* Last Seen */}
                      <td className="py-3.5 px-5 font-mono text-slate-400 text-[11px]">
                        {formatLastSeen(u.lastSeen)}
                      </td>

                      {/* Actions */}
                      {isAdmin && (
                        <td className="py-3.5 px-5 text-right">
                          {!isSuper && !isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.email)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Revoke User Access"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New User Access */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/20 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100 animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Grant New User Access</h3>
                  <p className="text-xs text-slate-400">Create staff login credentials & assign role</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error / Success Notices */}
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            {formSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Full Name (Optional)
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-950/80 border border-white/15 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Email Address <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="staff@be10x.com"
                    className="w-full bg-slate-950/80 border border-white/15 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Set account password"
                    className="w-full bg-slate-950/80 border border-white/15 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white focus:outline-none font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Share this password with the user so they can sign in.</p>
              </div>

              {/* Role Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Designated Role <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRole("admin")}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      newRole === "admin"
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-md"
                        : "bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Crown className="w-3.5 h-3.5" />
                      <span>Admin</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Full edit rights, slot generation & user management
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole("viewer")}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      newRole === "viewer"
                        ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-md"
                        : "bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Viewer</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Read-only access to stats, mentors & attendance
                    </p>
                  </button>
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-lg shadow-indigo-500/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Save & Grant Access"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
