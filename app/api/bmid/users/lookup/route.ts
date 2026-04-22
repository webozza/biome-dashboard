import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));

  try {
    const snap = await db().collection("users").limit(limit).get();
    const items = snap.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const email = String(data.email || "").trim();
        return {
          id: doc.id,
          email,
          displayName: String(data.displayName || data.userName || data.username || data.name || email || "User"),
        };
      })
      .filter((item) => item.id !== user.uid)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    return json({ items });
  } catch (e) {
    return error("users_lookup_failed", 500, { detail: String((e as Error).message) });
  }
}
