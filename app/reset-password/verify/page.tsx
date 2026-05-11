"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Hash, Loader2, Lock } from "lucide-react";
import { readJson } from "@/lib/http";

export default function ResetPasswordVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = useMemo(() => (searchParams.get("email") || "").trim().toLowerCase(), [searchParams]);

  const [otp, setOtp] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled =
    busy || !email || otp.length !== 6 || newPw.length < 6 || newPw !== confirmPw;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Missing email. Go back and enter your email again.");
      return;
    }
    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }
    if (newPw.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setBusy(true);
      const resp = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword: newPw }),
      });
      await readJson(resp);
      router.replace("/login?reset=success");
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => router.push("/reset-password")}
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600 hover:text-emerald-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm">
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Verify OTP</h1>
          <p className="text-sm text-neutral-500 mt-2">
            Enter the 6-digit code we sent to <span className="font-semibold text-neutral-800">{email || "your email"}</span>.
          </p>

          <form onSubmit={handleReset} className="space-y-5 mt-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                6-digit OTP
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\\D/g, "").slice(0, 6))}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    const digits = text.replace(/\D/g, "").slice(0, 6);
                    if (!digits) return;
                    e.preventDefault();
                    setOtp(digits);
                  }}
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="w-full bg-white border border-neutral-200 rounded-lg pl-10 pr-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 transition-colors font-mono tracking-widest"
                />
                <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                New password
              </label>
              <div className="relative">
                <input
                  type={showNewPw ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-white border border-neutral-200 rounded-lg pl-10 pr-11 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 transition-colors"
                />
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPw ? "text" : "password"}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-white border border-neutral-200 rounded-lg pl-10 pr-11 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 transition-colors"
                />
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={disabled}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset password"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
