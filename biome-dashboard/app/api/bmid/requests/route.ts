import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  try {
    const [createdSnap, taggedSnap] = await Promise.all([
      db().collection("contentRequests").where("userId", "==", user.uid).get(),
      db().collection("contentRequests").where("taggedUserId", "==", user.uid).get(),
    ]);

    const map = new Map<string, Record<string, unknown>>();
    for (const doc of [...createdSnap.docs, ...taggedSnap.docs]) {
      map.set(doc.id, { id: doc.id, ...(doc.data() as Record<string, unknown>) });
    }
    const items = Array.from(map.values())
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 100);
    return json({ items });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
