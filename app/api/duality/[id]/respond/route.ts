import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { applyTaggedUserDecision } from "@/lib/server/bmid";
import type { DualityRequestDoc } from "@/lib/server/bmid";
import { getDoc } from "@/lib/server/firestore";
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
    body.decision === "accepted" || body.decision === "declined"
      ? body.decision
      : null;
  const actorUserId = typeof body.actorUserId === "string" ? body.actorUserId : "";
  const actorName = typeof body.actorName === "string" ? body.actorName : "Tagged User";
  if (!decision) return error("invalid_decision", 400);
  if (!actorUserId) return error("missing_actor", 400);

  const duality = await getDoc<DualityRequestDoc>("dualityRequests", id);
  if (!duality) return error("not_found", 404);
  if (duality.taggedUserId !== actorUserId) return error("actor_mismatch", 400);
  if (duality.status !== "waiting_tagged") return error("not_waiting_tagged", 400);

  try {
    await applyTaggedUserDecision(id, duality, actorName, decision);
    const fresh = await getDoc("dualityRequests", id);
    return json(fresh);
  } catch (e) {
    return error("respond_failed", 500, { detail: String((e as Error).message) });
  }
}
