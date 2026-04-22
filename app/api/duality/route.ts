import { NextRequest } from "next/server";
import { buildCreate } from "@/lib/server/resource";
import { guard } from "@/lib/server/guard";
import { db } from "@/lib/server/firebase";
import { ensureBmidBoxSeeded } from "@/lib/server/bmid-box";
import { error, json, parsePagination } from "@/lib/server/response";

export const dynamic = "force-dynamic";

const FILTER_FIELDS = ["status", "ownerId", "taggedUserId", "source", "taggedUserAction"] as const;

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const url = new URL(req.url);
  const { limit, cursor } = parsePagination(url);

  const filters: Record<string, string> = {};
  for (const field of FILTER_FIELDS) {
    const value = url.searchParams.get(field);
    if (value !== null && value !== "") filters[field] = value;
  }

  try {
    await ensureBmidBoxSeeded();
    type Item = { id: string } & Record<string, unknown>;
    const snap = await db().collection("dualityRequests").get();
    const toItem = (doc: FirebaseFirestore.QueryDocumentSnapshot): Item =>
      ({ id: doc.id, ...(doc.data() as Record<string, unknown>) });
    const all: Item[] = snap.docs
      .map(toItem)
      .filter((item) => {
        for (const [field, value] of Object.entries(filters)) {
          if (String(item[field] ?? "") !== value) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aCreated = String(a.createdAt || "");
        const bCreated = String(b.createdAt || "");
        return bCreated.localeCompare(aCreated);
      });

    let startIndex = 0;
    if (cursor) {
      const idx = all.findIndex((item) => item.id === cursor);
      if (idx >= 0) startIndex = idx + 1;
    }
    const page = all.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < all.length ? page[page.length - 1]?.id ?? null : null;

    return json({ items: page, nextCursor });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}

export const POST = buildCreate("dualityRequests");
