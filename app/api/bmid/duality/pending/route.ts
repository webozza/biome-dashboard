import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { ensureBmidBoxSeeded } from "@/lib/server/bmid-box";
import { effectiveDualityStatus } from "@/lib/server/bmid";
import type { DualityRequestDoc } from "@/lib/server/bmid";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireFirebaseUser(req);
  if (!user.ok) return error("unauthorized", 401, { reason: user.reason });

  try {
    await ensureBmidBoxSeeded();
    type PendingDualityItem = { id: string; status?: unknown; createdAt?: unknown } & Record<string, unknown>;
    const toItem = (doc: FirebaseFirestore.QueryDocumentSnapshot): PendingDualityItem =>
      ({ id: doc.id, ...(doc.data() as Record<string, unknown>) });
    const snap = await db().collection("dualityRequests").get();
    const items = snap.docs
      .map(toItem)
      .map(
        (item): PendingDualityItem => ({
          ...item,
          status: effectiveDualityStatus(item as unknown as DualityRequestDoc),
        })
      )
      .filter((item) => {
        if (item.status !== "waiting_tagged") return false;
        const taggedUsers = Array.isArray(item.taggedUsers) ? item.taggedUsers : [];
        if (taggedUsers.length > 0) {
          return taggedUsers.some((tagged) => {
            const row = tagged as { userId?: unknown; action?: unknown };
            return row.userId === user.uid && row.action === "pending";
          });
        }
        return item.taggedUserId === user.uid && item.taggedUserAction === "pending";
      })
      .sort((a, b) => {
        const aCreated = String(a.createdAt || "");
        const bCreated = String(b.createdAt || "");
        return bCreated.localeCompare(aCreated);
      })
      .slice(0, 100);

    return json({ items });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
