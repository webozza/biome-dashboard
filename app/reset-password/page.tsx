"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { readJson } from "@/lib/http";

export default function ResetPasswordRequestPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const target = email.trim().toLowerCase();
    if (!target) return;

    try {
      setBusy(true);
      const resp = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      await readJson(resp);
      setNotice(`OTP sent to ${target}.`);
      router.push(`/reset-password/verify?email=${encodeURIComponent(target)}`);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Failed to send OTP.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600 hover:text-emerald-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>

        <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm">
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Reset password</h1>
          <p className="text-sm text-neutral-500 mt-2">
            Enter your admin email. We&apos;ll send a 6-digit OTP code.
          </p>

          <form onSubmit={handleSend} className="space-y-5 mt-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full bg-white border border-neutral-200 rounded-lg pl-10 pr-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 transition-colors"
                />
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              </div>
            </div>

            {notice && (
              <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {notice}
              </div>
            )}
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send OTP"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

