import { NextRequest } from "next/server";
import { buildDelete, buildGetOne } from "@/lib/server/resource";
import { guard } from "@/lib/server/guard";
import { computeVotingOutcome, syncVotingToContent } from "@/lib/server/bmid";
import type { VotingItemDoc } from "@/lib/server/bmid";
import { getDoc, updateDoc } from "@/lib/server/firestore";
import { error, json } from "@/lib/server/response";

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
    return json(synced);
  } catch (e) {
    return error("update_failed", 500, { detail: String((e as Error).message) });
  }
}
