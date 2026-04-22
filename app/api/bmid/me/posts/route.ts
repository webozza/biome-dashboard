import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { pickFirstImage, pickVideoThumbnail } from "@/lib/server/share/media";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") || "100");
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitParam) ? limitParam : 100));

  try {
    const snap = await db()
      .collection("users")
      .doc(user.uid)
      .collection("posts")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const items = snap.docs.map((doc) => {
      const raw = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        title: String(raw.title || raw.headline || raw.name || raw.caption || "Untitled post"),
        description: String(raw.caption || raw.description || raw.text || raw.title || ""),
        imageUrl: pickFirstImage(raw) || pickVideoThumbnail(raw) || null,
        createdAt: raw.createdAt ?? null,
      };
    });
    return json({ items });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
