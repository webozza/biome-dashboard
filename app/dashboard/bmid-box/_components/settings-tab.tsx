"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BmidBoxSettings } from "@/lib/data/bmid-box";
import { useAuthStore } from "@/lib/stores/auth-store";
import { patchBmidBoxSettingsRequest, readJson } from "@/lib/bmid-box-client";

const platforms = ["instagram", "tiktok", "youtube", "facebook"] as const;
const contentTypes = ["video", "photo", "post"] as const;

export function SettingsTab() {
  const apiToken = useAuthStore((state) => state.apiToken);
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<BmidBoxSettings | null>(null);

  const query = useQuery({
    queryKey: ["bmid-box", "settings"],
    queryFn: async () => {
      const resp = await fetch("/api/bmid-box/settings", {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<BmidBoxSettings & { id: string }>(resp);
    },
    enabled: Boolean(apiToken),
  });

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<BmidBoxSettings>) => patchBmidBoxSettingsRequest(apiToken!, patch),
    onSuccess: (next) => {
      setSettings(next);
      queryClient.invalidateQueries({ queryKey: ["bmid-box", "settings"] });
    },
  });

  const currentSettings = settings || query.data;

  if (query.isLoading || !currentSettings) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate(currentSettings)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Allowed Platforms</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {platforms.map((platform) => {
              const active = currentSettings.allowedPlatforms.includes(platform);
              return (
                <button
                  key={platform}
                  onClick={() =>
                    setSettings((current) => ({
                      ...((current || currentSettings) as BmidBoxSettings),
                      allowedPlatforms: active
                        ? (current || currentSettings).allowedPlatforms.filter((value) => value !== platform)
                        : [...(current || currentSettings).allowedPlatforms, platform],
                    }))
                  }
                  className={`rounded-xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition ${
                    active ? "border-primary bg-primary text-white" : "border-white/10 bg-white/[0.03] text-main"
                  }`}
                >
                  {platform}
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Embed Preview</span>
              <select
                value={currentSettings.embedPreviewEnabled ? "yes" : "no"}
                onChange={(event) => setSettings((current) => ({ ...((current || currentSettings) as BmidBoxSettings), embedPreviewEnabled: event.target.value === "yes" }))}
                className="mt-3 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-sm text-main"
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </label>

            <label className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Max Pending / User</span>
              <input
                type="number"
                value={currentSettings.maxPendingRequestsPerUser}
                onChange={(event) => setSettings((current) => ({ ...((current || currentSettings) as BmidBoxSettings), maxPendingRequestsPerUser: Number(event.target.value) }))}
                className="mt-3 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-sm text-main"
              />
            </label>
          </div>
        </section>

        <section className="card p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Validation</p>
          <div className="mt-4 grid gap-4">
            <label className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Duplicate URL Rule</span>
              <select
                value={currentSettings.duplicateUrlRule}
                onChange={(event) => setSettings((current) => ({ ...((current || currentSettings) as BmidBoxSettings), duplicateUrlRule: event.target.value as BmidBoxSettings["duplicateUrlRule"] }))}
                className="mt-3 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-sm text-main"
              >
                <option value="block_exact_match">Block exact match</option>
                <option value="warn_only">Warn only</option>
              </select>
            </label>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Supported Content Types</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {contentTypes.map((contentType) => {
                  const active = currentSettings.supportedContentTypes.includes(contentType);
                  return (
                    <button
                      key={contentType}
                      onClick={() =>
                        setSettings((current) => ({
                          ...((current || currentSettings) as BmidBoxSettings),
                          supportedContentTypes: active
                            ? (current || currentSettings).supportedContentTypes.filter((value) => value !== contentType)
                            : [...(current || currentSettings).supportedContentTypes, contentType],
                        }))
                      }
                      className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition ${
                        active ? "border-primary bg-primary text-white" : "border-white/10 bg-white/[0.03] text-main"
                      }`}
                    >
                      {contentType}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="card p-6 xl:col-span-2">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Voting Rules</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Start Trigger</span>
              <select
                value={currentSettings.votingStartTrigger}
                onChange={(event) => setSettings((current) => ({ ...((current || currentSettings) as BmidBoxSettings), votingStartTrigger: event.target.value as BmidBoxSettings["votingStartTrigger"] }))}
                className="mt-3 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-sm text-main"
              >
                <option value="admin_manual">Admin manual</option>
                <option value="after_tagged_user_accept">After tagged accept</option>
              </select>
            </label>

            <label className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Duration (days)</span>
              <input
                type="number"
                value={currentSettings.votingDurationDays}
                onChange={(event) => setSettings((current) => ({ ...((current || currentSettings) as BmidBoxSettings), votingDurationDays: Number(event.target.value) }))}
                className="mt-3 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-sm text-main"
              />
            </label>

            <label className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Min Votes</span>
              <input
                type="number"
                value={currentSettings.minimumVotesRequired}
                onChange={(event) => setSettings((current) => ({ ...((current || currentSettings) as BmidBoxSettings), minimumVotesRequired: Number(event.target.value) }))}
                className="mt-3 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-sm text-main"
              />
            </label>

            <label className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Auto-close On Expiry</span>
              <select
                value={currentSettings.autoCloseVotingOnExpiry ? "yes" : "no"}
                onChange={(event) => setSettings((current) => ({ ...((current || currentSettings) as BmidBoxSettings), autoCloseVotingOnExpiry: event.target.value === "yes" }))}
                className="mt-3 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-sm text-main"
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </label>

            <label className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 md:col-span-2 xl:col-span-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Admin Can Manually Finalize</span>
              <select
                value={currentSettings.adminCanFinalize ? "yes" : "no"}
                onChange={(event) => setSettings((current) => ({ ...((current || currentSettings) as BmidBoxSettings), adminCanFinalize: event.target.value === "yes" }))}
                className="mt-3 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-sm text-main"
              >
                <option value="yes">Allowed</option>
                <option value="no">Disabled</option>
              </select>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
