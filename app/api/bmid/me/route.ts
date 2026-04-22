import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  const snap = await db().collection("users").doc(user.uid).get();
  if (!snap.exists) return error("user_not_found", 404);
  const data = snap.data() as Record<string, unknown>;

  return json({
    id: snap.id,
    name: String(data.name || data.displayName || user.email || "User"),
    email: String(data.email || user.email || ""),
    bmidNumber: typeof data.bmidNumber === "string" ? data.bmidNumber : null,
    verified: data.verified === true || typeof data.bmidNumber === "string",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
  });
}
