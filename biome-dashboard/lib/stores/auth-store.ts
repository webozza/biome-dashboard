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

interface AuthState {
  isAuthenticated: boolean;
  initialized: boolean;
  apiToken: string | null;
  user: {
    uid: string;
    name: string;
    email: string;
    photoURL: string | null;
    role: "super_admin" | "moderator" | "readonly";
  } | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
}

function mapUser(u: User | null) {
  if (!u) return null;
  return {
    uid: u.uid,
    name: u.displayName || u.email?.split("@")[0] || "Admin",
    email: u.email || "",
    photoURL: u.photoURL || null,
    role: "super_admin" as const,
  };
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

async function exchangeIdTokenForApiToken(u: User): Promise<string | null> {
  try {
    const idToken = await u.getIdToken();
    const resp = await fetch("/api/auth/session", {
      method: "POST",
      headers: { authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  initialized: false,
  apiToken: readStoredApiToken(),
  user: null,
  login: async (email, password) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      let apiToken: string | null = null;
      if (resp.ok) {
        const data = (await resp.json()) as { token?: string };
        apiToken = data.token ?? null;
      }
      if (!apiToken) {
        apiToken = await exchangeIdTokenForApiToken(cred.user);
      }
      if (!apiToken) throw new Error("missing_api_token");
      writeStoredApiToken(apiToken);
      set({
        isAuthenticated: true,
        user: mapUser(cred.user),
        initialized: true,
        apiToken,
      });
      return true;
    } catch {
      await signOut(auth).catch(() => undefined);
      writeStoredApiToken(null);
      set({ isAuthenticated: false, user: null, initialized: true, apiToken: null });
      return false;
    }
  },
  loginWithGoogle: async () => {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const apiToken = await exchangeIdTokenForApiToken(cred.user);
      if (!apiToken) throw new Error("missing_api_token");
      writeStoredApiToken(apiToken);
      set({
        isAuthenticated: true,
        user: mapUser(cred.user),
        initialized: true,
        apiToken,
      });
      return true;
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

    let apiToken = readStoredApiToken();
    if (!apiToken) {
      apiToken = await exchangeIdTokenForApiToken(u);
      if (apiToken) writeStoredApiToken(apiToken);
    }

    useAuthStore.setState({
      isAuthenticated: true,
      user: mapUser(u),
      initialized: true,
      apiToken,
    });
  });
}
