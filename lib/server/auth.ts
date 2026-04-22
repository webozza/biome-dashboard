import { NextRequest } from "next/server";
import { auth } from "./firebase";

export function requireAdmin(req: NextRequest): { ok: true } | { ok: false; reason: string } {
  const expected = (process.env.ADMIN_API_TOKEN || "").trim();
  if (!expected) return { ok: false, reason: "server_not_configured" };

  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim() || req.headers.get("x-admin-token")?.trim() || "";

  if (!token) return { ok: false, reason: "missing_token" };
  if (token !== expected) return { ok: false, reason: "invalid_token" };
  return { ok: true };
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export type FirebaseUserCheck =
  | { ok: true; uid: string; email: string | null; isAdmin: boolean }
  | { ok: false; reason: string };

export async function requireFirebaseUser(req: NextRequest): Promise<FirebaseUserCheck> {
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  if (!token) return { ok: false, reason: "missing_token" };
  try {
    const decoded = await auth().verifyIdToken(token);
    const email = decoded.email || null;
    return { ok: true, uid: decoded.uid, email, isAdmin: isAdminEmail(email) };
  } catch {
    return { ok: false, reason: "invalid_id_token" };
  }
}
