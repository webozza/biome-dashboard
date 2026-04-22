import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";
import { castBmidBoxVote } from "@/lib/server/bmid-box";

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

  const voterUserId = typeof body.voterUserId === "string" ? body.voterUserId : "";
  const voterName = typeof body.voterName === "string" && body.voterName ? body.voterName : "Unknown voter";
  const voteType =
    body.voteType === "accept" || body.voteType === "ignore" || body.voteType === "refuse"
      ? body.voteType
      : null;

  if (!voterUserId) return error("missing_voter", 400);
  if (!voteType) return error("invalid_vote_type", 400);

  const result = await castBmidBoxVote(id, { voterUserId, voterName, voteType });
  if (!result.ok) {
    const status =
      result.reason === "not_found" ? 404 : result.reason === "already_voted" ? 409 : 400;
    return error(result.reason, status);
  }

  return json(result.request);
}
