"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase-client";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function BmidLoginPage() {
  const router = useRouter();
  const initialized = useAuthStore((s) => s.initialized);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialized && isAuthenticated) router.replace("/bmid");
  }, [initialized, isAuthenticated, router]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/bmid");
    } catch {
      setError("Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.replace("/bmid");
    } catch {
      setError("Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-950 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">BMID User Portal</h1>
          <p className="mt-2 text-sm text-neutral-400">Sign in as a normal user to transfer posts, respond to duality, and vote.</p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 pr-11 text-sm text-white outline-none focus:border-emerald-500"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-300">{error}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</span> : "Sign In"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={loading}
          className="mt-4 w-full rounded-xl border border-white/10 bg-white py-3 text-sm font-medium text-black hover:bg-neutral-100 disabled:opacity-60"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
