import { NextRequest } from "next/server";
import { buildDelete, buildGetOne } from "@/lib/server/resource";
import { guard } from "@/lib/server/guard";
import { computeVotingOutcome, syncVotingToContent } from "@/lib/server/bmid";
import type { ContentRequestDoc, VotingItemDoc } from "@/lib/server/bmid";
import { getDoc, updateDoc } from "@/lib/server/firestore";
import { sendContentFinalizedEmail } from "@/lib/server/email/transport";
import { error, json } from "@/lib/server/response";

type UserEmailDoc = { email?: string | null; name?: string | null; displayName?: string | null };

function outcomeToFinalState(outcome: VotingItemDoc["outcome"]): "approved" | "rejected" | "cancelled" {
  if (outcome === "accepted") return "approved";
  if (outcome === "refused") return "rejected";
  return "cancelled";
}

export const dynamic = "force-dynamic";

export const GET = buildGetOne("votingItems");
export const DELETE = buildDelete("votingItems");

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const existing = await getDoc<VotingItemDoc>("votingItems", id);
  if (!existing) return error("not_found", 404);

  const nextStatus =
    body.status === "open" || body.status === "closed" || body.status === "finalized"
      ? body.status
      : existing.status;

  const accept = typeof body.accept === "number" ? body.accept : existing.accept;
  const ignore = typeof body.ignore === "number" ? body.ignore : existing.ignore;
  const refuse = typeof body.refuse === "number" ? body.refuse : existing.refuse;
  const computedOutcome = computeVotingOutcome(accept, ignore, refuse);
  const outcome =
    body.outcome === "accepted" || body.outcome === "ignored" || body.outcome === "refused"
      ? body.outcome
      : nextStatus === "finalized"
        ? computedOutcome
        : existing.outcome;

  try {
    await updateDoc("votingItems", id, {
      ...body,
      status: nextStatus,
      accept,
      ignore,
      refuse,
      outcome,
      closedAt: nextStatus === "open" ? null : typeof body.closedAt === "string" ? body.closedAt : new Date().toISOString(),
    });
    const fresh = (await getDoc<VotingItemDoc>("votingItems", id)) as VotingItemDoc;
    await syncVotingToContent(fresh);
    const synced = await getDoc("votingItems", id);

    // Email owner once voting transitions to finalized (only for content;
    // box voting is finalized via lib/server/bmid-box.ts which fires its own email).
    const wasNotFinalized = existing.status !== "finalized";
    if (wasNotFinalized && fresh.status === "finalized" && fresh.requestType === "content") {
      const content = await getDoc<ContentRequestDoc>("contentRequests", fresh.requestId).catch(() => null);
      if (content) {
        const ownerUser = await getDoc<UserEmailDoc>("users", content.userId).catch(() => null);
        if (ownerUser?.email) {
          void sendContentFinalizedEmail(ownerUser.email, {
            ownerName: content.userName || ownerUser.name || ownerUser.displayName || "there",
            outcome: outcomeToFinalState(fresh.outcome),
            voteAccept: fresh.accept,
            voteIgnore: fresh.ignore,
            voteRefuse: fresh.refuse,
            postTitle: content.postTitle ?? null,
            taggedUserName: content.taggedUserName ?? null,
            isDuality: content.type === "duality",
            surface: "content",
          });
        }
      }
    }

    return json(synced);
  } catch (e) {
    return error("update_failed", 500, { detail: String((e as Error).message) });
  }
}
