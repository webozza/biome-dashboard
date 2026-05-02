"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  GitBranch,
  Loader2,
  Mail,
  Minus,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Vote,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserPicker, type UserPickerOption } from "@/components/ui/user-picker";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { ContentDoc } from "../_components/types";
import { formatDate, readJson } from "../_components/shared";

type UserDoc = {
  id: string;
  name?: string | null;
  displayName?: string | null;
  email?: string | null;
  bmidNumber?: string | null;
};

const NEUTRAL_FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-main outline-none transition-colors focus:border-white/20";

export default function ContentRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const apiToken = useAuthStore((s) => s.apiToken);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [adminNote, setAdminNote] = useState("");
  const [voter, setVoter] = useState<UserPickerOption | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["content", "request", id],
    queryFn: async () => {
      const resp = await fetch(`/api/content/${id}`, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<ContentDoc>(resp);
    },
    enabled: Boolean(apiToken && id),
  });

  const ownerId = detailQuery.data?.userId || null;
  const taggedId =
    detailQuery.data?.type === "duality" ? detailQuery.data.taggedUserId || null : null;

  const ownerQuery = useQuery({
    queryKey: ["users", "doc", ownerId],
    queryFn: async () => {
      const resp = await fetch(`/api/users/${ownerId}`, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<UserDoc>(resp);
    },
    enabled: Boolean(apiToken && ownerId),
  });

  const taggedQuery = useQuery({
    queryKey: ["users", "doc", taggedId],
    queryFn: async () => {
      const resp = await fetch(`/api/users/${taggedId}`, {
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<UserDoc>(resp);
    },
    enabled: Boolean(apiToken && taggedId),
  });

  const patchMutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const resp = await fetch(`/api/content/${id}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      return readJson<ContentDoc>(resp);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", "request", id] });
      queryClient.invalidateQueries({ queryKey: ["content", "list"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`/api/content/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${apiToken}` },
      });
      return readJson<{ id: string; deleted: true }>(resp);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content", "list"] });
      router.push("/dashboard/content");
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (decision: "accept" | "ignore" | "refuse") => {
      if (!voter) throw new Error("Select a voter first");
      const resp = await fetch(`/api/voting/${id}/record`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          actorUserId: voter.id,
          actorEmail: voter.email,
        }),
      });
      return readJson<unknown>(resp);
    },
    onSuccess: () => {
      setVoteError(null);
      queryClient.invalidateQueries({ queryKey: ["content", "request", id] });
      queryClient.invalidateQueries({ queryKey: ["content", "list"] });
    },
    onError: (err: unknown) => setVoteError((err as Error).message),
  });

  const isMutating = patchMutation.isPending || deleteMutation.isPending;
  const selected = detailQuery.data;

  async function handleStatusUpdate(status: string) {
    if (!selected) return;
    const patch: Record<string, unknown> = {
      status,
      reviewedBy: user?.name || user?.email || "Admin",
    };
    if (adminNote.trim()) {
      const existing = selected.adminNotes || [];
      patch.adminNotes = [
        ...existing,
        { note: adminNote.trim(), by: user?.name || "Admin", at: new Date().toISOString().split("T")[0] },
      ];
    }
    if (status === "rejected") {
      patch.rejectionReason = adminNote.trim() || "Rejected by admin";
    }
    await patchMutation.mutateAsync(patch);
    setAdminNote("");
  }

  if (detailQuery.isLoading || !selected) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const totalVotes =
    (selected.voteAccept || 0) + (selected.voteIgnore || 0) + (selected.voteRefuse || 0);
  const canDecide = selected.status === "pending" || selected.status === "in_review";
  const votingOpen = selected.votingStatus === "open";
  const isDuality = selected.type === "duality";
  const ownerEmail = ownerQuery.data?.email || null;
  const ownerBmid = ownerQuery.data?.bmidNumber || selected.bmidNumber || null;
  const taggedEmail = taggedQuery.data?.email || null;
  const taggedBmid = taggedQuery.data?.bmidNumber || null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-4">
        <Link
          href="/dashboard/content"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-muted transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-main">{selected.id}</h1>
            <StatusBadge status={selected.status} />
            <StatusBadge status={selected.type} size="xs" />
            {selected.votingStatus ? <StatusBadge status={selected.votingStatus} size="xs" /> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {canDecide && (
              <>
                <button
                  onClick={() => void handleStatusUpdate("approved")}
                  disabled={isMutating}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  {patchMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Approve
                </button>
                <button
                  onClick={() => void handleStatusUpdate("rejected")}
                  disabled={isMutating}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                >
                  {patchMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Reject
                </button>
              </>
            )}
            <button
              onClick={() => void deleteMutation.mutateAsync()}
              disabled={isMutating}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          <section className="card overflow-hidden p-0">
            {selected.postImageUrl ? (
              <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.postImageUrl}
                  alt={selected.postTitle}
                  className="h-full min-h-[200px] w-full object-cover"
                />
                <div className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selected.type} size="xs" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                      Submitted {formatDate(selected.createdAt)}
                    </span>
                  </div>
                  <h2 className="text-lg font-extrabold tracking-tight text-main">{selected.postTitle}</h2>
                  <p className="text-sm leading-6 text-muted italic">&ldquo;{selected.postPreview}&rdquo;</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-5">
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.type} size="xs" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                    Submitted {formatDate(selected.createdAt)}
                  </span>
                </div>
                <h2 className="text-lg font-extrabold tracking-tight text-main">{selected.postTitle}</h2>
                <p className="text-sm leading-6 text-muted italic">&ldquo;{selected.postPreview}&rdquo;</p>
              </div>
            )}
          </section>

          <section className="card p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Participants</p>
            <div className={`mt-4 grid gap-4 ${isDuality ? "md:grid-cols-2" : ""}`}>
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                  {isDuality ? "Owner" : "Author"}
                </p>
                <p className="mt-1 text-sm font-bold text-main">{selected.userName}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {ownerBmid ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-mono font-semibold">
                      <ShieldCheck className="w-3 h-3" />
                      {ownerBmid}
                    </span>
                  ) : (
                    <span className="text-[11px]">No BMID</span>
                  )}
                  {ownerEmail ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                      <Mail className="w-3 h-3" />
                      {ownerEmail}
                    </span>
                  ) : ownerQuery.isLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : null}
                </div>
              </div>

              {isDuality ? (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Tagged</p>
                  <p className="mt-1 text-sm font-bold text-main">
                    {selected.taggedUserName || "Not tagged"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <StatusBadge status={selected.taggedUserAction || "pending"} size="xs" />
                    {taggedBmid ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-mono font-semibold">
                        <ShieldCheck className="w-3 h-3" />
                        {taggedBmid}
                      </span>
                    ) : null}
                    {taggedEmail ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                        <Mail className="w-3 h-3" />
                        {taggedEmail}
                      </span>
                    ) : taggedQuery.isLoading && taggedId ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {isDuality && selected.taggedUserName && (
              <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                    Duality Pairing
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="card p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Meta</p>
            <div className="mt-4 grid grid-cols-2 gap-y-5 gap-x-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">State</p>
                <StatusBadge status={selected.status} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Reviewed By</p>
                <p className="text-sm font-medium">{selected.reviewedBy || "Pending review"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Submitted</p>
                <p className="text-sm font-medium">{formatDate(selected.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Updated</p>
                <p className="text-sm font-medium">{formatDate(selected.updatedAt)}</p>
              </div>
            </div>
          </section>

          {selected.adminNotes && selected.adminNotes.length > 0 ? (
            <section className="card p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Admin Audit Trail</p>
              <div className="mt-4 space-y-3">
                {selected.adminNotes.map((note, i) => (
                  <div key={i} className="p-3 bg-background border border-border rounded-xl">
                    <p className="text-sm leading-relaxed text-main">{note.note}</p>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {note.by.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-[10px] text-muted font-bold uppercase tracking-wide">
                        {note.by} <span className="mx-1 opacity-30">&bull;</span> {note.at}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {selected.rejectionReason ? (
            <section className="card p-5">
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-300">
                <strong className="mr-2 uppercase tracking-[0.15em]">Rejected:</strong>
                {selected.rejectionReason}
              </div>
            </section>
          ) : null}

          <section className="card p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Admin Note</p>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
              disabled={isMutating}
              className={`mt-3 ${NEUTRAL_FIELD_CLASS}`}
              placeholder="Add reviewer context for this request (saved with the next approve/reject)"
            />
            {(patchMutation.isError || deleteMutation.isError) && (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                {patchMutation.error?.message || deleteMutation.error?.message}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Voting</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-3">
                <p className="text-xl font-black text-emerald-400">{selected.voteAccept || 0}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Accept</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 py-3">
                <p className="text-xl font-black text-amber-400">{selected.voteIgnore || 0}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Ignore</p>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 py-3">
                <p className="text-xl font-black text-red-400">{selected.voteRefuse || 0}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Refuse</p>
              </div>
            </div>

            {totalVotes > 0 ? (
              <div className="mt-4 space-y-3">
                {[
                  { label: "Accept", value: selected.voteAccept || 0, color: "var(--primary)", icon: ThumbsUp },
                  { label: "Ignore", value: selected.voteIgnore || 0, color: "#f59e0b", icon: Minus },
                  { label: "Refuse", value: selected.voteRefuse || 0, color: "#ef4444", icon: ThumbsDown },
                ].map((v) => {
                  const pct = totalVotes > 0 ? Math.round((v.value / totalVotes) * 100) : 0;
                  const Icon = v.icon;
                  return (
                    <div key={v.label}>
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-xs font-bold text-main uppercase tracking-wide flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5" style={{ color: v.color }} />
                          {v.label}
                        </span>
                        <span className="text-xs font-extrabold text-main">
                          {v.value}{" "}
                          <span className="text-[10px] text-muted font-bold">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-surface-hover rounded-full overflow-hidden border border-border/50">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${pct}%`, backgroundColor: v.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Cast Vote (Admin)</p>
              <UserPicker
                token={apiToken || ""}
                value={voter}
                onSelect={(next) => {
                  setVoter(next);
                  setVoteError(null);
                }}
                verifiedOnly
              />

              <div className="grid grid-cols-3 gap-2">
                {(["accept", "ignore", "refuse"] as const).map((type) => {
                  const tone =
                    type === "accept"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500"
                      : type === "ignore"
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500"
                        : "border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500";
                  const Icon = type === "accept" ? ThumbsUp : type === "refuse" ? ThumbsDown : Minus;
                  return (
                    <button
                      key={type}
                      onClick={() => voteMutation.mutate(type)}
                      disabled={!voter || voteMutation.isPending || !votingOpen}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition hover:text-white disabled:opacity-40 ${tone}`}
                    >
                      {voteMutation.isPending && voteMutation.variables === type ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                      {type}
                    </button>
                  );
                })}
              </div>

              {!votingOpen ? (
                <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-muted">
                  Voting is{" "}
                  <strong className="uppercase">{selected.votingStatus || "not open"}</strong>.
                  Approve the request to open voting.
                </p>
              ) : null}

              {voteError ? (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {voteError}
                </p>
              ) : null}
            </div>

            {selected.votingStatus ? (
              <div className="mt-4 flex items-center gap-2">
                <Vote className="w-4 h-4 text-blue-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Status:</p>
                <StatusBadge status={selected.votingStatus} size="xs" />
              </div>
            ) : null}

            {selected.votingOutcome ? (
              <div className="mt-2 flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Outcome:</p>
                <StatusBadge status={selected.votingOutcome} size="xs" />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
