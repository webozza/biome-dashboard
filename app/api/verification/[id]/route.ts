import { NextRequest } from "next/server";
import { buildGetOne } from "@/lib/server/resource";
import { guard } from "@/lib/server/guard";
import { deleteDoc, getDoc, updateDoc } from "@/lib/server/firestore";
import { error, json } from "@/lib/server/response";
import { sendVerificationEmail } from "@/lib/server/email/transport";
import { notifyUser } from "@/lib/server/notifications";
import { db } from "@/lib/server/firebase";

export const dynamic = "force-dynamic";

type VerificationDoc = {
  id: string;
  userId?: string;
  userName?: string;
  email?: string;
  contactEmail?: string | null;
  socialAccount?: string;
  platform?: string;
  status?: string;
  adminNote?: string | null;
  rejectionReason?: string | null;
  bmidNumber?: string | null;
};

function parseBmidSequence(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^BMID-(\d+)$/i);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function formatBmidNumber(sequence: number) {
  return `BMID-${String(sequence).padStart(3, "0")}`;
}

async function ensureApprovedUserState(userId: string): Promise<string | null> {
  return db().runTransaction(async (tx) => {
    const userRef = db().collection("users").doc(userId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return null;

    const userData = userSnap.data() as { bmidNumber?: unknown; verified?: unknown } | undefined;
    const existingBmidNumber =
      typeof userData?.bmidNumber === "string" && userData.bmidNumber.trim()
        ? userData.bmidNumber.trim()
        : null;

    if (existingBmidNumber) {
      tx.set(
        userRef,
        {
          verified: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return existingBmidNumber;
    }

    const usersSnap = await tx.get(db().collection("users"));
    let maxSequence = 0;
    for (const doc of usersSnap.docs) {
      const sequence = parseBmidSequence(doc.data().bmidNumber);
      if (sequence && sequence > maxSequence) maxSequence = sequence;
    }

    const newBmidNumber = formatBmidNumber(maxSequence + 1);
    tx.set(
      userRef,
      {
        verified: true,
        bmidNumber: newBmidNumber,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return newBmidNumber;
  });
}

async function revokeApprovedUserState(userId: string) {
  await db().collection("users").doc(userId).set(
    {
      verified: false,
      bmidNumber: null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export const GET = buildGetOne("verificationRequests");

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  const { id } = await ctx.params;
  let existing: VerificationDoc | null;
  try {
    existing = await getDoc<VerificationDoc>("verificationRequests", id);
  } catch (e) {
    return error("delete_failed", 500, { detail: String((e as Error).message) });
  }
  if (!existing) return error("not_found", 404);

  try {
    if (existing.status === "approved" && existing.userId) {
      await revokeApprovedUserState(existing.userId);
    }
    await deleteDoc("verificationRequests", id);
    return json({ id, deleted: true, revokedUserId: existing.status === "approved" ? existing.userId || null : null });
  } catch (e) {
    return error("delete_failed", 500, { detail: String((e as Error).message) });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  let existing: VerificationDoc | null;
  try {
    existing = await getDoc<VerificationDoc>("verificationRequests", id);
  } catch (e) {
    return error("update_failed", 500, { detail: String((e as Error).message) });
  }
  if (!existing) return error("not_found", 404);

  try {
    await updateDoc("verificationRequests", id, body);
  } catch (e) {
    return error("update_failed", 500, { detail: String((e as Error).message) });
  }

  let fresh = (await getDoc<VerificationDoc>("verificationRequests", id)) as VerificationDoc | null;
  if (!fresh) return error("not_found", 404);

  const prevStatus = existing.status || null;
  const nextStatus = fresh.status || null;

  // Revoke status if transitioning AWAY from approved
  if (prevStatus === "approved" && nextStatus !== "approved" && fresh.userId) {
    try {
      await revokeApprovedUserState(fresh.userId);
      // Also clear bmidNumber on the request itself since it's no longer valid
      await updateDoc("verificationRequests", id, { bmidNumber: null });
      fresh = { ...fresh, bmidNumber: null };
    } catch (e) {
      return error("user_revoke_failed", 500, { detail: String((e as Error).message) });
    }
  }

  const transitionedTo =
    nextStatus && prevStatus !== nextStatus && (nextStatus === "approved" || nextStatus === "rejected")
      ? (nextStatus as "approved" | "rejected")
      : null;

  let bmidNumber: string | null = null;
  if (transitionedTo === "approved" && fresh.userId) {
    try {
      bmidNumber = await ensureApprovedUserState(fresh.userId);
      if (bmidNumber) {
        await updateDoc("verificationRequests", id, { bmidNumber });
        fresh = { ...fresh, bmidNumber } as VerificationDoc;
      }
    } catch (e) {
      return error("user_update_failed", 500, { detail: String((e as Error).message) });
    }
  }

  // Notifications & Emails
  if (transitionedTo && fresh.userId) {
    const isApproved = transitionedTo === "approved";
    void notifyUser(fresh.userId, {
      type: isApproved ? "bmid_verification_approved" : "bmid_verification_rejected",
      title: isApproved ? "Verification Approved!" : "Verification Update",
      body: isApproved 
        ? "Your account verification request was approved. Your BMID is now active."
        : `Your verification request was not approved. Reason: ${fresh.rejectionReason || "Rejected by admin review"}`,
      bmidRequestId: id,
      bmidSource: "verification",
      bmidDecision: isApproved ? "accepted" : "rejected",
    });

    const targetEmail = (fresh.contactEmail || fresh.email || "").trim();
    if (targetEmail) {
      await sendVerificationEmail(targetEmail, transitionedTo, {
        userName: fresh.userName || "there",
        platform: fresh.platform || "your platform",
        socialAccount: fresh.socialAccount || "",
        adminNote: fresh.adminNote ?? null,
        rejectionReason: fresh.rejectionReason ?? null,
      });
    }
  }

  return json(fresh);
}
