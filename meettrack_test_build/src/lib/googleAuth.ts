import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
  Auth
} from 'firebase/auth';

// Support Vercel environment variables with built-in fallbacks (OAuth client only)
const metaEnv: Record<string, string | undefined> = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || "AIzaSyAfAfO8ZfjjAQmQ6zpzsP7nHRln2_8R008",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "meet-7622a.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "meet-7622a",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "meet-7622a.firebasestorage.app",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "427012603512",
  appId: metaEnv.VITE_FIREBASE_APP_ID || "1:427012603512:web:e0c40cc1433024ff3f378d",
};

let app: any = null;
let authInstance: Auth | null = null;

try {
  if (firebaseConfig && firebaseConfig.apiKey) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(app);
  }
} catch (e) {
  console.warn("[Firebase Auth] Initialization notice:", e);
}

export const auth = authInstance;

// Standard Google Auth Provider for Login (Profile & Email only to prevent 403 Restricted Scope blocks)
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// Enhanced Provider with Calendar Scopes (Only requested when user triggers Calendar Sync)
export const calendarProvider = new GoogleAuthProvider();
calendarProvider.addScope('https://www.googleapis.com/auth/calendar');
calendarProvider.addScope('https://www.googleapis.com/auth/calendar.events');
calendarProvider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const clearCachedToken = () => {
  cachedAccessToken = null;
  localStorage.removeItem('meettrack_google_token');
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
  try {
    // Check if returning from redirect sign-in
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const token = credential?.accessToken || "";
          cachedAccessToken = token;
          if (token) localStorage.setItem('meettrack_google_token', token);
          if (onAuthSuccess) onAuthSuccess(result.user, token);
        }
      })
      .catch((err) => {
        console.warn("[Firebase Auth] Redirect result notice:", err);
      });

    return onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        const savedToken = localStorage.getItem('meettrack_google_token') || cachedAccessToken || "";
        cachedAccessToken = savedToken;
        if (onAuthSuccess) onAuthSuccess(user, savedToken);
      } else {
        cachedAccessToken = null;
        localStorage.removeItem('meettrack_google_token');
        if (onAuthFailure) onAuthFailure();
      }
    });
  } catch (e) {
    console.warn("initAuth error:", e);
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  if (!auth) {
    throw new Error("Firebase Authentication is not initialized. Please verify your Firebase project setup.");
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || "";

    cachedAccessToken = token;
    if (token) {
      localStorage.setItem('meettrack_google_token', token);
    }

    return { user: result.user, accessToken: token };
  } catch (error: any) {
    console.error('[Firebase Auth] Sign in error:', error);
    
    // Check for unauthorized domain
    if (error.code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'your domain';
      throw new Error(
        `UNAUTHORIZED_DOMAIN: Domain "${currentHost}" is not authorized in your Firebase Console. Add "${currentHost}" in Firebase Console > Authentication > Settings > Authorized domains.`
      );
    }
    
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed before completing. Please click "Continue with Google" again.');
    }
    
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups for this site, or try again.');
    }

    if (error.code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in request was cancelled. Please click to try again.');
    }

    throw new Error(error.message || 'Failed to sign in with Google. Please try again.');
  } finally {
    isSigningIn = false;
  }
};

export const googleSignInRedirect = async (): Promise<void> => {
  if (!auth) {
    throw new Error("Firebase Auth not initialized");
  }
  await signInWithRedirect(auth, provider);
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem('meettrack_google_token');
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem('meettrack_google_token', token);
  } else {
    localStorage.removeItem('meettrack_google_token');
  }
};

export const logout = async () => {
  if (auth) {
    await signOut(auth);
  }
  cachedAccessToken = null;
  localStorage.removeItem('meettrack_google_token');
};
