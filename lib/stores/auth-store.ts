"use client";

import { create } from "zustand";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase-client";

type Role = "super_admin" | "readonly";

interface SessionUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  role: Role;
  isAdmin: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  initialized: boolean;
  apiToken: string | null;
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const API_TOKEN_STORAGE_KEY = "biome-admin-api-token";

function readStoredApiToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(API_TOKEN_STORAGE_KEY);
}

function writeStoredApiToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(API_TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(API_TOKEN_STORAGE_KEY);
  }
}

type SessionResponse = {
  token: string | null;
  user: { uid: string; email: string | null; role: Role; isAdmin: boolean };
};

async function exchangeSession(u: User): Promise<SessionResponse | null> {
  try {
    const idToken = await u.getIdToken();
    const resp = await fetch("/api/auth/session", {
      method: "POST",
      headers: { authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return null;
    return (await resp.json()) as SessionResponse;
  } catch {
    return null;
  }
}

function buildUser(u: User, session: SessionResponse): SessionUser {
  return {
    uid: u.uid,
    name: u.displayName || u.email?.split("@")[0] || "User",
    email: u.email || session.user.email || "",
    photoURL: u.photoURL || null,
    role: session.user.role,
    isAdmin: session.user.isAdmin,
  };
}

async function applySession(u: User) {
  const session = await exchangeSession(u);
  if (!session) {
    await signOut(auth).catch(() => undefined);
    writeStoredApiToken(null);
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      initialized: true,
      apiToken: null,
    });
    return false;
  }
  writeStoredApiToken(session.token);
  useAuthStore.setState({
    isAuthenticated: true,
    user: buildUser(u, session),
    initialized: true,
    apiToken: session.token,
  });
  return true;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  initialized: false,
  apiToken: readStoredApiToken(),
  user: null,
  login: async (email, password) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return await applySession(cred.user);
    } catch {
      await signOut(auth).catch(() => undefined);
      writeStoredApiToken(null);
      set({ isAuthenticated: false, user: null, initialized: true, apiToken: null });
      return false;
    }
  },
  loginWithGoogle: async () => {
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      return await applySession(cred.user);
    } catch {
      await signOut(auth).catch(() => undefined);
      writeStoredApiToken(null);
      set({ isAuthenticated: false, user: null, initialized: true, apiToken: null });
      return false;
    }
  },
  logout: async () => {
    await signOut(auth);
    writeStoredApiToken(null);
    set({ isAuthenticated: false, user: null, apiToken: null });
  },
}));

if (typeof window !== "undefined") {
  onAuthStateChanged(auth, async (u) => {
    if (!u) {
      writeStoredApiToken(null);
      useAuthStore.setState({
        isAuthenticated: false,
        user: null,
        initialized: true,
        apiToken: null,
      });
      return;
    }
    await applySession(u);
  });
}
