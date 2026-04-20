"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, MinusCircle, Vote, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPicker, type UserPickerOption } from "@/components/ui/user-picker";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuthStore } from "@/lib/stores/auth-store";

type VotingItem = {
  id: string;
  requestId: string;
  requestType: "content" | "box";
  title: string;
  accept: number;
  ignore: number;
  refuse: number;
  status: "open" | "closed" | "finalized";
  openedAt: string;
  closedAt: string | null;
  outcome: "accepted" | "refused" | "ignored" | null;
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

export default function BmidVotePage() {
  const queryClient = useQueryClient();
  const apiToken = useAuthStore((s) => s.apiToken);
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
  const [actingUser, setActingUser] = useState<UserPickerOption | null>(null);

  const listQuery = useQuery({
    queryKey: ["bmid-vote", "open"],
    queryFn: async () => {
      const resp = await fetch("/api/voting?status=open&limit=100", {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<{ items: VotingItem[] }>(resp);
    },
    enabled: Boolean(apiToken),
  });

  const selected = useMemo(
    () => (listQuery.data?.items || []).find((item) => item.id === selectedVoteId) || null,
    [listQuery.data?.items, selectedVoteId]
  );

  const recordVoteMutation = useMutation({
    mutationFn: async (decision: "accept" | "ignore" | "refuse") => {
      if (!selected || !actingUser) throw new Error("missing_selection");
      const resp = await fetch(`/api/voting/${selected.id}/record`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actorUserId: actingUser.id,
          actorEmail: actingUser.email,
          decision,
        }),
      });
      return readJson<VotingItem>(resp);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bmid-vote", "open"] });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl text-primary font-bold">
          <Vote className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-main">BMID Voting</h1>
          <p className="text-sm text-muted font-medium italic">Simulate verified-user votes by choosing which user is casting the ballot</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="card space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-main">Open Sessions</h2>
          {listQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading voting sessions...
            </div>
          ) : listQuery.data?.items.length ? (
            <div className="space-y-3">
              {listQuery.data.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedVoteId(item.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${
                    selectedVoteId === item.id ? "border-primary/30 bg-primary/5" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-main">{item.title}</p>
                      <p className="mt-1 text-xs text-muted font-mono">{item.requestId}</p>
                    </div>
                    <StatusBadge status={item.status} size="xs" />
                  </div>
                  <div className="mt-3 flex gap-4 text-xs font-bold">
                    <span className="text-emerald-300">A {item.accept}</span>
                    <span className="text-amber-300">I {item.ignore}</span>
                    <span className="text-red-300">R {item.refuse}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No open voting sessions are available right now.</p>
          )}
        </div>

        <div className="card space-y-5">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-main">Record Vote</h2>
          {!selected ? (
            <p className="text-sm text-muted">Select an open voting session to continue.</p>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-sm font-bold text-main">{selected.title}</p>
                <p className="mt-1 text-xs text-muted font-mono">{selected.id}</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-tertiary">Which user is voting?</label>
                <UserPicker token={apiToken!} value={actingUser} onSelect={setActingUser} disabled={!apiToken || recordVoteMutation.isPending} />
                <p className="text-[11px] text-muted">Only verified users with BMID/verified state can vote. The backend will reject everyone else.</p>
              </div>

              {recordVoteMutation.isError ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                  {recordVoteMutation.error.message}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => void recordVoteMutation.mutateAsync("accept")}
                  disabled={recordVoteMutation.isPending || !actingUser}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {recordVoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Record Accept
                </button>
                <button
                  onClick={() => void recordVoteMutation.mutateAsync("ignore")}
                  disabled={recordVoteMutation.isPending || !actingUser}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
                >
                  {recordVoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MinusCircle className="w-4 h-4" />}
                  Record Ignore
                </button>
                <button
                  onClick={() => void recordVoteMutation.mutateAsync("refuse")}
                  disabled={recordVoteMutation.isPending || !actingUser}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-60"
                >
                  {recordVoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Record Refuse
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
