import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { buildDualityRequestFromContent } from "@/lib/server/bmid";
import { createDoc } from "@/lib/server/firestore";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

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
  const taggedUserId = type === "duality" && typeof body.taggedUserId === "string" ? body.taggedUserId : user.uid;
  let taggedUserName = userName;
  if (type === "duality") {
    if (!taggedUserId || taggedUserId === user.uid) return error("invalid_tagged_user", 400);
    const taggedSnap = await db().collection("users").doc(taggedUserId).get();
    if (!taggedSnap.exists) return error("tagged_user_not_found", 404);
    const tagged = taggedSnap.data() as Record<string, unknown>;
    taggedUserName = String(tagged.name || tagged.displayName || tagged.email || "Tagged User");
  }

  const payload = {
    userId: user.uid,
    userName,
    bmidNumber: typeof profile.bmidNumber === "string" ? profile.bmidNumber : "",
    postId,
    postTitle,
    postPreview,
    postImageUrl: postImageUrl || null,
    type,
    taggedUserId,
    taggedUserName,
    taggedUserAction: type === "own" ? "accepted" : "pending",
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
        taggedUserId,
        taggedUserName,
        taggedUserAction: "pending",
      });
    }
    return json({ id }, 201);
  } catch (e) {
    return error("transfer_failed", 500, { detail: String((e as Error).message) });
  }
}
