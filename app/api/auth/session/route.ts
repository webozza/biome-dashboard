import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const check = await requireFirebaseUser(req);
  if (!check.ok) return error("unauthorized", 401, { reason: check.reason });

  const adminToken = (process.env.ADMIN_API_TOKEN || "").trim();
  const role: "super_admin" | "readonly" = check.isAdmin ? "super_admin" : "readonly";

  return json({
    token: check.isAdmin && adminToken ? adminToken : null,
    user: { uid: check.uid, email: check.email, role, isAdmin: check.isAdmin },
  });
}
