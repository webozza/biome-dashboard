"use client";

import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/status-badge";
import { auth } from "@/lib/firebase-client";

async function authedFetch<T>(input: string): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const resp = await fetch(input, { headers: { authorization: `Bearer ${token}` } });
  const data = (await resp.json().catch(() => null)) as T & { error?: string };
  if (!resp.ok) throw new Error(data?.error || "request_failed");
  return data;
}

export default function BmidRequestsPage() {
  const listQuery = useQuery({
    queryKey: ["bmid", "requests"],
    queryFn: () => authedFetch<{ items: Array<Record<string, unknown>> }>("/api/bmid/requests"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">My BMID Requests</h1>
        <p className="mt-2 text-sm text-muted">Track your Own and Duality request states.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        {listQuery.isLoading ? (
          <p className="text-sm text-muted">Loading requests...</p>
        ) : listQuery.data?.items.length ? (
          <div className="space-y-3">
            {listQuery.data.items.map((item) => (
              <div key={String(item.id)} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-main">{String(item.postTitle || "Untitled request")}</p>
                    <p className="mt-1 text-xs text-muted font-mono">{String(item.id)}</p>
                    <p className="mt-2 text-xs text-muted">{String(item.type || "")} • Tagged: {String(item.taggedUserName || "—")}</p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge status={String(item.status || "pending")} size="xs" />
                    {item.votingStatus ? <StatusBadge status={String(item.votingStatus)} size="xs" /> : null}
                    {item.votingOutcome ? <StatusBadge status={String(item.votingOutcome)} size="xs" /> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No BMID requests found yet.</p>
        )}
      </div>
    </div>
  );
}
