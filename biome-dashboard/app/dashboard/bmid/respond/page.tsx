"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle, GitBranch, Loader2, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPicker, type UserPickerOption } from "@/components/ui/user-picker";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuthStore } from "@/lib/stores/auth-store";

type DualityDoc = {
  id: string;
  ownerId: string;
  ownerName: string;
  taggedUserId: string;
  taggedUserName: string;
  taggedUserAction: "pending" | "accepted" | "declined";
  status: "pending" | "approved" | "rejected" | "waiting_tagged" | "cancelled";
  source: "content" | "box";
  createdAt: string;
};

async function readJson<T>(resp: Response): Promise<T> {
  const data = (await resp.json().catch(() => null)) as T & { error?: string; reason?: string };
  if (!resp.ok) {
    const message = data?.error || "request_failed";
    const reason = data?.reason ? ` (${data.reason})` : "";
    throw new Error(`${message}${reason}`);
  }
  return data;
}

export default function BmidRespondPage() {
  const queryClient = useQueryClient();
  const apiToken = useAuthStore((s) => s.apiToken);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actingUser, setActingUser] = useState<UserPickerOption | null>(null);

  const listQuery = useQuery({
    queryKey: ["bmid-respond", "waiting"],
    queryFn: async () => {
      const resp = await fetch("/api/duality/pending?limit=100", {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<{ items: DualityDoc[] }>(resp);
    },
    enabled: Boolean(apiToken),
  });

  const selected = useMemo(
    () => (listQuery.data?.items || []).find((item) => item.id === selectedId) || null,
    [listQuery.data?.items, selectedId]
  );

  useEffect(() => {
    if (!selected) return;
    setActingUser({
      id: selected.taggedUserId,
      displayName: selected.taggedUserName,
      email: "",
    });
  }, [selected]);

  const respondMutation = useMutation({
    mutationFn: async (decision: "accepted" | "declined") => {
      if (!selected || !actingUser) throw new Error("missing_selection");
      const resp = await fetch(`/api/duality/${selected.id}/respond`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actorUserId: actingUser.id,
          actorName: actingUser.displayName,
          decision,
        }),
      });
      return readJson<DualityDoc>(resp);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bmid-respond", "waiting"] });
      setSelectedId(null);
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold">
          <GitBranch className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-main">Duality Response</h1>
          <p className="text-sm text-muted font-medium italic">Simulate the tagged user accepting or declining a BMID duality request</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="card space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-main">Waiting Tagged User</h2>
          {listQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading duality requests...
            </div>
          ) : listQuery.isError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              Failed to load waiting duality requests: {listQuery.error.message}
            </div>
          ) : listQuery.data?.items.length ? (
            <div className="space-y-3">
              {listQuery.data.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${
                    selectedId === item.id ? "border-primary/30 bg-primary/5" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-main">{item.ownerName} tagged {item.taggedUserName}</p>
                      <p className="mt-1 text-xs text-muted font-mono">{item.id}</p>
                    </div>
                    <StatusBadge status={item.status} size="xs" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No duality requests are waiting on tagged-user action.</p>
          )}
        </div>

        <div className="card space-y-5">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-main">Respond As Tagged User</h2>
          {!selected ? (
            <p className="text-sm text-muted">Select a waiting duality request to continue.</p>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                <p className="text-sm font-bold text-main">{selected.ownerName} {"->"} {selected.taggedUserName}</p>
                <p className="text-xs text-muted font-mono">{selected.id}</p>
                <div className="flex gap-2">
                  <StatusBadge status={selected.status} size="xs" />
                  <StatusBadge status={selected.taggedUserAction} size="xs" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-tertiary">Which user is responding?</label>
                <UserPicker token={apiToken!} value={actingUser} onSelect={setActingUser} disabled={!apiToken || respondMutation.isPending} />
              </div>

              {respondMutation.isError ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                  {respondMutation.error.message}
                </div>
              ) : null}

              <div className="flex gap-2">
                <button
                  onClick={() => void respondMutation.mutateAsync("accepted")}
                  disabled={respondMutation.isPending || !actingUser}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {respondMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Accept
                </button>
                <button
                  onClick={() => void respondMutation.mutateAsync("declined")}
                  disabled={respondMutation.isPending || !actingUser}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-60"
                >
                  {respondMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Decline
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
