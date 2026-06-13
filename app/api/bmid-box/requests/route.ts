import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { createDoc, getDoc, listDocIds } from "@/lib/server/firestore";
import { buildDualityRequestFromBox } from "@/lib/server/bmid";
import { error, json } from "@/lib/server/response";
import {
  ensureBmidBoxSeeded,
  getBmidBoxSettings,
  getBmidBoxSummary,
  listFilteredBmidBoxRequests,
} from "@/lib/server/bmid-box";
import { notifyAdminRequestCreated } from "@/lib/server/admin-request-email";
import type { BmidBoxContentType, BmidBoxPlatform } from "@/lib/data/bmid-box";

type UserDoc = {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  bmidNumber?: string | null;
  verified?: boolean;
};

function userName(user: UserDoc, fallback = "Unknown user") {
  return user.name || user.displayName || user.email || fallback;
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

export const dynamic = "force-dynamic";

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
  const g = guard(req);
  if (g) return g;

  const url = new URL(req.url);
  await ensureBmidBoxSeeded();
  const [items, summary] = await Promise.all([
    listFilteredBmidBoxRequests(url.searchParams),
    getBmidBoxSummary(),
  ]);
  return json({ items, summary });
}

export async function POST(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const ownerUserId = typeof body.ownerUserId === "string" ? body.ownerUserId : "";
  const type = body.type === "duality" ? "duality" : "own";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const sourcePlatform = typeof body.sourcePlatform === "string" ? body.sourcePlatform : "instagram";

  if (!ownerUserId || !sourceUrl) return error("missing_fields", 400);

  await ensureBmidBoxSeeded();

  const settings = await getBmidBoxSettings();
  if (!settings.allowedPlatforms.includes(sourcePlatform as (typeof settings.allowedPlatforms)[number])) {
    return error("platform_not_allowed", 400, {
      detail: `sourcePlatform must be one of: ${settings.allowedPlatforms.join(", ")}`,
    });
  }

  const owner = await getDoc<UserDoc>("users", ownerUserId);
  if (!owner) return error("owner_not_found", 404);
  if (!owner.verified || !owner.bmidNumber) {
    return error("owner_not_verified", 403, {
      detail: "Owner must be a verified user with a BMID number",
    });
  }

  const taggedUserId =
    type === "own"
      ? ownerUserId
      : typeof body.taggedUserId === "string"
        ? body.taggedUserId
        : null;

  if (type === "duality" && !taggedUserId) {
    return error("missing_tagged_user", 400);
  }

  const tagged = taggedUserId ? await getDoc<UserDoc>("users", taggedUserId) : null;
  if (type === "duality") {
    if (!tagged) return error("tagged_user_not_found", 404);
    if (!tagged.verified || !tagged.bmidNumber) {
      return error("tagged_user_not_verified", 403, {
        detail: "Tagged user must be a verified user with a BMID number",
      });
    }
    if (tagged.id === owner.id) {
      return error("tagged_user_same_as_owner", 400);
    }
  }

  const id = await nextBoxRequestId();
  const now = new Date().toISOString();

  const taggedIdentity = type === "own" ? owner : tagged!;

  await createDoc(
    "bmidBoxRequests",
    {
      ownerUserId,
      taggedUserId,
      ownerSnapshot: {
        userId: ownerUserId,
        name: userName(owner),
        email: owner.email,
        bmidNumber: owner.bmidNumber,
        verified: Boolean(owner.verified),
      },
      taggedSnapshot: {
        userId: taggedIdentity.id,
        name: userName(taggedIdentity),
        email: taggedIdentity.email,
        bmidNumber: taggedIdentity.bmidNumber ?? null,
        verified: Boolean(taggedIdentity.verified),
      },
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
          actorId: ownerUserId,
          actorName: String(body.actorName || userName(owner)),
          note: "Request submitted",
          createdAt: now,
        },
      ],
    },
    id
  );

  if (type === "duality" && tagged) {
    await buildDualityRequestFromBox(id, {
      ownerId: ownerUserId,
      ownerName: userName(owner),
      taggedUserId: tagged.id,
      taggedUserName: userName(tagged),
      taggedUserAction: "pending",
    });
  }

  const notifyResult = await notifyAdminRequestCreated({
    requestId: id,
    type: "BMID Box",
    userName: userName(owner),
    userEmail: owner.email || "",
    details: `Source Platform: ${sourcePlatform || "N/A"}\nStatus: ${type === "duality" ? "pending_tagged_user" : "pending_admin_review"}\nSource URL: ${sourceUrl}`,
    dashboardPath: `/dashboard/bmid-box/requests/${id}`,
    docPath: `bmidBoxRequests/${id}`,
  });
  console.log("[bmid-box][create] admin_email_result", { id, notifyResult });

  return json({ id }, 201);
}
