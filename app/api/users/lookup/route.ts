import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

type UserDoc = {
  email?: string | null;
  name?: string | null;
  userName?: string | null;
  username?: string | null;
  displayName?: string | null;
  handle?: string | null;
  bmidNumber?: string | null;
  verified?: boolean | null;
  deleted?: boolean | null;
  deactivated?: boolean | null;
  status?: string | null;
};

function resolveDisplayName(data: UserDoc, fallbackEmail: string) {
  return (
    data.displayName ||
    data.userName ||
    data.username ||
    data.name ||
    data.handle ||
    fallbackEmail
  );
}

function isInactiveUser(data: UserDoc) {
  const status = String(data.status || "").toLowerCase();
  return Boolean(data.deleted) || Boolean(data.deactivated) || status === "deleted" || status === "deactivated";
}

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));
  const verifiedOnly = url.searchParams.get("verified") === "true";

  try {
    const snap = await db().collection("users").limit(limit).get();
    const items = snap.docs
      .map((doc) => {
        const data = doc.data() as UserDoc;
        const email = String(data.email || "").trim();
        if (!email || isInactiveUser(data)) return null;
        const isVerified = Boolean(data.verified) || Boolean(typeof data.bmidNumber === "string" && data.bmidNumber.trim());
        if (verifiedOnly && !isVerified) return null;
        return {
          id: doc.id,
          email,
          displayName: resolveDisplayName(data, email),
        };
      })
      .filter((item): item is { id: string; email: string; displayName: string } => Boolean(item))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return json({ items });
  } catch (e) {
    return error("users_lookup_failed", 500, { detail: String((e as Error).message) });
  }
}
