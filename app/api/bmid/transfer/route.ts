import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { buildDualityRequestFromContent } from "@/lib/server/bmid";
import type { TaggedUserState } from "@/lib/server/bmid";
import { createDoc } from "@/lib/server/firestore";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";
import { notifyAdminRequestCreated } from "@/lib/server/admin-request-email";

export const dynamic = "force-dynamic";

function parseTaggedUserIds(body: Record<string, unknown>) {
  const raw =
    Array.isArray(body.taggedUserIds)
      ? body.taggedUserIds
      : Array.isArray(body.taggedUsers)
        ? body.taggedUsers.map((tagged) =>
            typeof tagged === "string"
              ? tagged
              : tagged && typeof tagged === "object" && "id" in tagged
                ? (tagged as { id?: unknown }).id
                : tagged && typeof tagged === "object" && "userId" in tagged
                  ? (tagged as { userId?: unknown }).userId
                  : null
          )
        : typeof body.taggedUserId === "string"
          ? [body.taggedUserId]
          : [];

  return [...new Set(raw.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).map((id) => id.trim()))];
}

export async function POST(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  const profileSnap = await db().collection("users").doc(user.uid).get();
  if (!profileSnap.exists) return error("user_not_found", 404);
  const profile = profileSnap.data() as Record<string, unknown>;
  const verified = profile.verified === true || typeof profile.bmidNumber === "string";
  if (!verified) return error("not_verified", 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const type = body.type === "duality" ? "duality" : "own";
  const postId = typeof body.postId === "string" ? body.postId : "";
  const postTitle = typeof body.postTitle === "string" ? body.postTitle.trim() : "";
  const postPreview = typeof body.postPreview === "string" ? body.postPreview.trim() : "";
  const postImageUrl = typeof body.postImageUrl === "string" ? body.postImageUrl.trim() : "";
  if (!postId || !postTitle || !postPreview) return error("missing_fields", 400);

  const postSnap = await db().collection("users").doc(user.uid).collection("posts").doc(postId).get();
  if (!postSnap.exists) return error("post_not_found", 404);

  const userName = String(profile.name || profile.displayName || user.email || "User");
  const taggedUserIds = type === "duality" ? parseTaggedUserIds(body) : [user.uid];
  if (type === "duality" && taggedUserIds.length === 0) return error("missing_tagged_user", 400);
  if (type === "duality" && taggedUserIds.includes(user.uid)) return error("invalid_tagged_user", 400);

  const taggedUsers: TaggedUserState[] = [];
  if (type === "duality") {
    for (const taggedUserId of taggedUserIds) {
      const taggedSnap = await db().collection("users").doc(taggedUserId).get();
      if (!taggedSnap.exists) return error("tagged_user_not_found", 404, { taggedUserId });
      const tagged = taggedSnap.data() as Record<string, unknown>;
      taggedUsers.push({
        userId: taggedUserId,
        name: String(tagged.name || tagged.displayName || tagged.email || "Tagged User"),
        action: "pending",
      });
    }
  } else {
    taggedUsers.push({ userId: user.uid, name: userName, action: "accepted" });
  }
  const primaryTagged = taggedUsers[0];
  const taggedUserName = taggedUsers.map((tagged) => tagged.name).join(", ");

  const payload = {
    userId: user.uid,
    userName,
    bmidNumber: typeof profile.bmidNumber === "string" ? profile.bmidNumber : "",
    postId,
    postTitle,
    postPreview,
    postImageUrl: postImageUrl || null,
    type,
    taggedUserId: primaryTagged.userId,
    taggedUserName,
    taggedUserAction: type === "own" ? "accepted" : "pending",
    taggedUsers,
    status: type === "own" ? "pending" : "waiting_tagged",
    adminNotes: [],
    reviewedBy: null,
    rejectionReason: null,
    voteAccept: 0,
    voteIgnore: 0,
    voteRefuse: 0,
    votingStatus: null,
    votingOutcome: null,
  };

  try {
    const id = await createDoc("contentRequests", payload);
    if (type === "duality") {
      await buildDualityRequestFromContent(id, {
        ownerId: user.uid,
        ownerName: userName,
        taggedUserId: primaryTagged.userId,
        taggedUserName: primaryTagged.name,
        taggedUserAction: "pending",
        taggedUsers,
      });
    }
    await notifyAdminRequestCreated({
      requestId: id,
      type: "Content",
      userName,
      userEmail: user.email || String(profile.email || ""),
      details: `Title: ${postTitle || "N/A"}\nType: ${type}\nPlatform: ${String(body.platform || "N/A")}`,
      dashboardPath: `/dashboard/content/${id}`,
      docPath: `contentRequests/${id}`,
    });
    return json({ id }, 201);
  } catch (e) {
    return error("transfer_failed", 500, { detail: String((e as Error).message) });
  }
}
