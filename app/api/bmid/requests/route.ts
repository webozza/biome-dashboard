import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

function isTaggedUser(item: Record<string, unknown>, uid: string) {
  const taggedUsers = Array.isArray(item.taggedUsers) ? item.taggedUsers : [];
  return taggedUsers.some((tagged) => {
    const row = tagged as { userId?: unknown };
    return row.userId === uid;
  });
}

export async function GET(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  try {
    const snap = await db().collection("contentRequests").get();
    const items = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as Record<string, unknown> & { id: string }))
      .filter((item) => item.userId === user.uid || item.taggedUserId === user.uid || isTaggedUser(item, user.uid))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 100);
    return json({ items });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
