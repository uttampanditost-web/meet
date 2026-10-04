import { UserRole } from "../types";
import { supabase } from "./supabaseService";

export interface AppUser {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  createdAt: string;
  lastSeen?: string;
  avatarUrl?: string;
}

// Built-in SuperAdmin & Root Admin accounts (Permanent hardcoded guarantee)
export const SUPERADMIN_EMAIL = "ukumar339@gmail.com";
export const SUPERADMIN_EMAILS = [
  "ukumar339@gmail.com",
  "uttam.pandit.ost@houseofedtech.in"
];
export const SUPERADMIN_DEFAULT_PASSWORD = "Uttam@kumar007";

const DEFAULT_USERS: AppUser[] = [
  {
    id: "user-superadmin-01",
    email: "ukumar339@gmail.com",
    password: SUPERADMIN_DEFAULT_PASSWORD,
    name: "Uttam Kumar",
    role: "admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastSeen: new Date().toISOString(),
  },
  {
    id: "user-admin-uttam-pandit",
    email: "uttam.pandit.ost@houseofedtech.in",
    password: SUPERADMIN_DEFAULT_PASSWORD,
    name: "Uttam",
    role: "admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastSeen: new Date().toISOString(),
  },
  {
    id: "user-mentor-be10x",
    email: "externalmentors@be10x.com",
    password: "Password@123",
    name: "Mentors Be10x",
    role: "admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastSeen: new Date().toISOString(),
  },
  {
    id: "user-soudeep-roy",
    email: "soudeep.roy@houseofedtech.in",
    password: "Password@123",
    name: "Soudeep Roy",
    role: "admin",
    createdAt: "2026-08-22T00:00:00.000Z",
    lastSeen: "2026-08-22T20:02:29.000Z",
  },
  {
    id: "user-ombilaiya01",
    email: "ombilaiya01@gmail.com",
    password: "Password@123",
    name: "ombilaiya01",
    role: "admin",
    createdAt: "2026-09-05T00:00:00.000Z",
    lastSeen: new Date().toISOString(),
  },
];

const STORAGE_USERS_KEY = "meettrack_app_users_v2";
const STORAGE_SESSION_KEY = "meettrack_auth_session_user";
const STORAGE_DELETED_USERS_KEY = "meettrack_deleted_users_v2";
const STORAGE_INIT_KEY = "meettrack_users_initialized_v2";

export const getDeletedUserEmails = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_USERS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map((e: string) => String(e).trim().toLowerCase()));
      }
    }
  } catch {}
  return new Set<string>();
};

export const addDeletedUserEmail = (email: string) => {
  const clean = email.trim().toLowerCase();
  if (SUPERADMIN_EMAILS.some((e) => e.toLowerCase() === clean)) return;
  const set = getDeletedUserEmails();
  set.add(clean);
  try {
    localStorage.setItem(STORAGE_DELETED_USERS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
};

export const removeDeletedUserEmail = (email: string) => {
  const set = getDeletedUserEmails();
  set.delete(email.trim().toLowerCase());
  try {
    localStorage.setItem(STORAGE_DELETED_USERS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
};

/**
 * Load all registered users from Server API, Supabase (user_access table), or LocalStorage
 */
export const loadAllUsers = async (): Promise<AppUser[]> => {
  const deletedEmails = getDeletedUserEmails();
  const map = new Map<string, AppUser>();

  // 1. Always seed base defaults
  DEFAULT_USERS.forEach((u) => {
    if (!deletedEmails.has(u.email.toLowerCase())) {
      map.set(u.email.toLowerCase(), u);
    }
  });

  // 2. Load from LocalStorage
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((u: AppUser) => {
          if (u && u.email && !deletedEmails.has(u.email.toLowerCase())) {
            map.set(u.email.toLowerCase(), { ...map.get(u.email.toLowerCase()), ...u });
          }
        });
      }
    }
  } catch {}

  // 3. Load from Supabase primary cloud database (user_access table)
  try {
    if (supabase) {
      const { data, error } = await supabase.from("user_access").select("*");
      if (!error && Array.isArray(data) && data.length > 0) {
        data.forEach((u: any) => {
          if (u && u.email) {
            const clean = String(u.email).trim().toLowerCase();
            if (!deletedEmails.has(clean)) {
              let extractedPassword = "Password@123";
              let lastSeenTime = u.granted_at || new Date().toISOString();
              if (u.granted_by) {
                try {
                  const meta = JSON.parse(u.granted_by);
                  if (meta && meta.password) extractedPassword = meta.password;
                  if (meta && meta.lastSeen) lastSeenTime = meta.lastSeen;
                } catch {}
              }
              const existing = map.get(clean);
              map.set(clean, {
                id: u.id || existing?.id || `user-${clean.replace(/[^a-z0-9]/g, "-")}`,
                email: clean,
                password: existing?.password || extractedPassword,
                name: u.name || existing?.name || clean.split("@")[0],
                role: u.role === "admin" ? "admin" : "viewer",
                createdAt: u.granted_at || existing?.createdAt || new Date().toISOString(),
                lastSeen: existing?.lastSeen || lastSeenTime,
              });
            }
          }
        });
      }
    }
  } catch (err) {
    console.warn("Supabase user_access load notice:", err);
  }

  // 4. Load from Server API (/api/users) for multi-browser / cross-device synchronization
  try {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.users)) {
        data.users.forEach((u: any) => {
          if (u && u.email) {
            const clean = String(u.email).trim().toLowerCase();
            if (!deletedEmails.has(clean)) {
              const existing = map.get(clean);
              map.set(clean, {
                id: u.id || existing?.id || `user-${clean.replace(/[^a-z0-9]/g, "-")}`,
                email: clean,
                password: u.password || existing?.password || "Password@123",
                name: u.name || existing?.name || clean.split("@")[0],
                role: u.role === "admin" ? "admin" : "viewer",
                createdAt: u.createdAt || existing?.createdAt || new Date().toISOString(),
                lastSeen: u.lastSeen || existing?.lastSeen || new Date().toISOString(),
              });
            }
          }
        });
      }
    }
  } catch {}

  // Always enforce permanent root Admins
  SUPERADMIN_EMAILS.forEach((admEmail) => {
    const existing = map.get(admEmail.toLowerCase());
    map.set(admEmail.toLowerCase(), {
      id: existing?.id || (admEmail === "ukumar339@gmail.com" ? "user-superadmin-01" : "user-admin-uttam-pandit"),
      email: admEmail,
      password: SUPERADMIN_DEFAULT_PASSWORD,
      name: existing?.name || (admEmail === "ukumar339@gmail.com" ? "Uttam Kumar" : "Uttam"),
      role: "admin",
      createdAt: existing?.createdAt || "2026-01-01T00:00:00.000Z",
      lastSeen: existing?.lastSeen || new Date().toISOString(),
    });
  });

  const combined = Array.from(map.values()).filter(
    (u) => SUPERADMIN_EMAILS.some((e) => e.toLowerCase() === u.email.toLowerCase()) || !deletedEmails.has(u.email.toLowerCase())
  );

  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(combined));
  } catch {}

  return combined;
};

