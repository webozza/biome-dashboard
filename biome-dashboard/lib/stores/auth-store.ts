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

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  initialized: false,
  user: null,
  login: async (email, password) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      set({ isAuthenticated: true, user: mapUser(cred.user), initialized: true });
      return true;
    } catch {
      return false;
    }
  },
  loginWithGoogle: async () => {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      set({ isAuthenticated: true, user: mapUser(cred.user), initialized: true });
      return true;
    } catch {
      return false;
    }
  },
  logout: async () => {
    await signOut(auth);
    set({ isAuthenticated: false, user: null });
  },
}));

if (typeof window !== "undefined") {
  onAuthStateChanged(auth, (u) => {
    useAuthStore.setState({
      isAuthenticated: !!u,
      user: mapUser(u),
      initialized: true,
    });
  });
}
