import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";
import { listCollection } from "@/lib/server/firestore";
import { getBmidBoxAuditRows } from "@/lib/server/bmid-box";

export const dynamic = "force-dynamic";

export type AuditRow = {
  id: string;
  requestId: string;
  requestType: "own" | "duality" | "verification";
  source: "content" | "box" | "duality" | "verification" | "report";
  ownerUser: string;
  taggedUser: string | null;
  status: string;
  actorName: string;
  note: string;
  voteAccept: number;
  voteIgnore: number;
  voteRefuse: number;
  rejectionReason: string | null;
  createdAt: string;
};

type ContentRequestDoc = {
  id: string;
  userId?: string;
  userName?: string;
  postTitle?: string;
  status?: string;
  type?: string;
  reviewedBy?: string | null;
  adminNotes?: Array<{ note: string; by: string; at: string }>;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type DualityRequestDoc = {
  id: string;
  ownerName?: string;
  taggedUserName?: string;
  status?: string;
  source?: string;
  reviewedBy?: string | null;
  adminNote?: string | null;
  decisionHistory?: Array<{ at?: string; by?: string; decision?: string; action?: string; note?: string }>;
  timeline?: Array<{ at?: string; by?: string; decision?: string; action?: string; note?: string }>;
  createdAt?: string;
  updatedAt?: string;
};

type VerificationRequestDoc = {
  id: string;
  userId?: string;
  userName?: string;
  email?: string;
  status?: string;
  reviewedBy?: string | null;
  adminNote?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type VotingItemDoc = {
  id: string;
  acceptCount?: number;
  ignoreCount?: number;
  refuseCount?: number;
};

type ReportDoc = {
  id: string;
  contentType?: string;
  contentPath?: string;
  authorId?: string;
  reporterEmail?: string;
  reporterId?: string;
  reason?: string;
  status?: string;
  reviewedBy?: string | null;
  adminNotes?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
};

async function safeList<T>(path: string): Promise<(T & { id: string })[]> {
  try {
    const r = await listCollection<T>(path, { limit: 1000, orderBy: "createdAt", direction: "desc" });
    return r.items;
  } catch {
    return [];
  }
}

function toIso(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  return "";
}

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") || "";
  const sourceFilter = url.searchParams.get("source") || "";
  const typeFilter = url.searchParams.get("requestType") || "";

  try {
    const [contents, dualities, verifications, voting, reports, boxRows] = await Promise.all([
      safeList<ContentRequestDoc>("contentRequests"),
      safeList<DualityRequestDoc>("dualityRequests"),
      safeList<VerificationRequestDoc>("verificationRequests"),
      safeList<VotingItemDoc>("votingItems"),
      safeList<ReportDoc>("reports"),
      getBmidBoxAuditRows().catch(() => []),
    ]);

    const votesById = new Map<string, VotingItemDoc>();
    for (const v of voting) votesById.set(v.id, v);

    const rows: AuditRow[] = [];

    // BMID Box audit history — skip rows attached to removed requests
    for (const b of boxRows) {
      if (b.requestStatus === "removed") continue;
      rows.push({
        id: b.id,
        requestId: b.requestId,
        requestType: (b.requestType === "duality" ? "duality" : "own") as AuditRow["requestType"],
        source: "box",
        ownerUser: b.ownerName || "—",
        taggedUser: b.taggedName || null,
        status: b.requestStatus || "—",
        actorName: b.actorName || "System",
        note: b.note || b.actionType || "",
        voteAccept: 0,
        voteIgnore: 0,
        voteRefuse: 0,
        rejectionReason: b.rejectionReason || b.removalReason || null,
        createdAt: toIso(b.createdAt) || new Date().toISOString(),
      });
    }

    // BMID Content: final-state rows (approved / rejected only — skip cancelled/soft-deleted)
    for (const c of contents) {
      if (c.status !== "approved" && c.status !== "rejected") continue;
      const vote = votesById.get(c.id);
      const lastNote = c.adminNotes && c.adminNotes.length > 0 ? c.adminNotes[c.adminNotes.length - 1] : null;
      rows.push({
        id: `content-${c.id}`,
        requestId: c.id,
        requestType: (c.type === "duality" ? "duality" : "own") as AuditRow["requestType"],
        source: "content",
        ownerUser: c.userName || "—",
        taggedUser: null,
        status: c.status || "—",
        actorName: c.reviewedBy || lastNote?.by || "Admin",
        note: lastNote?.note || c.postTitle || "",
        voteAccept: vote?.acceptCount || 0,
        voteIgnore: vote?.ignoreCount || 0,
        voteRefuse: vote?.refuseCount || 0,
        rejectionReason: c.rejectionReason || null,
        createdAt: toIso(c.updatedAt) || toIso(c.createdAt) || new Date().toISOString(),
      });
    }

    // Duality decision history
    for (const d of dualities) {
      const history = (d.decisionHistory || []).concat(d.timeline || []);
      for (let i = 0; i < history.length; i++) {
        const entry = history[i];
        const decision = entry.decision || entry.action || "";
        if (!decision) continue;
        rows.push({
          id: `duality-${d.id}-${i}`,
          requestId: d.id,
          requestType: "duality",
          source: "duality",
          ownerUser: d.ownerName || "—",
          taggedUser: d.taggedUserName || null,
          status: decision,
          actorName: entry.by || d.reviewedBy || "Admin",
          note: entry.note || d.adminNote || "",
          voteAccept: 0,
          voteIgnore: 0,
          voteRefuse: 0,
          rejectionReason: null,
          createdAt: toIso(entry.at) || toIso(d.updatedAt) || toIso(d.createdAt) || new Date().toISOString(),
        });
      }
      if (!history.length && (d.status === "approved" || d.status === "rejected")) {
        rows.push({
          id: `duality-${d.id}-final`,
          requestId: d.id,
          requestType: "duality",
          source: "duality",
          ownerUser: d.ownerName || "—",
          taggedUser: d.taggedUserName || null,
          status: d.status || "—",
          actorName: d.reviewedBy || "Admin",
          note: d.adminNote || "",
          voteAccept: 0,
          voteIgnore: 0,
          voteRefuse: 0,
          rejectionReason: null,
          createdAt: toIso(d.updatedAt) || toIso(d.createdAt) || new Date().toISOString(),
        });
      }
    }

    // Verification approvals / rejections — skip removed
    for (const v of verifications) {
      if (v.status !== "approved" && v.status !== "rejected") continue;
      rows.push({
        id: `verification-${v.id}`,
        requestId: v.id,
        requestType: "verification",
        source: "verification",
        ownerUser: v.userName || v.email || "—",
        taggedUser: null,
        status: v.status || "—",
        actorName: v.reviewedBy || "Admin",
        note: v.adminNote || "",
        voteAccept: 0,
        voteIgnore: 0,
        voteRefuse: 0,
        rejectionReason: v.rejectionReason || null,
        createdAt: toIso(v.updatedAt) || toIso(v.createdAt) || new Date().toISOString(),
      });
    }

    // Moderation reports that were actioned/dismissed/reviewed
    for (const r of reports) {
      if (r.status !== "actioned" && r.status !== "dismissed" && r.status !== "reviewed") continue;
      rows.push({
        id: `report-${r.id}`,
        requestId: r.id,
        requestType: "own",
        source: "report",
        ownerUser: r.reporterEmail || r.reporterId || "—",
        taggedUser: r.authorId || null,
        status: r.status || "—",
        actorName: r.reviewedBy || "Admin",
        note: r.adminNotes || r.reason || "",
        voteAccept: 0,
        voteIgnore: 0,
        voteRefuse: 0,
        rejectionReason: null,
        createdAt: toIso(r.reviewedAt) || toIso(r.createdAt) || new Date().toISOString(),
      });
    }

    let filtered = rows;
    if (statusFilter) filtered = filtered.filter((r) => r.status === statusFilter);
    if (sourceFilter) filtered = filtered.filter((r) => r.source === sourceFilter);
    if (typeFilter) filtered = filtered.filter((r) => r.requestType === typeFilter);

    filtered.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return json({ items: filtered, total: filtered.length });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}
