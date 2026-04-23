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
      db().collection("contentRequests").where("userId", "==", user.uid).orderBy("createdAt", "desc").limit(100).get(),
      db().collection("contentRequests").where("taggedUserId", "==", user.uid).orderBy("createdAt", "desc").limit(100).get(),
    ]);

    const map = new Map<string, Record<string, unknown>>();
    for (const doc of [...createdSnap.docs, ...taggedSnap.docs]) {
      map.set(doc.id, { id: doc.id, ...(doc.data() as Record<string, unknown>) });
    }
    return json({ items: Array.from(map.values()) });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
