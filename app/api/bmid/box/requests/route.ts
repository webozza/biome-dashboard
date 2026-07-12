import { NextRequest } from "next/server";
import { requireFirebaseUser } from "@/lib/server/auth";
import { db } from "@/lib/server/firebase";
import { createDoc, getDoc, listDocIds } from "@/lib/server/firestore";
import { buildDualityRequestFromBox } from "@/lib/server/bmid";
import type { TaggedUserState } from "@/lib/server/bmid";
import { ensureBmidBoxSeeded, getBmidBoxSettings } from "@/lib/server/bmid-box";
import { error, json } from "@/lib/server/response";
import { notifyAdminRequestCreated } from "@/lib/server/admin-request-email";
import type {
  BmidBoxContentType,
  BmidBoxFacebookOwnershipCheck,
  BmidBoxPlatform,
} from "@/lib/data/bmid-box";

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

function parseTaggedUserIds(body: Record<string, unknown>) {
  const raw =
    Array.isArray(body.taggedUserIds)
      ? body.taggedUserIds
      : Array.isArray(body.taggedUsers)
        ? body.taggedUsers.map((tagged) =>
            typeof tagged === "string"
              ? tagged
              : tagged && typeof tagged === "object" && "id" in tagged
                ? (tagged as { id?: unknown }).id
                : tagged && typeof tagged === "object" && "userId" in tagged
                  ? (tagged as { userId?: unknown }).userId
                  : null
          )
        : typeof body.taggedUserId === "string" && body.taggedUserId
          ? [body.taggedUserId]
          : [];

  return [...new Set(raw.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).map((id) => id.trim()))];
}

function clean(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return "";
  return trimmed;
}

function sanitizePreviewData(value: unknown) {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const contentType = clean(input.contentType);
  const allowedContentTypes: BmidBoxContentType[] = ["video", "photo", "image", "post", "link"];
  return {
    title: clean(input.title),
    caption: clean(input.caption),
    description: clean(input.description),
    thumbnailUrl: clean(input.thumbnailUrl),
    embedEnabled: input.embedEnabled !== false,
    contentType: allowedContentTypes.includes(contentType as BmidBoxContentType)
      ? (contentType as BmidBoxContentType)
      : "post",
  };
}

function sanitizeSocialPreview(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const allowedPlatforms: BmidBoxPlatform[] = ["instagram", "tiktok", "youtube", "facebook", "x", "generic"];
  const platform = clean(input.platform);
  return {
    platform: allowedPlatforms.includes(platform as BmidBoxPlatform) ? platform : clean(input.platform),
    type: clean(input.type),
    authorName: clean(input.authorName),
    canonicalUrl: clean(input.canonicalUrl),
    embedUrl: clean(input.embedUrl),
    externalUrl: clean(input.externalUrl),
    status: clean(input.status),
  };
}

function sanitizeFacebookOwnershipCheck(value: unknown): BmidBoxFacebookOwnershipCheck | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const status = clean(input.status);
  if (!["verified", "failed", "needs_connection"].includes(status)) return null;

  return {
    provider: "facebook",
    method: clean(input.method) || "profile_url_match",
    status: status as BmidBoxFacebookOwnershipCheck["status"],
    sourceUrl: clean(input.sourceUrl),
    checkedAt: clean(input.checkedAt) || new Date().toISOString(),
    matchedOwnerId: clean(input.matchedOwnerId) || null,
    matchedOwnerName: clean(input.matchedOwnerName) || null,
    connectedProfileUrl: clean(input.connectedProfileUrl) || null,
    reason: clean(input.reason) || null,
    message: clean(input.message) || null,
  };
}

function sanitizeYoutubeOwnershipCheck(value: unknown) {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  if (input.provider !== "youtube") return null;
  return {
    provider: "youtube",
    method: typeof input.method === "string" ? input.method : "video_channel_id_match",
    status: ["verified", "failed", "needs_connection"].includes(String(input.status))
      ? String(input.status)
      : "failed",
    sourceUrl: typeof input.sourceUrl === "string" ? input.sourceUrl : "",
    checkedAt: typeof input.checkedAt === "string" ? input.checkedAt : new Date().toISOString(),
    matchedOwnerId: typeof input.matchedOwnerId === "string" ? input.matchedOwnerId : null,
    matchedOwnerName: typeof input.matchedOwnerName === "string" ? input.matchedOwnerName : null,
    connectedProfileUrl: typeof input.connectedProfileUrl === "string" ? input.connectedProfileUrl : null,
    reason: typeof input.reason === "string" ? input.reason : null,
    message: typeof input.message === "string" ? input.message : null,
  };
}

function sanitizeVerificationChecks(
  value: unknown,
  defaults: {
    ownerVerified: boolean;
    platformAllowed: boolean;
    urlReachable: boolean;
    duplicateUrl: boolean;
    supportedContentType: boolean;
  }
) {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    ...defaults,
    facebookOwnership: sanitizeFacebookOwnershipCheck(input.facebookOwnership),
    youtubeOwnership: sanitizeYoutubeOwnershipCheck(input.youtubeOwnership),
    manualReviewRequired: Boolean(input.manualReviewRequired),
  };
}

