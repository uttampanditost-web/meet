import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  X,
  Check,
  AlertCircle,
  Loader2,
  Crown,
  Eye,
  RefreshCw,
  Search,
  CheckCircle2,
  Lock,
  ArrowRightLeft,
  Info
} from "lucide-react";
import { UserAccessRecord, UserRole } from "../types";

interface AdminManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string;
  adminEmails?: string[];
  onRefreshAdmins?: () => Promise<void>;
}

export const AdminManagementModal: React.FC<AdminManagementModalProps> = ({
  isOpen,
  onClose,
  currentUserEmail,
  adminEmails: initialAdminEmails,
  onRefreshAdmins,
}) => {
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("admin");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "admin" | "viewer">("all");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoadingEmail, setActionLoadingEmail] = useState<string | null>(null);

  const [userList, setUserList] = useState<UserAccessRecord[]>([]);

  // Fetch access list from server
  const fetchAccessList = useCallback(async () => {
    if (!currentUserEmail) return;
    setIsLoadingList(true);
    try {
      const res = await fetch(`/api/access/users?requesterEmail=${encodeURIComponent(currentUserEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setUserList(data.users);
        }
      } else {
        // Fallback to legacy /api/admins
        const legacyRes = await fetch(`/api/admins?requesterEmail=${encodeURIComponent(currentUserEmail)}`);
        if (legacyRes.ok) {
          const legacyData = await legacyRes.json();
          if (Array.isArray(legacyData.users)) {
            setUserList(legacyData.users);
          } else if (Array.isArray(legacyData.admins)) {
            setUserList(
              legacyData.admins.map((adm: string) => ({
                email: adm,
                role: "admin",
                grantedAt: new Date().toISOString(),
              }))
            );
          }
        }
      }
    } catch (e) {
      console.warn("Could not load access list:", e);
    } finally {
      setIsLoadingList(false);
    }
  }, [currentUserEmail]);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      fetchAccessList();
    }
  }, [isOpen, fetchAccessList]);

  if (!isOpen) return null;

  const currentUsers = userList || [];
  const adminCount = currentUsers.filter((u) => u.role === "admin").length;
  const viewerCount = currentUsers.filter((u) => u.role === "viewer").length;

  const filteredUsers = currentUsers.filter((u) => {
    const matchesFilter = filterTab === "all" || u.role === filterTab;
    const matchesSearch =
      !searchQuery ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes("@")) {
      setErrorMessage("Please enter a valid Google email address.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/access/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterEmail: currentUserEmail,
          email: newEmail.trim().toLowerCase(),
          role: selectedRole,
          name: newName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to grant user access.");
      }

      setSuccessMessage(
        `Successfully granted ${selectedRole === "admin" ? "Admin" : "Viewer"} access to ${newEmail.trim().toLowerCase()}`
      );
      setNewEmail("");
      setNewName("");
      if (Array.isArray(data.users)) {
        setUserList(data.users);
      } else {
        await fetchAccessList();
      }
      if (onRefreshAdmins) {
        await onRefreshAdmins();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to grant access.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeRole = async (targetEmail: string, newRole: UserRole) => {
    const user = currentUsers.find((u) => u.email.toLowerCase() === targetEmail.toLowerCase());
    if (user?.role === "admin" && newRole === "viewer" && adminCount <= 1) {
      setErrorMessage("Cannot demote the only remaining admin account to viewer.");
      return;
    }

    setActionLoadingEmail(targetEmail);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/access/users/${encodeURIComponent(targetEmail)}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterEmail: currentUserEmail,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update role.");
      }

      setSuccessMessage(
        `Updated ${targetEmail} to ${newRole === "admin" ? "Admin (Full Access)" : "Viewer (Read-Only)"}.`
      );
      if (Array.isArray(data.users)) {
        setUserList(data.users);
      } else {
        await fetchAccessList();
      }
      if (onRefreshAdmins) {
        await onRefreshAdmins();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update user role.");
    } finally {
      setActionLoadingEmail(null);
    }
  };

  const handleRevokeAccess = async (targetEmail: string) => {
    const user = currentUsers.find((u) => u.email.toLowerCase() === targetEmail.toLowerCase());
    if (user?.role === "admin" && adminCount <= 1) {
      setErrorMessage("Cannot revoke access for the only remaining admin account.");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to revoke all access for ${targetEmail}? They will no longer be authorized to use or view the application.`
      )
    ) {
      return;
    }

    setActionLoadingEmail(targetEmail);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(
        `/api/access/users/${encodeURIComponent(targetEmail)}?requesterEmail=${encodeURIComponent(currentUserEmail)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke access.");
      }

      setSuccessMessage(`Revoked access for ${targetEmail}.`);
      if (Array.isArray(data.users)) {
        setUserList(data.users);
      } else {
        await fetchAccessList();
      }
      if (onRefreshAdmins) {
        await onRefreshAdmins();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to revoke access.");
    } finally {
      setActionLoadingEmail(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/95 text-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Access & Role Management</span>
                <div className="flex items-center gap-1.5 ml-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5" />
                    <span>{adminCount} Admin{adminCount === 1 ? "" : "s"}</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono flex items-center gap-1">
                    <Eye className="w-2.5 h-2.5" />
                    <span>{viewerCount} Viewer{viewerCount === 1 ? "" : "s"}</span>
                  </span>
                </div>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Grant and configure Admin and Viewer privileges for your team members.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications */}
        {errorMessage && (
          <div className="mt-4 p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2 shrink-0 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 shrink-0 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Grant Access Form */}
        <form onSubmit={handleGrantAccess} className="mt-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-3 shrink-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Grant New Access</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-6">
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">Google Account Email</label>
              <input
                type="email"
                placeholder="colleague@gmail.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50 font-mono"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">Name / Label (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Sarah Jenkins (Ops)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Role Choice Selector */}
          <div className="pt-1">
            <label className="block text-[11px] text-slate-400 mb-1.5 font-medium">Select Role to Grant</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Admin Option */}
              <button
                type="button"
                onClick={() => setSelectedRole("admin")}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                  selectedRole === "admin"
                    ? "bg-amber-500/10 border-amber-500/50 shadow-sm shadow-amber-500/10"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedRole === "admin"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  <Crown className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${selectedRole === "admin" ? "text-amber-200" : "text-slate-300"}`}>
                      Admin
                    </span>
                    {selectedRole === "admin" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                    Full write access: add/edit mentors, schedule slots, manual attendance & manage roles.
                  </p>
                </div>
              </button>

              {/* Viewer Option */}
              <button
                type="button"
                onClick={() => setSelectedRole("viewer")}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                  selectedRole === "viewer"
                    ? "bg-cyan-500/10 border-cyan-500/50 shadow-sm shadow-cyan-500/10"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedRole === "viewer"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${selectedRole === "viewer" ? "text-cyan-200" : "text-slate-300"}`}>
                      Viewer
                    </span>
                    {selectedRole === "viewer" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                    Read-only access: view live rooms, schedule grid, attendance history & export data.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSubmitting || !newEmail.includes("@")}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              <span>Grant {selectedRole === "admin" ? "Admin" : "Viewer"} Access</span>
            </button>
          </div>
        </form>

        {/* Filter Tabs & Search */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center p-1 bg-slate-950/60 border border-slate-800 rounded-xl">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filterTab === "all"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All ({currentUsers.length})
            </button>
            <button
              onClick={() => setFilterTab("admin")}
              className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                filterTab === "admin"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Crown className="w-3 h-3 text-amber-400" />
              <span>Admins ({adminCount})</span>
            </button>
            <button
              onClick={() => setFilterTab("viewer")}
              className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                filterTab === "viewer"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye className="w-3 h-3 text-cyan-400" />
              <span>Viewers ({viewerCount})</span>
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* User Roster List */}
        <div className="mt-3 flex-1 overflow-y-auto pr-1 space-y-2">
          {isLoadingList && currentUsers.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-950/40 border border-slate-800 text-center flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
              <span>Loading registered accounts...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-500">
              {searchQuery
                ? `No accounts match "${searchQuery}"`
                : filterTab !== "all"
                ? `No ${filterTab} accounts registered.`
                : "No accounts registered yet."}
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isMe = Boolean(
                currentUserEmail && user.email.toLowerCase() === currentUserEmail.toLowerCase()
              );
              const isAdmin = user.role === "admin";
              const isActionLoading = actionLoadingEmail === user.email;

              return (
                <div
                  key={user.email}
                  className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs uppercase ${
                        isAdmin
                          ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                          : "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
                      }`}
                    >
                      {isAdmin ? <Crown className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate font-mono">
                          {user.email}
                        </span>
                        {isMe && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate flex items-center gap-2 mt-0.5">
                        {user.name && <span>{user.name} • </span>}
                        <span>Role: <strong className={isAdmin ? "text-amber-300" : "text-cyan-300"}>{isAdmin ? "Admin" : "Viewer"}</strong></span>
                        {user.grantedBy && (
                          <span className="text-slate-500 text-[10px]">
                            (by {user.grantedBy.split("@")[0]})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Role Switcher */}
                  <div className="flex items-center space-x-2 shrink-0 justify-end">
                    {/* Role Toggle Selector */}
                    <div className="flex items-center p-0.5 bg-slate-900 border border-slate-700/80 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleChangeRole(user.email, "admin")}
                        disabled={isActionLoading || isAdmin}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                          isAdmin
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                            : "text-slate-400 hover:text-white disabled:opacity-50"
                        }`}
                        title="Set role to Admin"
                      >
                        <Crown className="w-3 h-3" />
                        <span>Admin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeRole(user.email, "viewer")}
                        disabled={isActionLoading || !isAdmin || (isAdmin && adminCount <= 1)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                          !isAdmin
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                            : "text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        }`}
                        title={
                          isAdmin && adminCount <= 1
                            ? "Cannot demote the only remaining admin"
                            : "Set role to Viewer"
                        }
                      >
                        <Eye className="w-3 h-3" />
                        <span>Viewer</span>
                      </button>
                    </div>

                    {/* Revoke / Delete Access */}
                    <button
                      type="button"
                      onClick={() => handleRevokeAccess(user.email)}
                      disabled={isActionLoading || (isAdmin && adminCount <= 1)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                      title={
                        isAdmin && adminCount <= 1
                          ? "Cannot remove the only admin"
                          : "Revoke access completely"
                      }
                    >
                      {isActionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Role Capabilities Info */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>
              <strong>Admins</strong> have full write & scheduling control. <strong>Viewers</strong> have read-only live monitoring & export access.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