/**
 * Authenticate user with email and password
 */
export const authenticateUser = async (
  emailInput: string,
  passwordInput: string
): Promise<{ success: boolean; user?: AppUser; error?: string }> => {
  const cleanEmail = (emailInput || "").trim().toLowerCase();
  const cleanPass = (passwordInput || "").trim();

  if (!cleanEmail) {
    return { success: false, error: "Please enter your email address." };
  }
  if (!cleanPass) {
    return { success: false, error: "Please enter your password." };
  }

  // 1. Instant Root Admin guarantee check for primary emails
  const isRootAdmin = SUPERADMIN_EMAILS.some((e) => e.toLowerCase() === cleanEmail);
  if (isRootAdmin && cleanPass === SUPERADMIN_DEFAULT_PASSWORD) {
    const adminUser: AppUser = {
      id: cleanEmail === "ukumar339@gmail.com" ? "user-superadmin-01" : "user-admin-uttam-pandit",
      email: cleanEmail,
      name: cleanEmail === "ukumar339@gmail.com" ? "Uttam Kumar (Admin)" : "Uttam (Admin)",
      role: "admin",
      createdAt: "2026-01-01T00:00:00.000Z",
      lastSeen: new Date().toISOString(),
    };
    saveUserSession(adminUser);
    return { success: true, user: adminUser };
  }

  // 2. Load all users from backend, Supabase, and local storage
  const users = await loadAllUsers();
  const matched = users.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!matched) {
    return { success: false, error: "No account found with this email. Please contact an administrator." };
  }

  // Password verification: allow account password, SUPERADMIN_DEFAULT_PASSWORD, or default password
  const allowedPasswords = [
    matched.password,
    "Password@123",
    ...(matched.role === "admin" ? [SUPERADMIN_DEFAULT_PASSWORD] : []),
  ].filter(Boolean);
  const isValid = allowedPasswords.length === 0 || allowedPasswords.includes(cleanPass);

  if (!isValid) {
    return { success: false, error: "Incorrect password. Please try again." };
  }

  // Update last seen
  matched.lastSeen = new Date().toISOString();
  saveUserSession(matched);
  saveUser(matched).catch(() => {});

  return { success: true, user: matched };
};

/**
 * Save user to Server Backend, Supabase (user_access table), and LocalStorage
 */
