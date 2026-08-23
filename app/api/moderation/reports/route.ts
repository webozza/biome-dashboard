import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { db } from "@/lib/server/firebase";
import { pickFirstImage, pickFirstVideo, pickVideoThumbnail } from "@/lib/server/share/media-pickers";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

type ReportDoc = {
  id: string;
  reporterId?: string;
  reporterEmail?: string | null;
  contentType?: "post" | "reel" | string;
  contentId?: string;
  contentPath?: string;
  authorId?: string;
  reason?: string;
  priority?: "standard" | "critical" | string;
  requiresImmediateReview?: boolean;
  additionalInfo?: string | null;
  status?: "pending" | "reviewed" | "dismissed" | "actioned";
  createdAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  adminNotes?: string | null;
  reportedContent?: ReportedContentPreview | null;
};

type ReportedContentPreview = {
  exists: boolean;
  id: string;
  path: string;
  type: string;
  title: string;
  description: string;
  imageUrl: string | null;
  videoUrl: string | null;
  authorId: string | null;
  createdAt: string | null;
};

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  if (typeof value === "number") return new Date(value).toISOString();
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function userDisplayName(raw: Record<string, unknown>, fallback: string) {
  return (
    text(raw.displayName) ||
    text(raw.name) ||
    text(raw.fullName) ||
    text(raw.username) ||
    text(raw.email) ||
    fallback
  );
}

function isValidDocPath(path: string) {
  const segments = path.split("/").filter(Boolean);
  return segments.length >= 2 && segments.length % 2 === 0;
}

function isRootUserPath(path: string) {
  const segments = path.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "users";
}

async function buildReportedContentPreview(
  firestore: FirebaseFirestore.Firestore,
  report: Pick<ReportDoc, "contentPath" | "contentId" | "contentType" | "authorId">
): Promise<ReportedContentPreview | null> {
  const path = report.contentPath || "";
  if (!path || !isValidDocPath(path)) return null;

  const snap = await firestore.doc(path).get();
  if (!snap.exists) {
    return {
      exists: false,
      id: report.contentId || snap.id,
      path,
      type: report.contentType || "content",
      title: "Content unavailable",
      description: "The reported content was not found. It may already have been deleted.",
      imageUrl: null,
      videoUrl: null,
      authorId: report.authorId || null,
      createdAt: null,
    };
  }

  const raw = snap.data() as Record<string, unknown>;
  if (report.contentType === "user" || isRootUserPath(snap.ref.path)) {
    const title = userDisplayName(raw, `User ${snap.id}`);
    const detailParts = [
      text(raw.username) ? `@${text(raw.username)}` : "",
      text(raw.email),
      text(raw.bmidNumber),
    ].filter(Boolean);
    return {
      exists: true,
      id: report.contentId || snap.id,
      path,
      type: "user",
      title,
      description: detailParts.join(" · ") || "Reported profile",
      imageUrl: text(raw.photoURL) || text(raw.photoUrl) || text(raw.avatarUrl) || null,
      videoUrl: null,
      authorId: snap.id,
      createdAt: toIso(raw.createdAt) || toIso(raw.updatedAt),
    };
  }
  const title =
    text(raw.title) ||
    text(raw.headline) ||
    text(raw.name) ||
    text(raw.postTitle) ||
    text(raw.caption) ||
    `${report.contentType || "Content"} ${snap.id}`;
  const description =
    text(raw.caption) ||
    text(raw.description) ||
    text(raw.text) ||
    text(raw.body) ||
    text(raw.postPreview) ||
    text(raw.contentPreview);

  return {
    exists: true,
    id: report.contentId || snap.id,
    path,
    type: report.contentType || text(raw.type) || "content",
    title,
    description,
    imageUrl: pickFirstImage(raw) || pickVideoThumbnail(raw) || text(raw.postImageUrl) || null,
    videoUrl: pickFirstVideo(raw) || null,
    authorId: report.authorId || text(raw.authorId) || text(raw.userId) || snap.ref.parent.parent?.id || null,
    createdAt: toIso(raw.createdAt) || toIso(raw.updatedAt),
  };
}

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "all";
  const reason = url.searchParams.get("reason") || "";
  const limitParam = Number(url.searchParams.get("limit") || "200");
  const limit = Math.max(1, Math.min(500, Number.isFinite(limitParam) ? limitParam : 200));

  try {
    const firestore = db();
    const snap = await firestore.collection("reports").limit(limit).get();

    let items: ReportDoc[] = snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        reporterId: typeof raw.reporterId === "string" ? raw.reporterId : "",
        reporterEmail: typeof raw.reporterEmail === "string" ? raw.reporterEmail : null,
        contentType: typeof raw.contentType === "string" ? raw.contentType : "",
        contentId: typeof raw.contentId === "string" ? raw.contentId : "",
        contentPath: typeof raw.contentPath === "string" ? raw.contentPath : "",
        authorId: typeof raw.authorId === "string" ? raw.authorId : "",
        reason: typeof raw.reason === "string" ? raw.reason : "",
        priority: raw.priority === "critical" ? "critical" : "standard",
        requiresImmediateReview: raw.requiresImmediateReview === true,
        additionalInfo: typeof raw.additionalInfo === "string" ? raw.additionalInfo : null,
        status: (typeof raw.status === "string" ? raw.status : "pending") as ReportDoc["status"],
        createdAt: toIso(raw.createdAt),
        reviewedAt: toIso(raw.reviewedAt),
        reviewedBy: typeof raw.reviewedBy === "string" ? raw.reviewedBy : null,
        adminNotes: typeof raw.adminNotes === "string" ? raw.adminNotes : null,
      };
    });

    items = await Promise.all(
      items.map(async (item) => ({
        ...item,
        reportedContent: await buildReportedContentPreview(firestore, item).catch(() => null),
      }))
    );

    const counts = { pending: 0, reviewed: 0, dismissed: 0, actioned: 0, critical: 0 };
    for (const r of items) {
      const s = r.status || "pending";
      if (s === "pending") counts.pending += 1;
      else if (s === "reviewed") counts.reviewed += 1;
      else if (s === "dismissed") counts.dismissed += 1;
      else if (s === "actioned") counts.actioned += 1;
      if (r.priority === "critical" || r.requiresImmediateReview) counts.critical += 1;
    }

    if (status === "pending") {
      items = items.filter((r) => r.status === "pending");
    } else if (status === "reviewed") {
      items = items.filter(
        (r) => r.status === "reviewed" || r.status === "dismissed" || r.status === "actioned"
      );
    }
    if (reason) items = items.filter((r) => r.reason === reason);

    items.sort((a, b) => {
      const aCritical = a.priority === "critical" || a.requiresImmediateReview === true;
      const bCritical = b.priority === "critical" || b.requiresImmediateReview === true;
      if (aCritical !== bCritical) return aCritical ? -1 : 1;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    return json({ items, total: items.length, counts });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
