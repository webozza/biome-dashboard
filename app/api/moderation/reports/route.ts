import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { db } from "@/lib/server/firebase";
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
  additionalInfo?: string | null;
  status?: "pending" | "reviewed" | "dismissed" | "actioned";
  createdAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  adminNotes?: string | null;
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
        additionalInfo: typeof raw.additionalInfo === "string" ? raw.additionalInfo : null,
        status: (typeof raw.status === "string" ? raw.status : "pending") as ReportDoc["status"],
        createdAt: toIso(raw.createdAt),
        reviewedAt: toIso(raw.reviewedAt),
        reviewedBy: typeof raw.reviewedBy === "string" ? raw.reviewedBy : null,
        adminNotes: typeof raw.adminNotes === "string" ? raw.adminNotes : null,
      };
    });

    const counts = { pending: 0, reviewed: 0, dismissed: 0, actioned: 0 };
    for (const r of items) {
      const s = r.status || "pending";
      if (s === "pending") counts.pending += 1;
      else if (s === "reviewed") counts.reviewed += 1;
      else if (s === "dismissed") counts.dismissed += 1;
      else if (s === "actioned") counts.actioned += 1;
    }

    if (status === "pending") {
      items = items.filter((r) => r.status === "pending");
    } else if (status === "reviewed") {
      items = items.filter(
        (r) => r.status === "reviewed" || r.status === "dismissed" || r.status === "actioned"
      );
    }
    if (reason) items = items.filter((r) => r.reason === reason);

    items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return json({ items, total: items.length, counts });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
