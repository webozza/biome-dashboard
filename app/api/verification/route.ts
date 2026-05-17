import { NextRequest } from "next/server";
import { requireAdmin, requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { createDoc } from "@/lib/server/firestore";
import { guard } from "@/lib/server/guard";
import { error, json, parsePagination } from "@/lib/server/response";
import { ensureReservedBmidAssignmentsSynced } from "@/lib/server/bmid-number";
import { notifyAdminRequestCreated } from "@/lib/server/admin-request-email";

export const dynamic = "force-dynamic";

type VerificationListDoc = {
  id: string;
  createdAt?: unknown;
  status?: unknown;
  platform?: unknown;
  userId?: unknown;
};

function normalizedParam(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim();
  return value ? value.toLowerCase() : null;
}

function normalizedValue(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function createdAtTime(value: unknown) {
  if (typeof value !== "string") return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

async function listVerificationRequests(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const url = new URL(req.url);
  const { limit, cursor } = parsePagination(url);
  const status = normalizedParam(url, "status");
  const platform = normalizedParam(url, "platform");
  const userId = url.searchParams.get("userId")?.trim() || null;

  try {
    const snap = await db().collection("verificationRequests").get();
    const rows = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as VerificationListDoc))
      .filter((row) => !status || normalizedValue(row.status) === status)
      .filter((row) => !platform || normalizedValue(row.platform) === platform)
      .filter((row) => !userId || row.userId === userId)
      .sort((a, b) => {
        const byDate = createdAtTime(b.createdAt) - createdAtTime(a.createdAt);
        return byDate || b.id.localeCompare(a.id);
      });

    const start = cursor ? Math.max(rows.findIndex((row) => row.id === cursor) + 1, 0) : 0;
    const page = rows.slice(start, start + limit);

    return json({
      items: page,
      nextCursor: start + limit < rows.length ? page[page.length - 1]?.id ?? null : null,
    });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}

export async function GET(req: NextRequest) {
  await ensureReservedBmidAssignmentsSynced();
  return listVerificationRequests(req);
}

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
      const payload: Record<string, unknown> = {
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
      await notifyAdminRequestCreated({
        requestId: id,
        type: "Verification",
        userName: String(payload.userName || resolved.user.name || "Unknown User"),
        userEmail: String(payload.email || ""),
        details: `Platform: ${String(payload.platform || "N/A")}\nSocial Account: ${String(payload.socialAccount || "N/A")}`,
        dashboardPath: "/dashboard/verification",
        docPath: `verificationRequests/${id}`,
      });
      return json({ id }, 201);
    } catch (e) {
      return error("create_failed", 500, { detail: String((e as Error).message) });
    }
  }

  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  const payload: Record<string, unknown> = {
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
    await notifyAdminRequestCreated({
      requestId: id,
      type: "Verification",
      userName: String(payload.userName || user.email || "Unknown User"),
      userEmail: String(payload.email || ""),
      details: `Platform: ${String(payload.platform || "N/A")}\nSocial Account: ${String(payload.socialAccount || "N/A")}`,
      dashboardPath: "/dashboard/verification",
      docPath: `verificationRequests/${id}`,
    });
    return json({ id }, 201);
  } catch (e) {
    return error("create_failed", 500, { detail: String((e as Error).message) });
  }
}
