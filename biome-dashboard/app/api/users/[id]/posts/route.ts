import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { db } from "@/lib/server/firebase";
import { pickFirstImage, pickVideoThumbnail } from "@/lib/server/share/media";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

type PostListItem = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  createdAt: unknown;
};

function toPostListItem(
  id: string,
  raw: Record<string, unknown>
): PostListItem {
  const title = String(raw.title || raw.headline || raw.name || raw.caption || "Untitled post");
  const description = String(raw.caption || raw.description || raw.text || raw.title || "");
  const imageUrl = pickFirstImage(raw) || pickVideoThumbnail(raw) || null;

  return {
    id,
    title,
    description,
    imageUrl,
    createdAt: raw.createdAt ?? null,
  };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") || "100");
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitParam) ? limitParam : 100));

  try {
    const snap = await db()
      .collection("users")
      .doc(id)
      .collection("posts")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const items = snap.docs.map((doc) => toPostListItem(doc.id, doc.data() as Record<string, unknown>));
    return json({ items });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
