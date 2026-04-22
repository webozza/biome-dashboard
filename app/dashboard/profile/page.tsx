"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { auth, db } from "@/lib/firebase-client";
import { doc, getDoc } from "firebase/firestore";
import { Loader2, Mail, User as UserIcon, Shield, Calendar, Fingerprint } from "lucide-react";

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

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const displayName = profile?.displayName || user?.name || "—";
  const email = profile?.email || user?.email || "—";
  const photoURL = profile?.photoURL || user?.photoURL;
  const provider = profile?.provider || "—";
  const bio = profile?.bio || "";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-sm text-neutral-400 mt-1">Your account details</p>
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-neutral-950 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-8 flex items-center gap-5 border-b border-white/5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-900 flex items-center justify-center text-white text-2xl font-bold overflow-hidden ring-1 ring-white/10">
            {photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoURL} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="uppercase">{displayName.charAt(0)}</span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-white truncate">{displayName}</h2>
            <p className="text-sm text-neutral-400 truncate">{email}</p>
            {bio && <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{bio}</p>}
          </div>
        </div>

        <div className="divide-y divide-white/5">
          <Row icon={UserIcon} label="Display Name" value={displayName} />
          <Row icon={Mail} label="Email" value={email} />
          <Row icon={Fingerprint} label="User ID" value={user?.uid || "—"} mono />
          <Row icon={Shield} label="Provider" value={provider} />
          <Row icon={Calendar} label="Created" value={formatTs(profile?.createdAt)} />
          <Row icon={Calendar} label="Updated" value={formatTs(profile?.updatedAt)} />
        </div>
      </div>
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
      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div
        className={`text-sm text-white text-right truncate max-w-[60%] ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
