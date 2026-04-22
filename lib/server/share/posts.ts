import { admin, db } from "../firebase";
import type { DocumentSnapshot } from "firebase-admin/firestore";

/** Find a post document at posts/{postId} or any users/{uid}/posts/{postId} */
export async function findPostById(postId: string): Promise<DocumentSnapshot | null> {
  const direct = await db().collection("posts").doc(postId).get();
  if (direct.exists) return direct;

  const snap = await db()
    .collectionGroup("posts")
    .orderBy(admin.firestore.FieldPath.documentId())
    .startAt(db().doc("users/\u0001/posts/" + postId))
    .endAt(db().doc("users/\uf8ff/posts/" + postId))
    .get();

  return snap.docs.find((d) => d.id === postId) || null;
}

export interface ShareComment {
  id: string;
  authorName: string;
  authorPhotoURL: string;
  text: string;
  createdAt: unknown;
}

export async function loadComments(
  authorId: string,
  collection: "posts" | "reels",
  docId: string,
  limit = 3
): Promise<ShareComment[]> {
  try {
    const snap = await db()
      .collection("users")
      .doc(authorId)
      .collection(collection)
      .doc(docId)
      .collection("comments")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    return snap.docs.map((d) => {
      const c = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        authorName: String(c.authorName || c.userName || "User"),
        authorPhotoURL: String(c.authorPhotoURL || c.userPhotoURL || ""),
        text: String(c.text || c.comment || ""),
        createdAt: c.createdAt ?? null,
      };
    });
  } catch (e) {
    console.warn("[share/comments]", (e as Error).message);
    return [];
  }
}
