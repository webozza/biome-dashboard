import { NextRequest } from "next/server";
import { admin, db } from "@/lib/server/firebase";
import { computeVotingOutcome, syncVotingToContent } from "@/lib/server/bmid";
import type { VotingItemDoc } from "@/lib/server/bmid";
import { getDoc } from "@/lib/server/firestore";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const decision =
    body.decision === "accept" || body.decision === "ignore" || body.decision === "refuse"
      ? body.decision
      : null;
  const actorUserId = typeof body.actorUserId === "string" ? body.actorUserId : "";
  const actorEmail = typeof body.actorEmail === "string" ? body.actorEmail : null;
  if (!decision) return error("invalid_decision", 400);
  if (!actorUserId) return error("missing_actor", 400);

  const userSnap = await db().collection("users").doc(actorUserId).get();
  if (!userSnap.exists) return error("user_not_found", 404);
  const userData = userSnap.data() as { verified?: unknown; bmidNumber?: unknown } | undefined;
  const isVerified = userData?.verified === true || typeof userData?.bmidNumber === "string";
  if (!isVerified) return error("not_verified", 403);

  try {
    await db().runTransaction(async (tx) => {
      const votingRef = db().collection("votingItems").doc(id);
      const voteRef = votingRef.collection("votes").doc(actorUserId);
      const [votingSnap, voteSnap] = await Promise.all([tx.get(votingRef), tx.get(voteRef)]);
      if (!votingSnap.exists) throw new Error("not_found");
      if (voteSnap.exists) throw new Error("already_voted");

      const voting = { id: votingSnap.id, ...(votingSnap.data() as Omit<VotingItemDoc, "id">) } as VotingItemDoc;
      if (voting.status !== "open") throw new Error("voting_not_open");

      tx.set(
        votingRef,
        {
          [decision]: admin.firestore.FieldValue.increment(1),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      tx.set(voteRef, {
        userId: actorUserId,
        email: actorEmail,
        decision,
        createdAt: new Date().toISOString(),
      });
    });

    const fresh = (await getDoc<VotingItemDoc>("votingItems", id)) as VotingItemDoc | null;
    if (!fresh) return error("not_found", 404);
    const outcome = computeVotingOutcome(fresh.accept, fresh.ignore, fresh.refuse);
    if (outcome && fresh.status === "finalized" && outcome !== fresh.outcome) {
      await db().collection("votingItems").doc(id).set({ outcome, updatedAt: new Date().toISOString() }, { merge: true });
    }
    await syncVotingToContent((await getDoc<VotingItemDoc>("votingItems", id)) as VotingItemDoc);
    const synced = await getDoc("votingItems", id);
    return json(synced);
  } catch (e) {
    const message = String((e as Error).message);
    if (message === "not_found") return error("not_found", 404);
    if (message === "already_voted") return error("already_voted", 409);
    if (message === "voting_not_open") return error("voting_not_open", 400);
    return error("vote_record_failed", 500, { detail: message });
  }
}
