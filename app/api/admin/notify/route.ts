import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";
import {
  buildApprovalNotificationCopy,
  notifyUser,
  broadcastPostNotification,
  type NotificationType,
} from "@/lib/server/notifications";

export const dynamic = "force-dynamic";

/**
 * Unified notification endpoint for the dashboard.
 * POST /api/admin/notify
 */
export async function POST(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  let body: {
    userId: string;
    contentType: "content" | "box" | "verification";
    requestId: string;
    status: "approved" | "rejected";
    rejectionReason?: string;
    userName?: string;
    postTitle?: string;
    type?: string; // 'own' or 'duality'
  };

  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const { userId, contentType, requestId, status, rejectionReason, userName, postTitle, type } = body;

  if (!userId || !contentType || !requestId || !status) {
    return error("missing_fields", 400, {
      detail: "userId, contentType, requestId, and status are required.",
    });
  }

  const isApproved = status === "approved";
  const actorName = userName || "A user";

  try {
    // 1. Logic for Content and Box approvals (BROADCAST to followers)
    if ((contentType === "content" || contentType === "box") && isApproved) {
      const { title, body } = buildApprovalNotificationCopy({
        actorName,
        source: contentType,
        requestType: type === "duality" ? "duality" : "own",
        postTitle: postTitle ?? null,
      });

      await broadcastPostNotification(userId, actorName, {
        type: contentType === "content" ? "bmid_content_approved" : "bmid_box_approved",
        title,
        body,
        bmidRequestId: requestId,
        bmidSource: contentType,
        bmidDecision: "accepted",
      });
    } 
    // 2. Logic for Rejections or Verification (DIRECT to user)
    else {
      let notificationType: NotificationType;
      let title = "";
      let bodyText = "";

      if (contentType === "verification") {
        notificationType = isApproved ? "bmid_verification_approved" : "bmid_verification_rejected";
        title = isApproved ? "Verification Approved!" : "Verification Update";
        bodyText = isApproved
          ? "Your account verification request was approved. Your BMID is now active."
          : `Your verification request was not approved. Reason: ${rejectionReason || "Rejected by admin review"}`;
      } else if (contentType === "box" && !isApproved) {
        notificationType = "bmid_box_rejected";
        title = "BMID Box Update";
        bodyText = `Your BMID Box request was not approved. Reason: ${rejectionReason || "Rejected by admin review"}`;
      } else if (contentType === "content" && !isApproved) {
        notificationType = "bmid_content_rejected";
        title = "BMID Content Update";
        bodyText = `Your post "${postTitle || "Untitled post"}" was not approved. Reason: ${rejectionReason || "Rejected by admin"}`;
      } else {
        // Fallback for any unhandled case
        return error("invalid_notification_request", 400);
      }

      await notifyUser(userId, {
        type: notificationType,
        title,
        body: bodyText,
        bmidRequestId: requestId,
        bmidSource: contentType,
        bmidDecision: isApproved ? "accepted" : "rejected",
      });
    }

    return json({ success: true });
  } catch (e) {
    console.error("[api/admin/notify] Error sending notification:", e);
    return error("notification_failed", 500, { detail: String((e as Error).message) });
  }
}
