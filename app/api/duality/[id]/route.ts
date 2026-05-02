import { NextRequest } from "next/server";
import { buildDelete, buildGetOne } from "@/lib/server/resource";
import { requireAdmin, requireFirebaseUser } from "@/lib/server/auth";
import { applyTaggedUserDecision, ensureVotingSession } from "@/lib/server/bmid";
import type { ContentRequestDoc, DualityRequestDoc } from "@/lib/server/bmid";
import { getDoc, updateDoc } from "@/lib/server/firestore";
import { error, json } from "@/lib/server/response";
import { sendContentApprovalEmail } from "@/lib/server/email/transport";

type UserEmailDoc = { email?: string | null; name?: string | null; displayName?: string | null };

export const dynamic = "force-dynamic";

export const GET = buildGetOne("dualityRequests");
export const DELETE = buildDelete("dualityRequests");

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const duality = await getDoc<DualityRequestDoc>("dualityRequests", id);
  if (!duality) return error("not_found", 404);

  const firebaseUser = await requireFirebaseUser(req);
  const taggedDecision =
    body.taggedUserAction === "accepted" || body.taggedUserAction === "declined"
      ? body.taggedUserAction
      : null;

  if (taggedDecision) {
    if (!firebaseUser.ok) return error("unauthorized", 401, { reason: firebaseUser.reason });
    if (firebaseUser.uid !== duality.taggedUserId && !firebaseUser.isAdmin) {
      return error("forbidden", 403);
    }

    try {
      await applyTaggedUserDecision(id, duality, firebaseUser.email || "Tagged User", taggedDecision);
      const fresh = await getDoc("dualityRequests", id);
      return json(fresh);
    } catch (e) {
      return error("update_failed", 500, { detail: String((e as Error).message) });
    }
  }

  const admin = requireAdmin(req);
  if (!admin.ok) return error("unauthorized", 401, { reason: admin.reason });

  const requestedStatus = typeof body.status === "string" ? body.status : null;

  if (requestedStatus === "approved") {
    if (duality.taggedUserAction !== "accepted") {
      return error("tagged_user_pending", 400);
    }
    try {
      await updateDoc("dualityRequests", id, {
        ...body,
        status: "approved",
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

      const content = await getDoc<ContentRequestDoc>("contentRequests", id);
      if (content) {
        await updateDoc("contentRequests", id, {
          status: "in_review",
          taggedUserAction: "accepted",
          reviewedBy: body.reviewedBy ?? content.reviewedBy ?? null,
          votingStatus: "open",
          votingOutcome: null,
        });
        await ensureVotingSession((await getDoc<ContentRequestDoc>("contentRequests", id)) as ContentRequestDoc);
      }

      const ownerUser = await getDoc<UserEmailDoc>("users", duality.ownerId).catch(() => null);
      if (ownerUser?.email) {
        void sendContentApprovalEmail(ownerUser.email, {
          ownerName: duality.ownerName || ownerUser.name || ownerUser.displayName || "there",
          postTitle: content?.postTitle ?? null,
          taggedUserName: duality.taggedUserName ?? null,
          isDuality: content?.type !== "own",
        });
      }

      const fresh = await getDoc("dualityRequests", id);
      return json(fresh);
    } catch (e) {
      return error("update_failed", 500, { detail: String((e as Error).message) });
    }
  }

  if (requestedStatus === "rejected") {
    try {
      await updateDoc("dualityRequests", id, {
        ...body,
        status: "rejected",
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
      await updateDoc("contentRequests", id, {
        status: "rejected",
        rejectionReason: body.adminNote || "Rejected by admin",
        reviewedBy: body.reviewedBy ?? null,
      });
      const fresh = await getDoc("dualityRequests", id);
      return json(fresh);
    } catch (e) {
      return error("update_failed", 500, { detail: String((e as Error).message) });
    }
  }

  try {
    await updateDoc("dualityRequests", id, body);
    const fresh = await getDoc("dualityRequests", id);
    return json(fresh);
  } catch (e) {
    return error("update_failed", 500, { detail: String((e as Error).message) });
  }
}