export const saveUser = async (user: AppUser): Promise<void> => {
  const cleanEmail = user.email.trim().toLowerCase();
  removeDeletedUserEmail(cleanEmail);

  const cleanId = user.id || `user-${cleanEmail.replace(/[^a-z0-9]/g, "-")}`;
  const updatedUser: AppUser = {
    ...user,
    id: cleanId,
    email: cleanEmail,
    role: user.role === "admin" ? "admin" : "viewer",
    lastSeen: user.lastSeen || new Date().toISOString(),
    createdAt: user.createdAt || new Date().toISOString(),
  };

  // 1. LocalStorage
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    let users: AppUser[] = raw ? JSON.parse(raw) : [];
    const idx = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...updatedUser };
    } else {
      users.push(updatedUser);
    }
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch {}

  // 2. Primary Cloud Database (Supabase user_access table)
  try {
    if (supabase) {
      const grantMeta = JSON.stringify({
        password: updatedUser.password || "Password@123",
        grantedBy: "admin",
        lastSeen: updatedUser.lastSeen,
      });
      await supabase.from("user_access").upsert(
        {
          id: cleanId,
          email: cleanEmail,
          role: updatedUser.role,
          name: updatedUser.name || cleanEmail.split("@")[0],
          granted_at: updatedUser.createdAt || new Date().toISOString(),
          granted_by: grantMeta,
        },
        { onConflict: "id" }
      );
    }
  } catch (err) {
    console.warn("Supabase save user_access notice:", err);
  }

  // 3. Server API Backend (/api/users) - syncs to data_store.json for cross-device access
  try {
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedUser),
    });
  } catch (err) {
    console.warn("Server user save notice:", err);
  }
};

/**
 * Delete / revoke user access from Server, Supabase (user_access table), and LocalStorage
 */
export const deleteUser = async (email: string): Promise<boolean> => {
  const cleanEmail = email.trim().toLowerCase();
  if (SUPERADMIN_EMAILS.some((e) => e.toLowerCase() === cleanEmail)) {
    throw new Error("Cannot delete built-in SuperAdmin accounts.");
  }

  // 1. Record in deleted set so they never revive
  addDeletedUserEmail(cleanEmail);

  // 2. Remove from LocalStorage
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      const parsed: AppUser[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((u) => u.email.toLowerCase() !== cleanEmail);
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(filtered));
      }
    }
  } catch {}

  // 3. Clear active session if this was the current logged in user
  const activeSession = getActiveUserSession();
  if (activeSession && activeSession.email.toLowerCase() === cleanEmail) {
    clearUserSession();
  }

  // 4. Broadcast revocation event to all open browser tabs/windows
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("meettrack_realtime");
      bc.postMessage({ type: "USER_ACCESS_REVOKED", email: cleanEmail });
      bc.close();
    }
  } catch {}

  // 5. Remove from Server Backend (/api/users and /api/access/users)
  try {
    await Promise.allSettled([
      fetch(`/api/users/${encodeURIComponent(cleanEmail)}`, { method: "DELETE" }),
      fetch(`/api/access/users/${encodeURIComponent(cleanEmail)}?requesterEmail=${encodeURIComponent(activeSession?.email || "ukumar339@gmail.com")}`, { method: "DELETE" }),
    ]);
  } catch (err) {
    console.warn("Server user delete notice:", err);
  }

  // 6. Delete from Supabase user_access
  try {
    if (supabase) {
      await supabase.from("user_access").delete().eq("email", cleanEmail);
      await supabase.from("user_access").delete().eq("id", `user-${cleanEmail.replace(/[^a-z0-9]/g, "-")}`);
    }
  } catch (err) {
    console.warn("Supabase delete user_access notice:", err);
  }

  return true;
};

/**
 * Session persistence
 */
export const saveUserSession = (user: AppUser) => {
  try {
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(user));
  } catch {}
};

export const getActiveUserSession = (): AppUser | null => {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.email) {
        const deleted = getDeletedUserEmails();
        if (deleted.has(user.email.trim().toLowerCase())) {
          localStorage.removeItem(STORAGE_SESSION_KEY);
          return null;
        }
        return user;
      }
    }
  } catch {}
  return null;
};

export const clearUserSession = () => {
  try {
    localStorage.removeItem(STORAGE_SESSION_KEY);
  } catch {}
};

/**
 * Check if the current logged-in user is still active in the database or server
 */
export const verifyActiveUserSession = async (): Promise<boolean> => {
  const session = getActiveUserSession();
  if (!session || !session.email) return false;
  const cleanEmail = session.email.trim().toLowerCase();

  // Root SuperAdmins always retain valid sessions
  if (SUPERADMIN_EMAILS.some((e) => e.toLowerCase() === cleanEmail)) {
    return true;
  }

  // Check if locally marked as deleted
  const deleted = getDeletedUserEmails();
  if (deleted.has(cleanEmail)) {
    clearUserSession();
    return false;
  }

  // Verify against authoritative server role
  try {
    const res = await fetch(`/api/auth/role?email=${encodeURIComponent(cleanEmail)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.hasAccess === false) {
        clearUserSession();
        return false;
      }
    }
  } catch (e) {}

  return true;
};

export const initUserDatabase = loadAllUsers;

