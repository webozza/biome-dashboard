import { NextRequest } from "next/server";
import { buildDelete } from "@/lib/server/resource";
import { guard } from "@/lib/server/guard";
import { getDoc, updateDoc } from "@/lib/server/firestore";
import type { ContentRequestDoc, DualityRequestDoc } from "@/lib/server/bmid";
import { ensureVotingSession } from "@/lib/server/bmid";
import { sendContentApprovalEmail } from "@/lib/server/email/transport";
import {
  buildApprovalNotificationCopy,
  buildNotificationRequestDocPath,
  buildUserPostDocPath,
  notifyUser,
  broadcastPostNotification,
} from "@/lib/server/notifications";
import { error, json } from "@/lib/server/response";

type UserEmailDoc = { email?: string | null; name?: string | null; displayName?: string | null };

export const dynamic = "force-dynamic";

export const DELETE = buildDelete("contentRequests");

function normalizeContentStatus<T extends Record<string, unknown>>(content: T): T {
  return content.status === "in_review" && content.votingStatus === "open"
    ? { ...content, status: "approved" }
    : content;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  const { id } = await ctx.params;
  try {
    const item = await getDoc<Record<string, unknown>>("contentRequests", id);
    if (!item) return error("not_found", 404);
    return json(normalizeContentStatus(item));
  } catch (e) {
    return error("get_failed", 500, { detail: String((e as Error).message) });
  }
}

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
    console.log("[content][approve][debug] request_received", {
      requestId: id,
      ownerUserId: existing.userId,
      ownerUserName: existing.userName,
      postTitle: existing.postTitle,
      requestType: existing.type,
      currentStatus: existing.status,
      currentVotingStatus: existing.votingStatus || null,
    });

    const alreadyHandledApproval =
      existing.status === "in_review" ||
      existing.votingStatus === "open" ||
      existing.votingStatus === "finalized" ||
      existing.status === "approved";
    if (alreadyHandledApproval) {
      console.log("[content][approve][debug] duplicate_approval_skipped", {
        requestId: id,
        ownerUserId: existing.userId,
        currentStatus: existing.status,
        currentVotingStatus: existing.votingStatus || null,
      });
      return json(existing);
    }

    if (existing.type === "duality" && existing.taggedUserAction !== "accepted") {
      return error("tagged_user_pending", 400);
    }

    try {
      await updateDoc("contentRequests", id, {
        ...body,
        status: "approved",
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
      console.log("[content][approve][debug] voting_opened", {
        requestId: id,
        ownerUserId: existing.userId,
        syncedStatus: synced?.status || null,
        syncedVotingStatus: synced?.votingStatus || null,
      });

      // BROADCAST Notification to Followers + Verified Users
      if (existing.userId) {
        const actorName = existing.userName || "User";
        const postId = existing.postId ?? null;
        const postDocPath = buildUserPostDocPath(existing.userId, postId);
        const requestDocPath = buildNotificationRequestDocPath("content", id);
        const { title, body } = buildApprovalNotificationCopy({
          actorName,
          source: "content",
          requestType: existing.type === "duality" ? "duality" : "own",
          postTitle: existing.postTitle ?? null,
        });

        console.log("[content][approve][debug] broadcast_started", {
          requestId: id,
          actorUid: existing.userId,
          actorName,
          title,
        });
        await broadcastPostNotification(existing.userId, actorName, {
          type: "bmid_content_approved",
          title,
          body,
          bmidRequestId: id,
          bmidSource: "content",
          bmidDecision: "accepted",
          authorId: existing.userId,
          postId,
          docPath: postDocPath,
          requestDocPath,
        });

        await notifyUser(existing.userId, {
          type: "bmid_content_approved",
          title: "Your BMID content was approved",
          body: existing.postTitle
            ? `Your post "${existing.postTitle}" was approved. Voting is now open.`
            : "Your post was approved. Voting is now open.",
          bmidRequestId: id,
          bmidSource: "content",
          bmidDecision: "accepted",
          fromUid: "admin",
          authorId: existing.userId,
          postId,
          docPath: postDocPath,
          requestDocPath,
        });
      }

      // Email owner that admin approved + voting opened.
      // Duality flows go through /api/duality/[id] which sends its own email,
      // so we only fire from here for "own" type to avoid double-sending.
      if (existing.type === "own") {
        const ownerUser = await getDoc<UserEmailDoc>("users", existing.userId).catch(() => null);
        if (ownerUser?.email) {
          void sendContentApprovalEmail(ownerUser.email, {
            ownerName: existing.userName || ownerUser.name || ownerUser.displayName || "there",
            postTitle: existing.postTitle ?? null,
            taggedUserName: null,
            isDuality: false,
          });
        }
      }

      return json(synced);
    } catch (e) {
      return error("update_failed", 500, { detail: String((e as Error).message) });
    }
  }

  if (requestedStatus === "rejected") {
    if (existing.type === "duality") {
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

    // Direct Notify owner on rejection
    if (existing.userId) {
      const postId = existing.postId ?? null;
      await notifyUser(existing.userId, {
        type: "bmid_content_rejected",
        title: "BMID Content Update",
        body: `Your post "${existing.postTitle || "Untitled post"}" was not approved. Reason: ${String(body.rejectionReason || "Rejected by admin")}`,
        bmidRequestId: id,
        bmidSource: "content",
        bmidDecision: "rejected",
        authorId: existing.userId,
        postId,
        docPath: buildUserPostDocPath(existing.userId, postId),
        requestDocPath: buildNotificationRequestDocPath("content", id),
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
