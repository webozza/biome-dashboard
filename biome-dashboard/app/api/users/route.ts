import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { db } from "@/lib/server/firebase";
import { createDoc } from "@/lib/server/firestore";
import { error, json, parsePagination } from "@/lib/server/response";

export const dynamic = "force-dynamic";

type RawUserDoc = {
  name?: string | null;
  displayName?: string | null;
  userName?: string | null;
  username?: string | null;
  handle?: string | null;
  email?: string | null;
  bmidNumber?: string | null;
  verified?: boolean | null;
  role?: string | null;
  avatar?: string | null;
  photoURL?: string | null;
  photoUrl?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function resolveName(data: RawUserDoc, fallbackEmail: string) {
  return (
    data.name ||
    data.displayName ||
    data.userName ||
    data.username ||
    data.handle ||
    fallbackEmail ||
    "Unknown User"
  );
}

function normalizeUser(id: string, data: RawUserDoc) {
  const email = String(data.email || "").trim();
  const bmidNumber = typeof data.bmidNumber === "string" && data.bmidNumber.trim() ? data.bmidNumber.trim() : null;

  return {
    id,
    name: resolveName(data, email),
    displayName: data.displayName || null,
    userName: data.userName || null,
    username: data.username || null,
    handle: data.handle || null,
    email,
    bmidNumber,
    verified: Boolean(data.verified) || Boolean(bmidNumber),
    role: data.role || "user",
    avatar: data.avatar || null,
    photoURL: data.photoURL || data.photoUrl || null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function matchesQuery(
  user: ReturnType<typeof normalizeUser>,
  query: string
) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [
    user.name,
    user.displayName || "",
    user.userName || "",
    user.username || "",
    user.handle || "",
    user.email,
    user.bmidNumber || "",
    user.id,
  ].some((value) => value.toLowerCase().includes(q));
}

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const url = new URL(req.url);
  const { limit, cursor } = parsePagination(url);
  const verifiedParam = url.searchParams.get("verified");
  const q = (url.searchParams.get("q") || "").trim();

  try {
    let query = db().collection("users").orderBy("createdAt", "desc").limit(q ? 500 : limit + 1);

    if (verifiedParam === "true") query = query.where("verified", "==", true).orderBy("createdAt", "desc").limit(q ? 500 : limit + 1);
    if (verifiedParam === "false") query = query.where("verified", "==", false).orderBy("createdAt", "desc").limit(q ? 500 : limit + 1);

    if (cursor && !q) {
      const cursorSnap = await db().collection("users").doc(cursor).get();
      if (cursorSnap.exists) query = query.startAfter(cursorSnap);
    }

    const snap = await query.get();
    let items = snap.docs.map((doc) => normalizeUser(doc.id, doc.data() as RawUserDoc));

    if (q) {
      items = items.filter((user) => matchesQuery(user, q));
      items.sort((a, b) => a.name.localeCompare(b.name));
      return json({ items: items.slice(0, limit), nextCursor: null });
    }

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return json({ items: page, nextCursor: hasMore ? page[page.length - 1].id : null });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}

export async function POST(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  try {
    const id = await createDoc("users", body);
    return json({ id }, 201);
  } catch (e) {
    return error("create_failed", 500, { detail: String((e as Error).message) });
  }
}
