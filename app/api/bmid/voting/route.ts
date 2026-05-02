import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { ensureBmidBoxSeeded } from "@/lib/server/bmid-box";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

type VotingFeedItem = {
  id: string;
  requestType: "content" | "box";
  ownerId: string | null;
  ownerName: string | null;
  bmidNumber: string | null;
  postId: string | null;
  postTitle: string | null;
  postPreview: string | null;
  postImageUrl: string | null;
  type: string;
  taggedUserId: string | null;
  taggedUserName: string | null;
  voteAccept: number;
  voteIgnore: number;
  voteRefuse: number;
  votingStatus: string | null;
  myDecision: string | null;
  createdAt: string | null;
  sourceUrl: string | null;
  sourcePlatform: string | null;
};

export async function GET(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  const profileSnap = await db().collection("users").doc(user.uid).get();
  if (!profileSnap.exists) return error("user_not_found", 404);
  const profile = profileSnap.data() as Record<string, unknown>;
  const verified = profile.verified === true || typeof profile.bmidNumber === "string";
  if (!verified) return error("not_verified", 403);

  try {
    await ensureBmidBoxSeeded();

    const [contentSnap, boxSnap] = await Promise.all([
      db().collection("contentRequests").get(),
      db().collection("bmidBoxRequests").get(),
    ]);

    type ContentDoc = {
      id: string;
      userId?: string;
      userName?: string;
      bmidNumber?: string;
      postId?: string;
      postTitle?: string;
      postPreview?: string;
      postImageUrl?: string;
      type?: string;
      taggedUserId?: string;
      taggedUserName?: string;
      voteAccept?: number | string;
      voteIgnore?: number | string;
      voteRefuse?: number | string;
      votingStatus?: string;
      createdAt?: string;
    };

    const openContent: ContentDoc[] = contentSnap.docs
      .map(
        (d) =>
          ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as ContentDoc
      )
      .filter((c) => c.votingStatus === "open");

    const myContentVotes = await Promise.all(
      openContent.map((c) =>
        db()
          .collection("votingItems")
          .doc(String(c.id))
          .collection("votes")
          .doc(user.uid)
          .get()
      )
    );

    const contentItems: VotingFeedItem[] = openContent.map((c, i) => {
      const voteSnap = myContentVotes[i];
      const myDecision = voteSnap.exists
        ? (voteSnap.data() as { decision?: string } | undefined)?.decision ?? null
        : null;
      return {
        id: String(c.id),
        requestType: "content",
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
        sourceUrl: null,
        sourcePlatform: null,
      };
    });

    const boxItems: VotingFeedItem[] = boxSnap.docs
      .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
      .filter(
        ({ data }) => data.votingStatus === "open" && data.currentStatus !== "removed"
      )
      .map(({ id, data }) => {
        const owner =
          (data.ownerSnapshot as {
            userId?: string;
            name?: string;
            bmidNumber?: string | null;
          } | undefined) || {};
        const tagged =
          (data.taggedSnapshot as { userId?: string; name?: string } | undefined) || {};
        const preview =
          (data.previewData as {
            title?: string;
            caption?: string;
            thumbnailUrl?: string;
          } | undefined) || {};
        const votes =
          (data.votes as { voterUserId?: string; voteType?: string }[] | undefined) || [];
        const mine = votes.find((v) => v.voterUserId === user.uid);
        return {
          id,
          requestType: "box" as const,
          ownerId: owner.userId ?? (data.ownerUserId as string) ?? null,
          ownerName: owner.name ?? null,
          bmidNumber: owner.bmidNumber ?? null,
          postId: id,
          postTitle: preview.title ?? null,
          postPreview: preview.caption ?? null,
          postImageUrl: preview.thumbnailUrl ?? null,
          type: (data.type as string) ?? "own",
          taggedUserId: tagged.userId ?? (data.taggedUserId as string) ?? null,
          taggedUserName: tagged.name ?? null,
          voteAccept: Number(data.acceptCount || 0),
          voteIgnore: Number(data.ignoreCount || 0),
          voteRefuse: Number(data.refuseCount || 0),
          votingStatus: (data.votingStatus as string) ?? null,
          myDecision: mine?.voteType ?? null,
          createdAt:
            (data.votingStartAt as string) ||
            (data.submittedAt as string) ||
            (data.createdAt as string) ||
            null,
          sourceUrl: (data.sourceUrl as string) ?? null,
          sourcePlatform: (data.sourcePlatform as string) ?? null,
        };
      });

    const items = [...contentItems, ...boxItems]
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      )
      .slice(0, 100);

    return json({ items });
  } catch (e) {
    console.error("[bmid/voting] list_failed:", e);
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
