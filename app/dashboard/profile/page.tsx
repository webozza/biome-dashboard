"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { auth, db } from "@/lib/firebase-client";
import { doc, getDoc } from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
} from "firebase/auth";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  Loader2,
  Mail,
  User as UserIcon,
  Shield,
  Calendar,
  Fingerprint,
  Lock,
  KeyRound,
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

type ProfileDoc = {
  displayName?: string;
  email?: string;
  photoURL?: string | null;
  bio?: string;
  provider?: string;
  createdAt?: { seconds: number } | null;
  updatedAt?: { seconds: number } | null;
  [key: string]: unknown;
};

function formatTs(ts: { seconds: number } | null | undefined) {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleString();
}

function mapAuthError(code: string, fallback: string) {
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Your current password is incorrect.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 6 characters).";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/requires-recent-login":
      return "Please sign out and sign in again, then retry.";
    case "auth/user-not-found":
      return "No account found for this email.";
    default:
      return fallback;
  }
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Change password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwNotice, setPwNotice] = useState<string | null>(null);

  // Reset email state
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  // Show/hide toggles
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Post-update session prompt
  const [sessionPromptOpen, setSessionPromptOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = auth.currentUser;
      if (!u) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (cancelled) return;
        setProfile(snap.exists() ? (snap.data() as ProfileDoc) : null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const displayName = profile?.displayName || user?.name || "—";
  const email = profile?.email || user?.email || "—";
  const photoURL = profile?.photoURL || user?.photoURL;
  const provider = profile?.provider || "—";
  const bio = profile?.bio || "";
  const isPasswordProvider = provider === "password" || provider === "—";

  const canSubmitPw =
    !pwBusy &&
    currentPw.length > 0 &&
    newPw.length >= 6 &&
    newPw === confirmPw &&
    isPasswordProvider;

  const handleChangePassword = async () => {
    setPwError(null);
    setPwNotice(null);
    const u = auth.currentUser;
    if (!u?.email) {
      setPwError("This account has no email associated.");
      return;
    }
    try {
      setPwBusy(true);
      const cred = EmailAuthProvider.credential(u.email, currentPw);
      await reauthenticateWithCredential(u, cred);
      await updatePassword(u, newPw);
      setPwNotice("Password updated successfully.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setSessionPromptOpen(true);
    } catch (e) {
      const code = (e as { code?: string })?.code || "";
      const msg = (e as Error)?.message || "Please try again.";
      setPwError(mapAuthError(code, msg));
    } finally {
      setPwBusy(false);
    }
  };

  const handleSendResetEmail = async () => {
    setResetError(null);
    setResetNotice(null);
    const target = user?.email || auth.currentUser?.email;
    if (!target) {
      setResetError("No email associated with this account.");
      return;
    }
    try {
      setResetBusy(true);
      await sendPasswordResetEmail(auth, target);
      setResetNotice(`Password reset link sent to ${target}.`);
    } catch (e) {
      const code = (e as { code?: string })?.code || "";
      const msg = (e as Error)?.message || "Failed to send reset email.";
      setResetError(mapAuthError(code, msg));
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-main">Profile</h1>
        <p className="text-sm text-muted mt-1">Your account details</p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="p-8 flex items-center gap-5 border-b border-border">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-2xl font-bold overflow-hidden ring-1 ring-border">
            {photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="uppercase">{displayName.charAt(0)}</span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-main truncate">{displayName}</h2>
            <p className="text-sm text-muted truncate">{email}</p>
            {bio && <p className="text-sm text-muted/80 mt-1 line-clamp-2">{bio}</p>}
          </div>
        </div>

        <div className="divide-y divide-border">
          <Row icon={UserIcon} label="Display Name" value={displayName} />
          <Row icon={Mail} label="Email" value={email} />
          <Row icon={Fingerprint} label="User ID" value={user?.uid || "—"} mono />
          <Row icon={Shield} label="Provider" value={provider} />
          <Row icon={Calendar} label="Created" value={formatTs(profile?.createdAt)} />
          <Row icon={Calendar} label="Updated" value={formatTs(profile?.updatedAt)} />
        </div>
      </div>

      {/* Security Section */}
      <div className="card p-8 space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-main tracking-tight">Security</h3>
            <p className="text-sm text-muted mt-0.5">Manage your password</p>
          </div>
        </div>

        {/* Change Password */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted">
            <KeyRound className="w-3.5 h-3.5" />
            Change Password
          </div>

          {!isPasswordProvider ? (
            <p className="text-sm text-muted bg-surface-hover border border-border rounded-xl px-4 py-3">
              Your account uses {provider} sign-in. Password changes are managed by your provider.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-2">
                    Current password
                  </label>
                  <PasswordInput
                    value={currentPw}
                    onChange={setCurrentPw}
                    show={showCurrent}
                    onToggle={() => setShowCurrent((v) => !v)}
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-2">
                    New password
                  </label>
                  <PasswordInput
                    value={newPw}
                    onChange={setNewPw}
                    show={showNew}
                    onToggle={() => setShowNew((v) => !v)}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-2">
                    Confirm new password
                  </label>
                  <PasswordInput
                    value={confirmPw}
                    onChange={setConfirmPw}
                    show={showConfirm}
                    onToggle={() => setShowConfirm((v) => !v)}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleChangePassword}
                  disabled={!canSubmitPw}
                  className="btn-primary flex items-center gap-2"
                >
                  {pwBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Update Password
                </button>
                {newPw.length > 0 && newPw.length < 6 && (
                  <span className="text-xs text-amber-600 font-medium">At least 6 characters</span>
                )}
                {confirmPw.length > 0 && newPw !== confirmPw && (
                  <span className="text-xs text-amber-600 font-medium">Passwords do not match</span>
                )}
              </div>

              {pwNotice && (
                <div className="px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 text-xs font-bold text-primary flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {pwNotice}
                </div>
              )}
              {pwError && (
                <div className="px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/20 text-xs font-bold text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {pwError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Reset Email */}
        <div className="space-y-4 pt-6 border-t border-border">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted">
            <Send className="w-3.5 h-3.5" />
            Forgot your password?
          </div>
          <p className="text-sm text-muted">
            We&apos;ll email you a link to reset your password. Useful if you don&apos;t remember your current
            password.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSendResetEmail}
              disabled={resetBusy || !email || email === "—"}
              className="btn-secondary flex items-center gap-2"
            >
              {resetBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Reset Email
            </button>
            <span className="text-xs text-muted">to {email}</span>
          </div>

          {resetNotice && (
            <div className="px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 text-xs font-bold text-primary flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {resetNotice}
            </div>
          )}
          {resetError && (
            <div className="px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/20 text-xs font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              {resetError}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={sessionPromptOpen}
        title="Password updated"
        message={
          <>
            Your password was changed successfully. For security, we recommend signing out and
            logging in again with your new password. Or you can stay signed in on this device.
          </>
        }
        confirmLabel="Logout & Re-login"
        cancelLabel="Stay Signed In"
        tone="primary"
        loading={signingOut}
        onConfirm={async () => {
          try {
            setSigningOut(true);
            await logout();
            router.push("/login");
          } finally {
            setSigningOut(false);
            setSessionPromptOpen(false);
          }
        }}
        onCancel={() => setSessionPromptOpen(false)}
      />
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full input-premium pr-11"
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-main transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3 text-sm text-muted">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div
        className={`text-sm text-main text-right truncate max-w-[60%] ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
