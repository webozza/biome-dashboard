import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { createDoc, getDoc } from "@/lib/server/firestore";
import { buildDualityRequestFromBox } from "@/lib/server/bmid";
import { ensureBmidBoxSeeded, getBmidBoxSettings } from "@/lib/server/bmid-box";
import { error, json } from "@/lib/server/response";
import { bmidBoxRequests as seededBoxRequests } from "@/lib/data/bmid-box";

type UserDoc = {
  id?: string;
  name?: string;
  displayName?: string;
  email?: string;
  bmidNumber?: string | null;
  verified?: boolean;
};

function userName(user: UserDoc, fallback = "Unknown user") {
  return user.name || user.displayName || user.email || fallback;
}

function isVerifiedUser(user: UserDoc | null | undefined) {
  if (!user) return false;
  return user.verified === true || typeof user.bmidNumber === "string";
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireFirebaseUser(req);
  if (!auth.ok) return error("unauthorized", 401, { reason: auth.reason });

  await ensureBmidBoxSeeded();

  const [ownedSnap, taggedSnap] = await Promise.all([
    db().collection("bmidBoxRequests").where("ownerUserId", "==", auth.uid).get(),
    db().collection("bmidBoxRequests").where("taggedUserId", "==", auth.uid).get(),
  ]);

  const map = new Map<string, Record<string, unknown>>();
  for (const doc of [...ownedSnap.docs, ...taggedSnap.docs]) {
    map.set(doc.id, { id: doc.id, ...(doc.data() as Record<string, unknown>) });
  }
  const items = Array.from(map.values()).sort((a, b) =>
    String(b.submittedAt || b.createdAt || "").localeCompare(
      String(a.submittedAt || a.createdAt || "")
    )
  );

  return json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireFirebaseUser(req);
  if (!auth.ok) return error("unauthorized", 401, { reason: auth.reason });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const type = body.type === "duality" ? "duality" : "own";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const sourcePlatform =
    typeof body.sourcePlatform === "string" ? body.sourcePlatform : "instagram";

  if (!sourceUrl) return error("missing_fields", 400, { detail: "sourceUrl required" });

  await ensureBmidBoxSeeded();

  const settings = await getBmidBoxSettings();
  if (
    !settings.allowedPlatforms.includes(
      sourcePlatform as (typeof settings.allowedPlatforms)[number]
    )
  ) {
    return error("platform_not_allowed", 400, {
      detail: `sourcePlatform must be one of: ${settings.allowedPlatforms.join(", ")}`,
    });
  }

  const owner = await getDoc<UserDoc>("users", auth.uid);
  if (!owner) return error("owner_not_found", 404);
  if (!isVerifiedUser(owner)) {
    return error("owner_not_verified", 403, {
      detail: "Owner must be a verified user with a BMID number",
    });
  }

  const taggedUserId =
    type === "own"
      ? auth.uid
      : typeof body.taggedUserId === "string" && body.taggedUserId
        ? body.taggedUserId
        : null;

  if (type === "duality" && !taggedUserId) return error("missing_tagged_user", 400);
  if (type === "duality" && taggedUserId === auth.uid) {
    return error("tagged_user_same_as_owner", 400);
  }

  const tagged =
    type === "own"
      ? owner
      : taggedUserId
        ? await getDoc<UserDoc>("users", taggedUserId)
        : null;
  if (type === "duality") {
    if (!tagged) return error("tagged_user_not_found", 404);
    if (!isVerifiedUser(tagged)) {
      return error("tagged_user_not_verified", 403, {
        detail: "Tagged user must be a verified user with a BMID number",
      });
    }
  }

  const numericId = 2401 + seededBoxRequests.length + Math.floor(Math.random() * 100000);
  const id = `box-${numericId}`;
  const now = new Date().toISOString();
  const taggedIdentity = (type === "own" ? owner : tagged)!;

  await createDoc(
    "bmidBoxRequests",
    {
      ownerUserId: auth.uid,
      taggedUserId,
      ownerSnapshot: {
        userId: auth.uid,
        name: userName(owner),
        bmidNumber: owner.bmidNumber ?? null,
        verified: Boolean(owner.verified),
      },
      taggedSnapshot: {
        userId: type === "own" ? auth.uid : taggedUserId,
        name: userName(taggedIdentity),
        bmidNumber: taggedIdentity.bmidNumber ?? null,
        verified: Boolean(taggedIdentity.verified),
      },
      type,
      sourcePlatform,
      sourceUrl,
      previewData:
        (body.previewData as Record<string, unknown>) || {
          title: "New BMID Box request",
          caption: "",
          description: "",
          thumbnailUrl: "",
          embedEnabled: true,
          contentType: "post",
        },
      currentStatus: type === "duality" ? "pending_tagged_user" : "pending_admin_review",
      votingStatus: null,
      acceptCount: 0,
      ignoreCount: 0,
      refuseCount: 0,
      adminNotes: [],
      rejectionReason: null,
      removalReason: null,
      submittedAt: now,
      reviewedAt: null,
      votingStartAt: null,
      votingEndAt: null,
      finalizedAt: null,
      taggedUserAction: type === "own" ? "accepted" : "pending",
      taggedUserActionAt: type === "own" ? now : null,
      taggedUserActionNote: type === "own" ? "Own request auto-confirmed" : null,
      ownerVerified: Boolean(owner.verified),
      taggedUserVerified: Boolean(taggedIdentity.verified),
      verificationChecks: {
        ownerVerified: Boolean(owner.verified),
        platformAllowed: true,
        urlReachable: true,
        duplicateUrl: false,
        supportedContentType: true,
      },
      notificationEvents: [],
      history: [
        {
          id: `${id}-h1`,
          requestId: id,
          actionType: "submitted",
          actorId: auth.uid,
          actorName: userName(owner),
          note: "Request submitted",
          createdAt: now,
        },
      ],
    },
    id
  );

  if (type === "duality" && tagged && taggedUserId) {
    await buildDualityRequestFromBox(id, {
      ownerId: auth.uid,
      ownerName: userName(owner),
      taggedUserId,
      taggedUserName: userName(tagged),
      taggedUserAction: "pending",
    });
  }

  return json({ id }, 201);
}
