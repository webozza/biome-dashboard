import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { db } from "@/lib/server/firebase";
import { ensureBmidBoxSeeded } from "@/lib/server/bmid-box";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));

  try {
    await ensureBmidBoxSeeded();
    type PendingDualityItem = { id: string; status?: unknown; createdAt?: unknown } & Record<string, unknown>;
    const toItem = (doc: FirebaseFirestore.QueryDocumentSnapshot): PendingDualityItem =>
      ({ id: doc.id, ...(doc.data() as Record<string, unknown>) });
    const snap = await db().collection("dualityRequests").limit(limit * 3).get();
    const items = snap.docs
      .map(toItem)
      .filter((item) => item.status === "waiting_tagged")
      .sort((a, b) => {
        const aCreated = String(a.createdAt || "");
        const bCreated = String(b.createdAt || "");
        return bCreated.localeCompare(aCreated);
      })
      .slice(0, limit);

    return json({ items });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
