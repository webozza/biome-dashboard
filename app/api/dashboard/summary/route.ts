import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";
import { countCollection, listCollection } from "@/lib/server/firestore";

export const dynamic = "force-dynamic";

type BucketKey = "verification" | "content" | "box" | "duality";

type VerificationDoc = { createdAt?: string; status?: string };
type ContentDoc = { createdAt?: string; status?: string; userName?: string; postTitle?: string };
type BoxDoc = {
  createdAt?: string;
  currentStatus?: string;
  votingStatus?: string | null;
  ownerSnapshot?: { name?: string } | null;
  taggedSnapshot?: { name?: string } | null;
  previewData?: { title?: string } | null;
};
type DualityDoc = {
  createdAt?: string;
  status?: string;
  taggedUserAction?: string;
  ownerName?: string;
  taggedUserName?: string;
};
type AuditDoc = {
  createdAt?: string;
  requestType?: string;
  source?: string;
  status?: string;
  ownerUser?: string;
  taggedUser?: string | null;
  adminNote?: string | null;
  rejectionReason?: string | null;
};
type FlagDoc = {
  createdAt?: string;
  flaggedAt?: string;
  type?: string;
  description?: string;
  severity?: string;
  status?: string;
};
type VotingDoc = { status?: string };

function monthLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "short" });
}

function lastSixMonths(): { key: string; date: Date }[] {
  const out: { key: string; date: Date }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, date: d });
  }
  return out;
}

