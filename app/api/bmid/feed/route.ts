import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

const PRIVATE_STATUSES = new Set(["pending", "waiting_tagged", "rejected"]);

export async function GET(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") || "50");
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitParam) ? limitParam : 50));
  const statusFilter = url.searchParams.get("status")?.trim() || null;
  const typeFilter = url.searchParams.get("type")?.trim() || null;

  try {
    const snap = await db().collection("contentRequests").get();

    const items = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }))
      .filter((item) => {
        const status = String(item.status || "");
        if (statusFilter) return status === statusFilter;
        return !PRIVATE_STATUSES.has(status);
      })
      .filter((item) => (typeFilter ? String(item.type || "") === typeFilter : true))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, limit);

    return json({ items });
  } catch (e) {
    console.error("[bmid/feed] list_failed:", e);
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
