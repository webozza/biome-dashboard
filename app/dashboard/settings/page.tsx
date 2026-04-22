"use client";

import { useState } from "react";
import { Settings, Save } from "lucide-react";

export default function SettingsPage() {
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
          Synchronize Node
        </button>
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
