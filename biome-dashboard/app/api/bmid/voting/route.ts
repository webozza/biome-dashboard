import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  const profileSnap = await db().collection("users").doc(user.uid).get();
  if (!profileSnap.exists) return error("user_not_found", 404);
  const profile = profileSnap.data() as Record<string, unknown>;
  const verified = profile.verified === true || typeof profile.bmidNumber === "string";
  if (!verified) return error("not_verified", 403);

  try {
    const snap = await db()
      .collection("votingItems")
      .where("status", "==", "open")
      .orderBy("openedAt", "desc")
      .limit(100)
      .get();
    return json({ items: snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })) });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