function bucketKeyFor(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${d.getMonth()}`;
}

async function safeList<T>(path: string): Promise<(T & { id: string })[]> {
  try {
    const r = await listCollection<T>(path, {
      limit: 1000,
      orderBy: "createdAt",
      direction: "desc",
    });
    return r.items;
  } catch {
    return [];
  }
}

function describeAudit(a: AuditDoc): string {
  const who = a.ownerUser || "User";
  const surface = a.source === "box" ? "Box request" : a.source === "content" ? "Content request" : "Request";
  const tag = a.taggedUser ? ` with ${a.taggedUser}` : "";
  if (a.status === "approved") return `${surface} approved for ${who}${tag}`;
  if (a.status === "rejected") {
    return `${surface} rejected for ${who}${tag}${a.rejectionReason ? ` — ${a.rejectionReason}` : ""}`;
  }
  if (a.status === "pending") return `${who} submitted ${surface.toLowerCase()}${tag}`;
  return `${who} — ${surface}${tag}`;
}

function auditType(a: AuditDoc): string {
  if (a.status === "approved") return "approval";
  if (a.status === "rejected") return "refusal";
  if (a.taggedUser) return "duality";
  if (a.requestType === "verification") return "verification";
  return "approval";
}

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  try {
    const [
      totalUsers,
      verifiedUsers,
      verifications,
      contents,
      boxes,
      dualities,
      audits,
      flags,
      voting,
    ] = await Promise.all([
      countCollection("users"),
      countCollection("users", [{ field: "verified", op: "==", value: true }]),
      safeList<VerificationDoc>("verificationRequests"),
      safeList<ContentDoc>("contentRequests"),
      safeList<BoxDoc>("bmidBoxRequests"),
      safeList<DualityDoc>("dualityRequests"),
      safeList<AuditDoc>("auditLogs"),
      safeList<FlagDoc>("flaggedItems"),
      safeList<VotingDoc>("votingItems"),
    ]);

    const pendingVerification = verifications.filter((v) => v.status === "pending").length;
    const pendingContent = contents.filter((c) => c.status === "pending").length;
    const pendingBox = boxes.filter((b) =>
      ["submitted", "pending_admin_review", "pending_tagged_user", "pending_voting"].includes(
        b.currentStatus || ""
      )
    ).length;
    const pendingDuality = dualities.filter((d) => d.status === "pending" || d.status === "waiting_tagged").length;

    const approvedTotal =
      contents.filter((c) => c.status === "approved").length +
      dualities.filter((d) => d.status === "approved").length +
      boxes.filter((b) => b.currentStatus === "approved").length +
      verifications.filter((v) => v.status === "approved").length;
    const refusedTotal =
      contents.filter((c) => c.status === "rejected").length +
      dualities.filter((d) => d.status === "rejected").length +
      boxes.filter((b) => b.currentStatus === "refused").length +
      verifications.filter((v) => v.status === "rejected").length;

    const months = lastSixMonths();
    const volumeByKey = new Map<
      string,
      { date: string; verification: number; content: number; box: number; duality: number }
    >(
      months.map((m) => [
        m.key,
        { date: monthLabel(m.date), verification: 0, content: 0, box: 0, duality: 0 },
      ])
    );

    const bump = (items: { createdAt?: string }[], key: BucketKey) => {
      for (const item of items) {
        const k = bucketKeyFor(item.createdAt);
        if (!k) continue;
        const b = volumeByKey.get(k);
        if (b) b[key] += 1;
      }
    };
    bump(verifications, "verification");
    bump(contents, "content");
    bump(boxes, "box");
    bump(dualities, "duality");

    let pendingCount = 0;
    let approvedCount = 0;
    let refusedCount = 0;
    let removedCount = 0;
    let cancelledCount = 0;

    for (const c of contents) {
      if (c.status === "pending" || c.status === "in_review") pendingCount += 1;
      else if (c.status === "approved") approvedCount += 1;
      else if (c.status === "rejected") refusedCount += 1;
      else if (c.status === "cancelled") cancelledCount += 1;
    }
    for (const d of dualities) {
      if (d.status === "pending" || d.status === "waiting_tagged") pendingCount += 1;
      else if (d.status === "approved") approvedCount += 1;
      else if (d.status === "rejected") refusedCount += 1;
      else if (d.status === "cancelled") cancelledCount += 1;
    }
    for (const b of boxes) {
      const s = b.currentStatus;
      if (
        s === "submitted" ||
        s === "pending_admin_review" ||
        s === "pending_tagged_user" ||
        s === "pending_voting"
      )
        pendingCount += 1;
      else if (s === "approved") approvedCount += 1;
      else if (s === "refused") refusedCount += 1;
      else if (s === "removed") removedCount += 1;
      else if (s === "cancelled") cancelledCount += 1;
    }

    const breakdown = [
      { name: "Pending", value: pendingCount, color: "#f59e0b" },
      { name: "Approved", value: approvedCount, color: "#10b981" },
      { name: "Refused", value: refusedCount, color: "#ef4444" },
      { name: "Removed", value: removedCount, color: "#6b7280" },
      { name: "Cancelled", value: cancelledCount, color: "#8b5cf6" },
    ];

    const activity = audits.slice(0, 6).map((a) => ({
      id: a.id,
      type: auditType(a),
      description: describeAudit(a),
      user: a.ownerUser || "System",
      timestamp: a.createdAt || new Date().toISOString(),
    }));

    const flaggedOpen = flags.filter((f) => f.status === "open");
    const flagged = flaggedOpen.slice(0, 20).map((f) => ({
      id: f.id,
      type: f.type || "system",
      description: f.description || "",
      severity: f.severity || "medium",
      status: f.status || "open",
      flaggedAt: f.flaggedAt || f.createdAt || "",
    }));

    const bmidBox = {
      total: boxes.length,
      pendingAdminReview: boxes.filter((b) => b.currentStatus === "pending_admin_review").length,
      pendingTaggedUser: boxes.filter((b) => b.currentStatus === "pending_tagged_user").length,
      pendingVoting: boxes.filter((b) => b.currentStatus === "pending_voting").length,
      approved: boxes.filter((b) => b.currentStatus === "approved").length,
      refused: boxes.filter((b) => b.currentStatus === "refused").length,
      removed: boxes.filter((b) => b.currentStatus === "removed").length,
    };

    const pendingActions = {
      verification: pendingVerification,
      contentOwn: pendingContent,
      dualityWaitingTagged: dualities.filter((d) => d.status === "waiting_tagged").length,
      votingOpen: voting.filter((v) => v.status === "open").length,
      flaggedOpen: flaggedOpen.length,
    };

    return json({
      kpi: {
        totalUsers,
        verifiedUsers,
        pendingVerification,
        pendingContent,
        pendingBox,
        pendingDuality,
        approvedTotal,
        refusedTotal,
      },
      bmidBox,
      volume: Array.from(volumeByKey.values()),
      breakdown,
      breakdownPendingTotal: pendingCount,
      activity,
      flagged,
      pendingActions,
    });
  } catch (e) {
    return error("summary_failed", 500, { detail: String((e as Error).message) });
  }
}
