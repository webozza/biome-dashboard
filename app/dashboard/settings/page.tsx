"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings, Save, Mail, Loader2, CheckCircle2, AlertCircle, Plug, Trash2, Send } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

type GmailStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt?: string | null;
  connectedBy?: string | null;
  reason?: string;
};

export default function SettingsPage() {
  const apiToken = useAuthStore((s) => s.apiToken);
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailAction, setGmailAction] = useState<"connect" | "disconnect" | "test" | null>(null);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [gmailNotice, setGmailNotice] = useState<string | null>(null);
  const [testTarget, setTestTarget] = useState<string>("");

  const fetchGmailStatus = async () => {
    if (!apiToken) return;
    try {
      setGmailLoading(true);
      const resp = await fetch("/api/settings/gmail", {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      const data = (await resp.json()) as GmailStatus;
      setGmailStatus(data);
      setGmailError(null);
    } catch (e) {
      setGmailError((e as Error).message);
    } finally {
      setGmailLoading(false);
    }
  };

  useEffect(() => {
    void fetchGmailStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken]);

  useEffect(() => {
    if (!searchParams) return;
    const status = searchParams.get("gmail");
    if (!status) return;
    if (status === "connected") setGmailNotice("Gmail account connected successfully.");
    else if (status === "error") {
      const detail = searchParams.get("detail");
      setGmailError(detail ? decodeURIComponent(detail) : "Google returned an error.");
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("gmail");
    url.searchParams.delete("detail");
    router.replace(url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
    void fetchGmailStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleConnectGmail = async () => {
    if (!apiToken) return;
    try {
      setGmailAction("connect");
      setGmailError(null);
      const resp = await fetch("/api/settings/gmail/auth-url", {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { detail?: string; error?: string };
        throw new Error(data.detail || data.error || "Failed to get auth URL");
      }
      const { url } = (await resp.json()) as { url: string };
      window.location.href = url;
    } catch (e) {
      setGmailError((e as Error).message);
      setGmailAction(null);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!apiToken) return;
    if (!confirm("Disconnect the connected Gmail account? Emails will fall back to SMTP env vars.")) return;
    try {
      setGmailAction("disconnect");
      setGmailError(null);
      const resp = await fetch("/api/settings/gmail", {
        method: "DELETE",
        headers: { authorization: `Bearer ${apiToken}` },
      });
      if (!resp.ok) throw new Error("Failed to disconnect");
      setGmailNotice("Gmail account disconnected.");
      await fetchGmailStatus();
    } catch (e) {
      setGmailError((e as Error).message);
    } finally {
      setGmailAction(null);
    }
  };

  const handleTestGmail = async () => {
    if (!apiToken) return;
    const to = testTarget.trim() || user?.email || "";
    if (!to) {
      setGmailError("Enter an address to send the test email to.");
      return;
    }
    try {
      setGmailAction("test");
      setGmailError(null);
      const resp = await fetch("/api/settings/gmail/test", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ to }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        transport?: string;
        fromEmail?: string;
        detail?: string;
        error?: string;
      };
      if (!resp.ok || !data.ok) throw new Error(data.detail || data.error || "Send failed");
      setGmailNotice(
        `Test email sent to ${to} via ${data.transport}${data.fromEmail ? ` (from ${data.fromEmail})` : ""}.`
      );
    } catch (e) {
      setGmailError((e as Error).message);
    } finally {
      setGmailAction(null);
    }
  };

  const [settings, setSettings] = useState({
    allowedPlatforms: ["tiktok", "instagram", "youtube", "facebook", "twitter"],
    voteThreshold: 50,
    votingDuration: 7,
    bmidFormat: "BMID-{NUMBER}",
    notificationEmail: true,
    notificationPush: true,
    autoCloseVoting: true,
    requireAdminApproval: true,
  });

  const allPlatforms = ["tiktok", "instagram", "youtube", "facebook", "twitter", "reddit", "linkedin", "snapchat"];

  const handleSave = () => {
    alert("Settings synchronized successfully (Ledger Update)");
  };

  return (
    <div className="space-y-8 max-w-4xl animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary font-bold shadow-sm">
            <Settings className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-main">System Governance</h1>
            <p className="text-sm text-muted font-medium italic">Configure operational parameters and node protocols</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="btn-primary flex items-center gap-3"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>

      {/* Gmail Integration */}
      <div className="card p-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0">
              <Mail className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-main tracking-tight text-lg">Gmail Integration</h3>
              <p className="text-sm text-muted font-medium italic mt-1">
                Connect a Google account so verification emails are sent from that inbox via Gmail API.
              </p>
              {gmailLoading ? (
                <p className="text-xs text-muted mt-3 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking status…
                </p>
              ) : gmailStatus?.connected ? (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="font-bold text-main">{gmailStatus.email}</span>
                  <span className="text-muted text-xs">connected</span>
                </div>
              ) : gmailStatus && !gmailStatus.configured ? (
                <div className="mt-4 flex items-center gap-2 text-xs text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>OAuth not configured. {gmailStatus.reason}</span>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                  <AlertCircle className="w-4 h-4" />
                  <span>No Gmail account connected. Falling back to SMTP env.</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 items-stretch min-w-[240px]">
            {gmailStatus?.connected ? (
              <>
                <div className="flex gap-2 items-center">
                  <input
                    type="email"
                    value={testTarget}
                    onChange={(e) => setTestTarget(e.target.value)}
                    placeholder={user?.email || "you@example.com"}
                    className="flex-1 input-premium py-2.5"
                  />
                </div>
                <button
                  onClick={handleTestGmail}
                  disabled={gmailAction === "test"}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50"
                >
                  {gmailAction === "test" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Test Email
                </button>
                <button
                  onClick={handleDisconnectGmail}
                  disabled={gmailAction === "disconnect"}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/10 transition-all disabled:opacity-50"
                >
                  {gmailAction === "disconnect" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={handleConnectGmail}
                disabled={gmailAction === "connect" || !gmailStatus?.configured}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gmailAction === "connect" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plug className="w-4 h-4" />
                )}
                Connect Gmail
              </button>
            )}
          </div>
        </div>

        {gmailNotice ? (
          <div className="mt-4 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 text-xs font-bold text-primary flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {gmailNotice}
          </div>
        ) : null}
        {gmailError ? (
          <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/20 text-xs font-bold text-red-400 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            {gmailError}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* Allowed Platforms */}
          <div className="card p-8">
            <h3 className="font-extrabold text-main tracking-tight flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Verified Feed Access
            </h3>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-6">Select origins for Box ingestion</p>
            <div className="flex flex-wrap gap-2.5">
              {allPlatforms.map((platform) => {
                const active = settings.allowedPlatforms.includes(platform);
                return (
                  <button
                    key={platform}
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        allowedPlatforms: active
                          ? s.allowedPlatforms.filter((p) => p !== platform)
                          : [...s.allowedPlatforms, platform],
                      }))
                    }
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                      active
                        ? "bg-primary text-white border-primary shadow-lg shadow-emerald-500/10"
                        : "bg-surface-hover text-muted border-border hover:border-primary/30"
                    }`}
                  >
                    {platform}
                  </button>
                );
              })}
            </div>
          </div>

          {/* BMID Format */}
          <div className="card p-8">
            <h3 className="font-extrabold text-main tracking-tight flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Identity Indexing
            </h3>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-6">Credential mask & serialization</p>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-3 italic">Pattern Mask</label>
                <div className="relative group">
                  <input
                    type="text"
                    value={settings.bmidFormat}
                    onChange={(e) => setSettings((s) => ({ ...s, bmidFormat: e.target.value }))}
                    className="w-full pl-5 pr-16 py-4 input-premium font-mono text-primary"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-surface-hover rounded text-[9px] font-black text-muted pointer-events-none uppercase border border-white/5">UTF-8</div>
                </div>
                <p className="text-[10px] text-muted mt-3 font-bold uppercase tracking-tight opacity-60 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-border" />
                  Use {"{NUMBER}"} for unique incrementation
                </p>
              </div>

              <div className="flex items-center justify-between p-5 bg-background border border-border rounded-2xl shadow-sm">
                <div>
                  <p className="text-xs font-black text-main uppercase tracking-tight">Manual Verification Bypass</p>
                  <p className="text-[10px] text-muted font-bold mt-1">If disabled, all requests bypass manual node review</p>
                </div>
                <button
                  onClick={() => setSettings((s) => ({ ...s, requireAdminApproval: !s.requireAdminApproval }))}
                  className={`w-14 h-7 rounded-full transition-all relative ${
                    settings.requireAdminApproval ? "bg-primary shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]" : "bg-border"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all shadow-sm ${
                      settings.requireAdminApproval ? "left-[32px]" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Voting Settings */}
          <div className="card p-8 border-l-4 border-l-primary/30">
            <h3 className="font-extrabold text-main tracking-tight flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Consensus Protocol
            </h3>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-6">Quorum and temporal constraints</p>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-2.5">Quorum Threshold</label>
                  <input
                    type="number"
                    value={settings.voteThreshold}
                    onChange={(e) => setSettings((s) => ({ ...s, voteThreshold: Number(e.target.value) }))}
                    className="w-full input-premium py-3"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-2.5">TTL (Days)</label>
                  <input
                    type="number"
                    value={settings.votingDuration}
                    onChange={(e) => setSettings((s) => ({ ...s, votingDuration: Number(e.target.value) }))}
                    className="w-full input-premium py-3"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-5 bg-background border border-border rounded-2xl shadow-sm">
                <div>
                  <p className="text-xs font-black text-main uppercase tracking-tight">Temporal Autoclose</p>
                  <p className="text-[10px] text-muted font-bold mt-1">Terminate polls immediately upon TTL expiry</p>
                </div>
                <button
                  onClick={() => setSettings((s) => ({ ...s, autoCloseVoting: !s.autoCloseVoting }))}
                  className={`w-14 h-7 rounded-full transition-all relative ${
                    settings.autoCloseVoting ? "bg-primary shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]" : "bg-border"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all shadow-sm ${
                      settings.autoCloseVoting ? "left-[32px]" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="card p-8">
            <h3 className="font-extrabold text-main tracking-tight flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Alert Topography
            </h3>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-6">Channel priority and routing</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-5 bg-background border border-border rounded-2xl shadow-sm">
                <div>
                  <p className="text-xs font-black text-main uppercase tracking-tight">External SMTP</p>
                  <p className="text-[10px] text-muted font-bold mt-1 italic">Routing via registered system email</p>
                </div>
                <button
                  onClick={() => setSettings((s) => ({ ...s, notificationEmail: !s.notificationEmail }))}
                  className={`w-14 h-7 rounded-full transition-all relative ${
                    settings.notificationEmail ? "bg-primary shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]" : "bg-border"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all shadow-sm ${settings.notificationEmail ? "left-[32px]" : "left-1"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-5 bg-background border border-border rounded-2xl shadow-sm">
                <div>
                  <p className="text-xs font-black text-main uppercase tracking-tight">Real-time Hook</p>
                  <p className="text-[10px] text-muted font-bold mt-1 italic">Client-side WebSocket notifications</p>
                </div>
                <button
                  onClick={() => setSettings((s) => ({ ...s, notificationPush: !s.notificationPush }))}
                  className={`w-14 h-7 rounded-full transition-all relative ${
                    settings.notificationPush ? "bg-primary shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]" : "bg-border"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all shadow-sm ${settings.notificationPush ? "left-[32px]" : "left-1"}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
