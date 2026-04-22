import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminToken = (process.env.ADMIN_API_TOKEN || "").trim();
  if (!adminToken) return error("server_not_configured", 500);

  const check = await requireFirebaseUser(req);
  if (!check.ok) return error("unauthorized", 401, { reason: check.reason });
  if (!check.isAdmin) return error("not_admin", 403);

  return json({
    token: adminToken,
    user: { uid: check.uid, email: check.email },
  });
}
