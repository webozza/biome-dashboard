import { NextRequest } from "next/server";
import { buildDelete, buildGetOne } from "@/lib/server/resource";
import { guard } from "@/lib/server/guard";
import { getDoc, updateDoc } from "@/lib/server/firestore";
import type { ContentRequestDoc, DualityRequestDoc } from "@/lib/server/bmid";
import { ensureVotingSession } from "@/lib/server/bmid";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export const GET = buildGetOne("contentRequests");
export const DELETE = buildDelete("contentRequests");

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

  const existing = await getDoc<ContentRequestDoc>("contentRequests", id);
  if (!existing) return error("not_found", 404);

  const requestedStatus = typeof body.status === "string" ? body.status : null;

  if (requestedStatus === "approved") {
    if (existing.type === "duality" && existing.taggedUserAction !== "accepted") {
      return error("tagged_user_pending", 400);
    }

    try {
      await updateDoc("contentRequests", id, {
        ...body,
        status: "in_review",
        votingStatus: "open",
        votingOutcome: null,
      });

      if (existing.type === "duality") {
        const duality = await getDoc<DualityRequestDoc>("dualityRequests", id);
        if (duality) {
          await updateDoc("dualityRequests", id, {
            status: "approved",
            reviewedBy: body.reviewedBy ?? duality.reviewedBy ?? null,
            adminNote: body.adminNote ?? duality.adminNote ?? null,
            decisionHistory: [
              ...(duality.decisionHistory || []),
              {
                action: "Approved",
                by: String(body.reviewedBy || "Admin"),
                at: new Date().toISOString().split("T")[0],
              },
            ],
            timeline: [
              ...(duality.timeline || []),
              { event: "Admin approved", at: new Date().toISOString().split("T")[0] },
            ],
          });
        }
      }

      const fresh = (await getDoc<ContentRequestDoc>("contentRequests", id)) as ContentRequestDoc;
      await ensureVotingSession(fresh);
      const synced = await getDoc<ContentRequestDoc>("contentRequests", id);
      return json(synced);
    } catch (e) {
      return error("update_failed", 500, { detail: String((e as Error).message) });
    }
  }

  if (requestedStatus === "rejected" && existing.type === "duality") {
    const duality = await getDoc<DualityRequestDoc>("dualityRequests", id);
    if (duality) {
      await updateDoc("dualityRequests", id, {
        status: "rejected",
        reviewedBy: body.reviewedBy ?? duality.reviewedBy ?? null,
        adminNote: body.adminNote ?? duality.adminNote ?? null,
        decisionHistory: [
          ...(duality.decisionHistory || []),
          {
            action: "Rejected",
            by: String(body.reviewedBy || "Admin"),
            at: new Date().toISOString().split("T")[0],
          },
        ],
        timeline: [
          ...(duality.timeline || []),
          { event: "Admin rejected", at: new Date().toISOString().split("T")[0] },
        ],
      });
    }
  }

  try {
    await updateDoc("contentRequests", id, body);
    const fresh = await getDoc("contentRequests", id);
    return json(fresh);
  } catch (e) {
    return error("update_failed", 500, { detail: String((e as Error).message) });
  }
}
