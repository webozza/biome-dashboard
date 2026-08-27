import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { deleteDoc, getDoc, updateDoc } from "@/lib/server/firestore";
import { error, json } from "@/lib/server/response";
import { sendVerificationEmail } from "@/lib/server/email/transport";
import { notifyUser } from "@/lib/server/notifications";
import { db } from "@/lib/server/firebase";
import {
  RESERVED_BMID_COUNT,
  ensureReservedBmidAssignmentsSynced,
  formatBmidNumber,
  normalizeReservedSequence,
  parseBmidSequence,
} from "@/lib/server/bmid-number";

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
  previousBmidNumber?: string | null;
  submittedAccounts?: SubmittedAccount[] | null;
};

type SubmittedAccount = {
  platform: string;
  displayName: string;
  profileUrl: string | null;
};

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function connectedAccount(
  platform: string,
  displayName: unknown,
  fallbackName: string,
  profileUrl: unknown
): SubmittedAccount {
  return {
    platform,
    displayName: cleanText(displayName) || fallbackName,
    profileUrl: cleanText(profileUrl),
  };
}

function getConnectedUserAccounts(userData: Record<string, unknown> | undefined): SubmittedAccount[] {
  const socialConnections =
    userData?.socialConnections && typeof userData.socialConnections === "object"
      ? (userData.socialConnections as Record<string, Record<string, unknown> | undefined>)
      : {};
  const socials =
    userData?.socials && typeof userData.socials === "object"
      ? (userData.socials as Record<string, unknown>)
      : {};
  const accounts: SubmittedAccount[] = [];

  if (socialConnections.facebook?.status === "connected") {
    accounts.push(
      connectedAccount(
        "Facebook",
        socialConnections.facebook.name || socialConnections.facebook.facebookUserId,
        "Connected Facebook account",
        socialConnections.facebook.profileUrl || socials.facebook
      )
    );
  }

  if (socialConnections.instagram?.status === "connected") {
    accounts.push(
      connectedAccount(
        "Instagram",
        socialConnections.instagram.username || socialConnections.instagram.instagramUserId,
        "Connected Instagram account",
        socialConnections.instagram.profileUrl || socials.instagram
      )
    );
  }

  if (socialConnections.tiktok?.status === "connected") {
    accounts.push(
      connectedAccount(
        "TikTok",
        socialConnections.tiktok.displayName ||
          socialConnections.tiktok.username ||
          socialConnections.tiktok.openId,
        "Connected TikTok account",
        socialConnections.tiktok.profileUrl || socials.tiktok
      )
    );
  }

  if (socialConnections.youtube?.status === "connected") {
    accounts.push(
      connectedAccount(
        "YouTube",
        socialConnections.youtube.handle ||
          socialConnections.youtube.title ||
          socialConnections.youtube.channelId,
        "Connected YouTube account",
        socialConnections.youtube.profileUrl || socials.youtube
      )
    );
  }

  return accounts;
}

async function enrichVerificationRequest(doc: VerificationDoc): Promise<VerificationDoc> {
  if (!doc.userId) return doc;

  const userSnap = await db().collection("users").doc(doc.userId).get();
  if (!userSnap.exists) return doc;

  const submittedAccounts = getConnectedUserAccounts(userSnap.data() as Record<string, unknown>);
  if (submittedAccounts.length === 0) return doc;

  return {
    ...doc,
    submittedAccounts,
  };
}

async function ensureApprovedUserState(userId: string): Promise<string | null> {
  await ensureReservedBmidAssignmentsSynced();

  return db().runTransaction(async (tx) => {
    const userRef = db().collection("users").doc(userId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return null;

    const userData = userSnap.data() as { bmidNumber?: unknown; previousBmidNumber?: unknown; verified?: unknown } | undefined;
    const existingBmidNumber =
      typeof userData?.bmidNumber === "string" && userData.bmidNumber.trim()
        ? userData.bmidNumber.trim()
        : null;
    const preservedBmidNumber =
      typeof userData?.previousBmidNumber === "string" && userData.previousBmidNumber.trim()
        ? userData.previousBmidNumber.trim()
        : null;

    const reusableBmidNumber = existingBmidNumber || preservedBmidNumber;
    if (reusableBmidNumber) {
      tx.set(
        userRef,
        {
          verified: true,
          bmidNumber: reusableBmidNumber,
          previousBmidNumber: reusableBmidNumber,
          bmidStatus: "active",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return reusableBmidNumber;
    }

    const usersSnap = await tx.get(db().collection("users"));
    let maxSequence = RESERVED_BMID_COUNT;
    for (const doc of usersSnap.docs) {
      const activeSequence = parseBmidSequence(doc.data().bmidNumber);
      const previousSequence = parseBmidSequence(doc.data().previousBmidNumber);
      for (const sequence of [activeSequence, previousSequence]) {
        if (!sequence) continue;
        const normalizedSequence = normalizeReservedSequence(sequence);
        if (normalizedSequence > maxSequence) maxSequence = normalizedSequence;
      }
    }

    const newBmidNumber = formatBmidNumber(maxSequence + 1);
    tx.set(
      userRef,
      {
        verified: true,
        bmidNumber: newBmidNumber,
        previousBmidNumber: newBmidNumber,
        bmidStatus: "active",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return newBmidNumber;
  });
}

async function revokeApprovedUserState(userId: string) {
  const userRef = db().collection("users").doc(userId);
  const userSnap = await userRef.get();
  const userData = userSnap.data() as { bmidNumber?: unknown; previousBmidNumber?: unknown } | undefined;
  const existingBmidNumber =
    typeof userData?.bmidNumber === "string" && userData.bmidNumber.trim()
      ? userData.bmidNumber.trim()
      : null;
  const preservedBmidNumber =
    existingBmidNumber ||
    (typeof userData?.previousBmidNumber === "string" && userData.previousBmidNumber.trim()
      ? userData.previousBmidNumber.trim()
      : null);

  await userRef.set(
    {
      verified: false,
      bmidNumber: null,
      previousBmidNumber: preservedBmidNumber,
      bmidStatus: "cancelled",
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return preservedBmidNumber;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  const { id } = await ctx.params;
  try {
    const existing = await getDoc<VerificationDoc>("verificationRequests", id);
    if (!existing) return error("not_found", 404);
    return json(await enrichVerificationRequest(existing));
  } catch (e) {
    return error("get_failed", 500, { detail: String((e as Error).message) });
  }
}

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

  // Revoke status if transitioning away from approval, or if admin approves a
  // verified user's cancellation request by marking it removed.
  if (
    fresh.userId &&
    ((prevStatus === "approved" && nextStatus !== "approved") ||
      nextStatus === "removed")
  ) {
    try {
      const preservedBmidNumber = await revokeApprovedUserState(fresh.userId);
      // Also clear bmidNumber on the request itself since it's no longer valid
      await updateDoc("verificationRequests", id, { bmidNumber: null, previousBmidNumber: preservedBmidNumber });
      fresh = { ...fresh, bmidNumber: null, previousBmidNumber: preservedBmidNumber };
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
    await notifyUser(fresh.userId, {
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