export const dynamic = "force-dynamic";

function requestIncludesUser(item: Record<string, unknown>, uid: string) {
  const taggedUsers = Array.isArray(item.taggedUsers) ? item.taggedUsers : [];
  return taggedUsers.some((tagged) => {
    const row = tagged as { userId?: unknown };
    return row.userId === uid;
  });
}

async function nextBoxRequestId() {
  const ids = await listDocIds("bmidBoxRequests");
  const numericIds = ids
    .map((id) => /^box-(\d+)$/.exec(id)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
  const next = Math.max(2400, ...numericIds) + 1;
  return `box-${next}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireFirebaseUser(req);
  if (!auth.ok) return error("unauthorized", 401, { reason: auth.reason });

  await ensureBmidBoxSeeded();

  const snap = await db().collection("bmidBoxRequests").get();
  const items = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as Record<string, unknown> & { id: string }))
    .filter((item) => item.ownerUserId === auth.uid || item.taggedUserId === auth.uid || requestIncludesUser(item, auth.uid))
    .sort((a, b) =>
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

  const requestedTaggedUserIds = type === "own" ? [auth.uid] : parseTaggedUserIds(body);
  const taggedUserIds = requestedTaggedUserIds.filter((id) => id !== auth.uid);

  if (type === "duality" && taggedUserIds.length === 0) return error("missing_tagged_user", 400);
  if (type === "duality" && taggedUserIds.length !== requestedTaggedUserIds.length) {
    return error("tagged_user_same_as_owner", 400);
  }

  const taggedUsers: TaggedUserState[] = [];
  const taggedSnapshots = [];
  const taggedSourceIds = type === "own" ? [auth.uid] : taggedUserIds;
  for (const taggedUserId of taggedSourceIds) {
    const tagged = type === "own" ? owner : await getDoc<UserDoc>("users", taggedUserId);
    if (!tagged) return error("tagged_user_not_found", 404, { taggedUserId });
    if (type === "duality" && !isVerifiedUser(tagged)) {
      return error("tagged_user_not_verified", 403, {
        detail: "Tagged user must be a verified user with a BMID number",
      });
    }
    taggedUsers.push({
      userId: taggedUserId,
      name: userName(tagged),
      action: type === "own" ? "accepted" : "pending",
    });
    taggedSnapshots.push({
      userId: taggedUserId,
      name: userName(tagged),
      bmidNumber: tagged.bmidNumber ?? null,
      verified: Boolean(tagged.verified),
    });
  }

  const id = await nextBoxRequestId();
  const now = new Date().toISOString();
  const primaryTagged = taggedUsers[0];
  const verificationChecks = sanitizeVerificationChecks(body.verificationChecks, {
    ownerVerified: Boolean(owner.verified),
    platformAllowed: true,
    urlReachable: true,
    duplicateUrl: false,
    supportedContentType: true,
  });

  await createDoc(
    "bmidBoxRequests",
    {
      ownerUserId: auth.uid,
      taggedUserId: primaryTagged.userId,
      ownerSnapshot: {
        userId: auth.uid,
        name: userName(owner),
        bmidNumber: owner.bmidNumber ?? null,
        verified: Boolean(owner.verified),
      },
      taggedSnapshot: taggedSnapshots[0] ?? null,
      taggedSnapshots,
      type,
      sourcePlatform,
      sourceUrl,
      previewData: sanitizePreviewData(body.previewData),
      socialPreview: sanitizeSocialPreview(body.socialPreview),
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
      taggedUsers,
      taggedUserActionAt: type === "own" ? now : null,
      taggedUserActionNote: type === "own" ? "Own request auto-confirmed" : null,
      ownerVerified: Boolean(owner.verified),
      taggedUserVerified: Boolean(taggedSnapshots[0]?.verified),
      verificationChecks,
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

  if (type === "duality") {
    await buildDualityRequestFromBox(id, {
      ownerId: auth.uid,
      ownerName: userName(owner),
      taggedUserId: primaryTagged.userId,
      taggedUserName: primaryTagged.name,
      taggedUserAction: "pending",
      taggedUsers,
    });
  }

  await notifyAdminRequestCreated({
    requestId: id,
    type: "BMID Box",
    userName: userName(owner),
    userEmail: owner.email || "",
    details: `Source Platform: ${sourcePlatform || "N/A"}\nStatus: ${type === "duality" ? "pending_tagged_user" : "pending_admin_review"}\nSource URL: ${sourceUrl}`,
    dashboardPath: `/dashboard/bmid-box/requests/${id}`,
    docPath: `bmidBoxRequests/${id}`,
  });

  return json({ id }, 201);
}
