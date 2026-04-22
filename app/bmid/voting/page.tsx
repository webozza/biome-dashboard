"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MinusCircle, Vote, XCircle } from "lucide-react";
import { auth } from "@/lib/firebase-client";
import { StatusBadge } from "@/components/ui/status-badge";

type VotingItem = {
  id: string;
  title: string;
  requestId: string;
  accept: number;
  ignore: number;
  refuse: number;
  status: "open" | "closed" | "finalized";
};

async function authedFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const resp = await fetch(input, {
    ...init,
    headers: { ...(init?.headers || {}), authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  const data = (await resp.json().catch(() => null)) as T & { error?: string };
  if (!resp.ok) throw new Error(data?.error || "request_failed");
  return data;
}

export default function BmidVotingPage() {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["bmid", "voting", "open"],
    queryFn: () => authedFetch<{ items: VotingItem[] }>("/api/bmid/voting"),
  });

  const voteMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "accept" | "ignore" | "refuse" }) =>
      authedFetch(`/api/voting/${id}/vote`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bmid", "voting", "open"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><Vote className="w-5 h-5" /></div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">BMID Voting</h1>
          <p className="text-sm text-muted">Cast one vote on open BMID sessions if you are verified.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        {listQuery.isLoading ? (
          <p className="text-sm text-muted">Loading open voting sessions...</p>
        ) : listQuery.data?.items.length ? (
          <div className="space-y-4">
            {listQuery.data.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">{item.title}</p>
                    <p className="mt-1 text-xs text-muted font-mono">{item.requestId}</p>
                    <div className="mt-3 flex gap-4 text-xs font-bold">
                      <span className="text-emerald-300">A {item.accept}</span>
                      <span className="text-amber-300">I {item.ignore}</span>
                      <span className="text-red-300">R {item.refuse}</span>
                    </div>
                  </div>
                  <StatusBadge status={item.status} size="xs" />
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <button
                    onClick={() => void voteMutation.mutate({ id: item.id, decision: "accept" })}
                    disabled={voteMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {voteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Accept
                  </button>
                  <button
                    onClick={() => void voteMutation.mutate({ id: item.id, decision: "ignore" })}
                    disabled={voteMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
                  >
                    <MinusCircle className="w-4 h-4" />
                    Ignore
                  </button>
                  <button
                    onClick={() => void voteMutation.mutate({ id: item.id, decision: "refuse" })}
                    disabled={voteMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/20 disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" />
                    Refuse
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No open voting sessions right now.</p>
        )}
        {voteMutation.isError ? <p className="mt-4 text-sm text-red-300">{voteMutation.error.message}</p> : null}
      </div>
    </div>
  );
}
