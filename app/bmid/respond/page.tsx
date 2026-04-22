"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, GitBranch, Loader2, XCircle } from "lucide-react";
import { auth } from "@/lib/firebase-client";
import { StatusBadge } from "@/components/ui/status-badge";

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

type PendingDuality = {
  id: string;
  ownerName: string;
  taggedUserName: string;
  status: string;
  taggedUserAction: string;
};

export default function BmidRespondPage() {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ["bmid", "duality", "pending"],
    queryFn: () => authedFetch<{ items: PendingDuality[] }>("/api/bmid/duality/pending"),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "accepted" | "declined" }) =>
      authedFetch(`/api/duality/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ taggedUserAction: decision }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bmid", "duality", "pending"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><GitBranch className="w-5 h-5" /></div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Respond To Duality</h1>
          <p className="text-sm text-muted">Accept or decline requests where another user tagged you.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        {listQuery.isLoading ? (
          <p className="text-sm text-muted">Loading pending requests...</p>
        ) : listQuery.data?.items.length ? (
          <div className="space-y-3">
            {listQuery.data.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">{item.ownerName} tagged you in a BMID request</p>
                    <p className="mt-1 text-xs text-muted font-mono">{item.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge status={item.status} size="xs" />
                    <StatusBadge status={item.taggedUserAction} size="xs" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => void respondMutation.mutate({ id: item.id, decision: "accepted" })}
                    disabled={respondMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {respondMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Accept
                  </button>
                  <button
                    onClick={() => void respondMutation.mutate({ id: item.id, decision: "declined" })}
                    disabled={respondMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/20 disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No pending duality requests for you.</p>
        )}
      </div>
    </div>
  );
}
