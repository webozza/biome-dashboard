import { NextRequest } from "next/server";
import { db } from "@/lib/server/firebase";
import type { ShareComment } from "@/lib/server/share/posts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const authorId = url.searchParams.get("authorId") || "";
  const postId = url.searchParams.get("postId") || "";
  const reelId = url.searchParams.get("reelId") || "";
  const cursor = url.searchParams.get("cursor") || "";
  const limitParam = Number(url.searchParams.get("limit") || "20");
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitParam) ? limitParam : 20));

  if (!authorId || (!postId && !reelId)) {
    return Response.json(
      { error: "Missing authorId and postId/reelId" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const collection = reelId ? "reels" : "posts";
  const docId = reelId || postId;

  try {
    let q = db()
      .collection("users")
      .doc(authorId)
      .collection(collection)
      .doc(docId)
      .collection("comments")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (cursor) {
      const cursorSnap = await db()
        .collection("users")
        .doc(authorId)
        .collection(collection)
        .doc(docId)
        .collection("comments")
        .doc(cursor)
        .get();
      if (cursorSnap.exists) q = q.startAfter(cursorSnap);
    }

    const snap = await q.get();
    const comments: ShareComment[] = snap.docs.map((d) => {
      const c = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        authorName: String(c.authorName || c.userName || "User"),
        authorPhotoURL: String(c.authorPhotoURL || c.userPhotoURL || ""),
        text: String(c.text || c.comment || ""),
        createdAt: c.createdAt ?? null,
      };
    });

    const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;

    return Response.json({ comments, nextCursor }, { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    console.warn("[api/comments]", (e as Error).message);
    return Response.json(
      { comments: [], nextCursor: null, error: (e as Error).message },
      { status: 200, headers: CORS_HEADERS }
    );
  }
}
