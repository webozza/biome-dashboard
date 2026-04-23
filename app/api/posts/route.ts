import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { db } from "@/lib/server/firebase";
import { pickFirstImage, pickVideoThumbnail } from "@/lib/server/share/media";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

type PostRow = {
  id: string;
  ownerId: string;
  authorName: string;
  authorUsername: string | null;
  authorEmail: string;
  authorPhotoURL: string | null;
  title: string;
  description: string;
  imageUrl: string | null;
  createdAt: string | null;
  createdAtMs: number;
};

type RawUserDoc = {
  name?: string | null;
  displayName?: string | null;
  userName?: string | null;
  username?: string | null;
  handle?: string | null;
  email?: string | null;
  photoURL?: string | null;
  photoUrl?: string | null;
};

function toIsoAndMs(value: unknown): { iso: string | null; ms: number } {
  if (!value) return { iso: null, ms: 0 };
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return { iso: d.toISOString(), ms: d.getTime() };
  }
  if (value instanceof Date) return { iso: value.toISOString(), ms: value.getTime() };
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? { iso: value, ms: 0 } : { iso: d.toISOString(), ms: d.getTime() };
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return { iso: d.toISOString(), ms: d.getTime() };
  }
  return { iso: null, ms: 0 };
}

function resolveAuthorName(u: RawUserDoc | null, fallbackEmail: string) {
  if (!u) return fallbackEmail || "Unknown User";
  return (
    u.name ||
    u.displayName ||
    u.userName ||
    u.username ||
    u.handle ||
    u.email ||
    fallbackEmail ||
    "Unknown User"
  );
}

function resolveAuthorUsername(u: RawUserDoc | null): string | null {
  if (!u) return null;
  return u.username || u.userName || u.handle || null;
}

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") || "50");
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitParam) ? limitParam : 50));
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const userIdFilter = url.searchParams.get("userId") || "";

  const scanCap = Math.max(limit, 300);

  try {
    const firestore = db();

    const postsSnap = userIdFilter
      ? await firestore
          .collection("users")
          .doc(userIdFilter)
          .collection("posts")
          .orderBy("createdAt", "desc")
          .limit(scanCap)
          .get()
      : await firestore.collectionGroup("posts").limit(scanCap).get();

    const ownerIds = new Set<string>();
    const postEntries = postsSnap.docs
      .map((doc) => {
        const ownerId = userIdFilter || doc.ref.parent.parent?.id || "";
        if (!ownerId) return null;
        ownerIds.add(ownerId);
        return { doc, ownerId };
      })
      .filter((x): x is { doc: (typeof postsSnap.docs)[number]; ownerId: string } => x !== null);

    const ownerIdList = Array.from(ownerIds);
    const userRefs = ownerIdList.map((id) => firestore.collection("users").doc(id));
    const userSnaps = userRefs.length > 0 ? await firestore.getAll(...userRefs) : [];
    const usersById = new Map<string, RawUserDoc>();
    userSnaps.forEach((snap, i) => {
      if (snap.exists) usersById.set(ownerIdList[i], snap.data() as RawUserDoc);
    });

    let items: PostRow[] = postEntries.map(({ doc, ownerId }) => {
      const raw = doc.data() as Record<string, unknown>;
      const author = usersById.get(ownerId) || null;
      const authorEmail = String(author?.email || "");
      const { iso, ms } = toIsoAndMs(raw.createdAt);
      const title = String(raw.title || raw.headline || raw.name || raw.caption || "Untitled post");
      const description = String(raw.caption || raw.description || raw.text || raw.title || "");

      return {
        id: doc.id,
        ownerId,
        authorName: resolveAuthorName(author, authorEmail),
        authorUsername: resolveAuthorUsername(author),
        authorEmail,
        authorPhotoURL: author?.photoURL || author?.photoUrl || null,
        title,
        description,
        imageUrl: pickFirstImage(raw) || pickVideoThumbnail(raw) || null,
        createdAt: iso,
        createdAtMs: ms,
      };
    });

    if (q) {
      items = items.filter((p) =>
        [
          p.authorName,
          p.authorUsername || "",
          p.authorEmail,
          p.ownerId,
          p.title,
          p.description,
          p.id,
        ]
          .some((v) => v.toLowerCase().includes(q))
      );
    }

    items.sort((a, b) => b.createdAtMs - a.createdAtMs);
    const total = items.length;
    const page = items.slice(0, limit);

    const out = page.map((p) => {
      const { createdAtMs: _ms, ...rest } = p;
      void _ms;
      return rest;
    });
    return json({ items: out, total, scanned: postEntries.length });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
