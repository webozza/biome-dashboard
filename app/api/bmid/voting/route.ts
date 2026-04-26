import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  const profileSnap = await db().collection("users").doc(user.uid).get();
  if (!profileSnap.exists) return error("user_not_found", 404);
  const profile = profileSnap.data() as Record<string, unknown>;
  const verified = profile.verified === true || typeof profile.bmidNumber === "string";
  if (!verified) return error("not_verified", 403);

  try {
    // Source from contentRequests (carries full post + owner metadata) and
    // filter to live voting sessions in memory — avoids a composite index.
    const contentSnap = await db().collection("contentRequests").get();
    const openContent = contentSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
      .filter((c) => c.votingStatus === "open")
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      )
      .slice(0, 100);

    // Pull the current user's prior vote (if any) so the UI can lock the card.
    const myVotes = await Promise.all(
      openContent.map((c) =>
        db()
          .collection("votingItems")
          .doc(String(c.id))
          .collection("votes")
          .doc(user.uid)
          .get()
      )
    );

    const items = openContent.map((c, i) => {
      const voteSnap = myVotes[i];
      const myDecision = voteSnap.exists
        ? (voteSnap.data() as { decision?: string } | undefined)?.decision ?? null
        : null;
      return {
        id: c.id,
        ownerId: c.userId ?? null,
        ownerName: c.userName ?? null,
        bmidNumber: c.bmidNumber ?? null,
        postId: c.postId ?? null,
        postTitle: c.postTitle ?? null,
        postPreview: c.postPreview ?? null,
        postImageUrl: c.postImageUrl ?? null,
        type: c.type ?? "own",
        taggedUserId: c.taggedUserId ?? null,
        taggedUserName: c.taggedUserName ?? null,
        voteAccept: Number(c.voteAccept || 0),
        voteIgnore: Number(c.voteIgnore || 0),
        voteRefuse: Number(c.voteRefuse || 0),
        votingStatus: c.votingStatus ?? null,
        myDecision,
        createdAt: c.createdAt ?? null,
      };
    });

    return json({ items });
  } catch (e) {
    console.error("[bmid/voting] list_failed:", e);
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
