"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquarePlus,
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
import { castBmidBoxVoteApi, fetchBmidBoxRequest, postBmidBoxAction } from "@/lib/bmid-box-client";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type ActionTone = "primary" | "danger" | "neutral";

type ActionDef = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: ActionTone;
  path: string;
  prompt?: { label: string; field: string; initial?: string };
};

export default function BmidBoxRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const apiToken = useAuthStore((state) => state.apiToken);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [voter, setVoter] = useState<UserPickerOption | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["bmid-box", "request", id],
    queryFn: () => fetchBmidBoxRequest(apiToken!, id),
    enabled: Boolean(apiToken && id),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: Record<string, unknown> }) =>
      postBmidBoxAction(apiToken!, path, {
        actorName: user?.name || "Admin",
        ...(body || {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bmid-box", "request", id] });
      queryClient.invalidateQueries({ queryKey: ["bmid-box", "requests"] });
      queryClient.invalidateQueries({ queryKey: ["bmid-box", "voting"] });
      queryClient.invalidateQueries({ queryKey: ["bmid-box", "audit"] });
    },
    onSettled: () => setSubmittingKey(null),
  });

  const voteMutation = useMutation({
    mutationFn: (voteType: "accept" | "ignore" | "refuse") => {
      if (!voter) throw new Error("Select a voter first");
      return castBmidBoxVoteApi(apiToken!, id, {
        voterUserId: voter.id,
        voterName: voter.displayName,
        voteType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bmid-box", "request", id] });
      queryClient.invalidateQueries({ queryKey: ["bmid-box", "voting"] });
      queryClient.invalidateQueries({ queryKey: ["bmid-box", "audit"] });
      setVoteError(null);
    },
    onError: (err: unknown) => setVoteError((err as Error).message),
  });

  const request = detailQuery.data;

  const actions = useMemo<ActionDef[]>(() => {
    if (!request) return [];
    const base: ActionDef[] = [];
    switch (request.currentStatus) {
      case "submitted":
      case "pending_admin_review":
        base.push(
          {
            key: "approve",
            label: request.type === "duality" ? "Send To Tagged" : "Open Voting",
            icon: CheckCircle2,
            tone: "primary",
            path: `/api/bmid-box/requests/${id}/approve`,
          },
          {
            key: "reject",
            label: "Reject",
            icon: XCircle,
            tone: "danger",
            path: `/api/bmid-box/requests/${id}/reject`,
            prompt: { label: "Rejection reason", field: "rejectionReason", initial: "Rejected by admin" },
          }
        );
        break;
      case "pending_tagged_user":
        base.push(
          {
            key: "voting",
            label: "Move To Voting",
            icon: Vote,
            tone: "primary",
            path: `/api/bmid-box/requests/${id}/voting-stage`,
          },
          {
            key: "reject",
            label: "Reject",
            icon: XCircle,
            tone: "danger",
            path: `/api/bmid-box/requests/${id}/reject`,
            prompt: { label: "Rejection reason", field: "rejectionReason", initial: "Rejected" },
          }
        );
        break;
      case "pending_voting":
        base.push(
          {
            key: "finalize",
            label: "Finalize",
            icon: CheckCircle2,
            tone: "primary",
            path: `/api/bmid-box/voting/${id}/finalize`,
          },
          {
            key: "close-voting",
            label: "Close Voting",
            icon: Vote,
            tone: "neutral",
            path: `/api/bmid-box/voting/${id}/close`,
          }
        );
        break;
      default:
        break;
    }
    if (request.currentStatus !== "removed") {
      base.push({
        key: "remove",
        label: "Remove",
        icon: Trash2,
        tone: "danger",
        path: `/api/bmid-box/requests/${id}/remove`,
        prompt: { label: "Removal reason", field: "removalReason", initial: "Removed by admin" },
      });
    }
    return base;
  }, [id, request]);

  function runAction(action: ActionDef) {
    let body: Record<string, unknown> | undefined;
    if (action.prompt) {
      const value = window.prompt(action.prompt.label, action.prompt.initial || "");
      if (value === null) return;
      body = { [action.prompt.field]: value };
    }
    setSubmittingKey(action.key);
    actionMutation.mutate({ path: action.path, body });
  }

  function addNote() {
    const note = window.prompt("Admin note");
    if (!note) return;
    setSubmittingKey("note");
    actionMutation.mutate({ path: `/api/bmid-box/requests/${id}/notes`, body: { note } });
  }

  if (detailQuery.isLoading || !request) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const votingOpen = request.votingStatus === "open";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-4">
        <Link href="/dashboard/bmid-box" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-muted transition hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-main">{request.id}</h1>
            <StatusBadge status={request.currentStatus} />
            <StatusBadge status={request.type} size="xs" />
            {request.votingStatus ? <StatusBadge status={request.votingStatus} size="xs" /> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => {
              const Icon = action.icon;
              const toneClass =
                action.tone === "primary"
                  ? "bg-primary text-white hover:bg-emerald-600"
                  : action.tone === "danger"
                    ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white"
                    : "bg-white/[0.03] text-main border border-white/10 hover:border-primary/30 hover:text-primary";
              return (
                <button
                  key={action.key}
                  onClick={() => runAction(action)}
                  disabled={submittingKey === action.key}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition disabled:opacity-50 ${toneClass}`}
                >
                  {submittingKey === action.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                  {action.label}
                </button>
              );
            })}
            <button
              onClick={addNote}
              disabled={submittingKey === "note"}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted transition hover:text-primary disabled:opacity-50"
            >
              {submittingKey === "note" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
              Note
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          <section className="card overflow-hidden p-0">
            <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={request.previewData.thumbnailUrl}
                alt={request.previewData.title}
                className="h-full min-h-[200px] w-full object-cover"
              />
              <div className="space-y-3 p-5">
                <div className="flex items-center gap-2">
                  <StatusBadge status={request.sourcePlatform} size="xs" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                    Submitted {formatDate(request.submittedAt)}
                  </span>
                </div>
                <h2 className="text-lg font-extrabold tracking-tight text-main">{request.previewData.title}</h2>
                <p className="text-sm leading-6 text-muted">{request.previewData.description}</p>
                <a
                  href={request.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 break-all text-xs font-bold text-primary"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  {request.sourceUrl}
                </a>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Participants</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Owner</p>
                <p className="mt-1 text-sm font-bold text-main">{request.ownerSnapshot?.name || "Unknown"}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <StatusBadge status={request.ownerSnapshot?.verified ? "approved" : "submitted"} size="xs" />
                  <span>{request.ownerSnapshot?.bmidNumber || "No BMID"}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Tagged</p>
                <p className="mt-1 text-sm font-bold text-main">
                  {request.taggedSnapshot?.name || (request.type === "own" ? "—" : "Not tagged")}
                </p>
                {request.type === "duality" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <StatusBadge status={request.taggedUserAction || "pending"} size="xs" />
                    {request.taggedUserActionNote ? <span>{request.taggedUserActionNote}</span> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="card p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Timeline</p>
            <div className="mt-4 space-y-2">
              {request.history.slice().reverse().map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={entry.actionType} size="xs" />
                    <span className="text-sm text-main">{entry.note}</span>
                  </div>
                  <span className="text-[10px] font-medium text-muted">
                    {entry.actorName} • {formatDate(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {request.adminNotes.length > 0 || request.rejectionReason || request.removalReason ? (
            <section className="card p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Admin Notes</p>
              <div className="mt-4 space-y-2">
                {request.adminNotes.map((note, index) => (
                  <div key={`${note}-${index}`} className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5 text-sm text-main">
                    {note}
                  </div>
                ))}
                {request.rejectionReason ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-300">
                    <strong className="mr-2 uppercase tracking-[0.15em]">Rejected:</strong>
                    {request.rejectionReason}
                  </div>
                ) : null}
                {request.removalReason ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-300">
                    <strong className="mr-2 uppercase tracking-[0.15em]">Removed:</strong>
                    {request.removalReason}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Voting</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-3">
                <p className="text-xl font-black text-emerald-400">{request.acceptCount}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Accept</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 py-3">
                <p className="text-xl font-black text-amber-400">{request.ignoreCount}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Ignore</p>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 py-3">
                <p className="text-xl font-black text-red-400">{request.refuseCount}</p>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Refuse</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
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
                  const Icon = type === "accept" ? ThumbsUp : type === "refuse" ? ThumbsDown : Vote;
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
                  Voting is <strong>{request.votingStatus || "not open"}</strong>. Move to voting to cast votes.
                </p>
              ) : null}

              {voteError ? (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{voteError}</p>
              ) : null}

              <div className="grid grid-cols-2 gap-2 pt-2 text-[10px] text-muted">
                <span>Start: {formatDate(request.votingStartAt)}</span>
                <span>End: {formatDate(request.votingEndAt)}</span>
                <span>Finalized: {formatDate(request.finalizedAt)}</span>
                <span>Updated: {formatDate(request.updatedAt)}</span>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted">Checks</p>
            <div className="mt-3 space-y-2">
              {[
                ["Owner verified", request.verificationChecks.ownerVerified],
                ["Platform allowed", request.verificationChecks.platformAllowed],
                ["URL reachable", request.verificationChecks.urlReachable],
                ["No duplicate URL", !request.verificationChecks.duplicateUrl],
                ["Content type supported", request.verificationChecks.supportedContentType],
              ].map(([label, passed]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs">
                  <span className="text-main">{label}</span>
                  <StatusBadge status={passed ? "approved" : "refused"} size="xs" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
