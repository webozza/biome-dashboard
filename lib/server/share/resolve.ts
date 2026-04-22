import { db } from "../firebase";
import { findPostById, loadComments, type ShareComment } from "./posts";
import {
  pickFirstImage,
  pickAllImages,
  pickFirstVideo,
  pickVideoThumbnail,
  generateFrameFromVideo,
  checkExistingFrame,
} from "./media";
import { ogProxyUrl } from "./utils";

type AnyRecord = Record<string, unknown>;

export interface ResolvedShare {
  authorId: string;
  docId: string;
  kind: "post" | "reel";
  userName: string;
  description: string;
  image: string;
  ogImage: string;
  videoUrl: string;
  videoThumbImage: string;
  ogVideoThumbImage: string;
  likesCount: number;
  commentsCount: number;
  commentsList: ShareComment[];
  imageURLs: string[];
  raw: AnyRecord;
}

async function fetchAuthorName(authorId: string, fallback = ""): Promise<string> {
  if (!authorId) return fallback;
  try {
    const snap = await db().collection("users").doc(authorId).get();
    if (!snap.exists) return fallback;
    const u = snap.data() as AnyRecord;
    return String(
      u.displayName || u.username || u.userName || u.name || u.handle || fallback
    );
  } catch {
    return fallback;
  }
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function resolveShare(params: {
  authorId: string;
  docId: string;
  kind: "post" | "reel";
}): Promise<ResolvedShare | null> {
  const { authorId, docId, kind } = params;
  const collection = kind === "reel" ? "reels" : "posts";

  let docSnap = await db()
    .collection("users")
    .doc(authorId)
    .collection(collection)
    .doc(docId)
    .get();

  if (!docSnap.exists && kind === "post") {
    const fallback = await findPostById(docId);
    if (fallback) docSnap = fallback as typeof docSnap;
  }

  if (!docSnap.exists) return null;

  const data = (docSnap.data() || {}) as AnyRecord;
  const effectiveAuthorId = String(data.authorId || data.userId || authorId);

  const image = pickFirstImage(data);
  const imageURLs = pickAllImages(data);
  const videoUrl = pickFirstVideo(data);
  let videoThumbImage = pickVideoThumbnail(data);

  if (videoUrl && !videoThumbImage) {
    const prefix = `shareThumbs/${effectiveAuthorId}/${docId}`;
    const existing = await checkExistingFrame(prefix);
    if (existing) {
      videoThumbImage = existing;
    } else {
      try {
        videoThumbImage = await generateFrameFromVideo(videoUrl, prefix);
      } catch (e) {
        console.warn("[share/resolve] frame generation failed:", (e as Error).message);
      }
    }
  }

  const userName =
    String(data.userName || data.authorName || data.displayName || "") ||
    (await fetchAuthorName(effectiveAuthorId, "Biome Aura User"));

  const description = String(
    data.caption || data.description || data.text || data.title || ""
  );

  const likesCount = toNumber(
    data.likesCount ?? data.likeCount ?? (Array.isArray(data.likes) ? data.likes.length : 0)
  );
  const commentsCount = toNumber(
    data.commentsCount ?? data.commentCount ?? 0
  );

  const commentsList = await loadComments(effectiveAuthorId, collection, docId, 3);

  const ogImage = image ? ogProxyUrl(image) : "";
  const ogVideoThumbImage = videoThumbImage ? ogProxyUrl(videoThumbImage) : "";

  return {
    authorId: effectiveAuthorId,
    docId,
    kind,
    userName,
    description,
    image,
    ogImage,
    videoUrl,
    videoThumbImage,
    ogVideoThumbImage,
    likesCount,
    commentsCount,
    commentsList,
    imageURLs,
    raw: data,
  };
}
