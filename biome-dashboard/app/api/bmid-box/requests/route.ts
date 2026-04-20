import { NextRequest } from "next/server";
import { users } from "@/lib/data/mock-data";
import { guard } from "@/lib/server/guard";
import { createDoc } from "@/lib/server/firestore";
import { error, json } from "@/lib/server/response";
import { bmidBoxRequests } from "@/lib/data/bmid-box";
import {
  ensureBmidBoxSeeded,
  getBmidBoxSummary,
  listFilteredBmidBoxRequests,
} from "@/lib/server/bmid-box";

export const dynamic = "force-dynamic";

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
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : "";
  const sourcePlatform = typeof body.sourcePlatform === "string" ? body.sourcePlatform : "instagram";

  if (!ownerUserId || !sourceUrl) return error("missing_fields", 400);

  await ensureBmidBoxSeeded();
  const numericId = 2401 + bmidBoxRequests.length + Math.floor(Math.random() * 1000);
  const id = `box-${numericId}`;
  const now = new Date().toISOString();
  const owner = users.find((user) => user.id === ownerUserId);
  const taggedUserId =
    type === "own"
      ? ownerUserId
      : typeof body.taggedUserId === "string"
        ? body.taggedUserId
        : null;
  const tagged = users.find((user) => user.id === taggedUserId);

  await createDoc(
    "bmidBoxRequests",
    {
      ownerUserId,
      taggedUserId,
      ownerSnapshot: {
        userId: ownerUserId,
        name: typeof body.ownerName === "string" ? body.ownerName : owner?.name || "Unknown owner",
        bmidNumber: typeof body.ownerBmidNumber === "string" ? body.ownerBmidNumber : owner?.bmidNumber || null,
        verified: Boolean(body.ownerVerified ?? owner?.verified ?? true),
      },
      taggedSnapshot: taggedUserId
        ? {
            userId: taggedUserId,
            name:
              typeof body.taggedName === "string"
                ? body.taggedName
                : tagged?.name || (type === "own" ? typeof body.ownerName === "string" ? body.ownerName : owner?.name || "Unknown owner" : "Unknown tagged user"),
            bmidNumber:
              typeof body.taggedBmidNumber === "string"
                ? body.taggedBmidNumber
                : tagged?.bmidNumber || (type === "own" ? owner?.bmidNumber || null : null),
            verified: Boolean(body.taggedUserVerified ?? tagged?.verified ?? (type === "own")),
          }
        : null,
      type,
      sourcePlatform,
      sourceUrl,
      previewData: body.previewData || {
        title: "New BMID Box request",
        caption: "",
        description: "",
        thumbnailUrl: "",
        embedEnabled: true,
        contentType: "post",
      },
      currentStatus: "submitted",
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
      ownerVerified: Boolean(body.ownerVerified ?? true),
      taggedUserVerified: type === "own" ? true : Boolean(body.taggedUserVerified ?? true),
      verificationChecks: body.verificationChecks || {
        ownerVerified: true,
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
          actorName: String(body.actorName || "Admin"),
          note: "Request submitted",
          createdAt: now,
        },
      ],
    },
    id
  );

  return json({ id }, 201);
}
