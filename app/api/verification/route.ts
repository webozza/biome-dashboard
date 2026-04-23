import { NextRequest } from "next/server";
import { buildList } from "@/lib/server/resource";
import { requireAdmin, requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { createDoc } from "@/lib/server/firestore";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export const GET = buildList("verificationRequests", {
  allowedFilters: ["status", "platform", "userId"],
});

async function resolveUserByEmail(rawEmail: unknown) {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email) return { ok: false as const, reason: "email_required" };
  const snap = await db().collection("users").where("email", "==", email).limit(2).get();
  if (snap.empty) return { ok: false as const, reason: "user_not_found" };
  if (snap.size > 1) return { ok: false as const, reason: "duplicate_email" };
  const doc = snap.docs[0];
  const data = doc.data() as { name?: string; email?: string };
  return {
    ok: true as const,
    user: {
      id: doc.id,
      name: data.name || "",
      email: data.email || email,
    },
  };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const admin = requireAdmin(req);
  if (admin.ok) {
    try {
      const resolved = await resolveUserByEmail(body.email);
      if (!resolved.ok) return error(resolved.reason, 400);
      const payload = {
        ...body,
        userId: resolved.user.id,
        email: resolved.user.email,
        userName:
          typeof body.userName === "string" && body.userName.trim()
            ? body.userName.trim()
            : resolved.user.name,
        status: "pending",
        reviewedBy: null,
        adminNote: null,
        rejectionReason: null,
        documentUrl: null,
      };
      const id = await createDoc("verificationRequests", payload);
      return json({ id }, 201);
    } catch (e) {
      return error("create_failed", 500, { detail: String((e as Error).message) });
    }
  }

  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  const payload = {
    ...body,
    userId: user.uid,
    email: user.email || body.email || null,
    status: "pending",
    reviewedBy: null,
    adminNote: null,
    rejectionReason: null,
  };

  try {
    const id = await createDoc("verificationRequests", payload);
    return json({ id }, 201);
  } catch (e) {
    return error("create_failed", 500, { detail: String((e as Error).message) });
  }
}
