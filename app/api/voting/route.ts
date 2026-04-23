import { NextRequest } from "next/server";
import { buildCreate } from "@/lib/server/resource";
import { guard } from "@/lib/server/guard";
import { db } from "@/lib/server/firebase";
import { ensureBmidBoxSeeded } from "@/lib/server/bmid-box";
import { error, json, parsePagination } from "@/lib/server/response";

export const dynamic = "force-dynamic";

type VotingRow = {
  id: string;
  requestId: string;
  requestType: "content" | "box";
  title: string;
  accept: number;
  ignore: number;
  refuse: number;
  status: "open" | "closed" | "finalized";
  openedAt: string;
  closedAt: string | null;
  outcome: "accepted" | "refused" | "ignored" | null;
};

function boxRequestToVotingRow(doc: FirebaseFirestore.QueryDocumentSnapshot): VotingRow | null {
  const data = doc.data() as Record<string, unknown>;
  const votingStatus = data.votingStatus as VotingRow["status"] | null | undefined;
  if (!votingStatus) return null;
  if (data.currentStatus === "removed") return null;
  const preview = (data.previewData as { title?: string } | undefined) || {};
  const ownerName = (data.ownerSnapshot as { name?: string } | undefined)?.name || "Unknown";
  return {
    id: doc.id,
    requestId: doc.id,
    requestType: "box",
    title: preview.title ? `${preview.title} - ${ownerName}` : `Box ${doc.id} - ${ownerName}`,
    accept: Number(data.acceptCount || 0),
    ignore: Number(data.ignoreCount || 0),
    refuse: Number(data.refuseCount || 0),
    status: votingStatus,
    openedAt: String(data.votingStartAt || data.submittedAt || data.createdAt || ""),
    closedAt: (data.votingEndAt as string) || null,
    outcome: null,
  };
}

export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  const url = new URL(req.url);
  const { limit, cursor } = parsePagination(url);
  const statusFilter = url.searchParams.get("status");
  const requestTypeFilter = url.searchParams.get("requestType");
  const outcomeFilter = url.searchParams.get("outcome");

  try {
    await ensureBmidBoxSeeded();

    const [contentSnap, boxSnap] = await Promise.all([
      db().collection("votingItems").get(),
      db().collection("bmidBoxRequests").get(),
    ]);

    const contentRows: VotingRow[] = contentSnap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        requestId: String(data.requestId || doc.id),
        requestType: "content",
        title: String(data.title || ""),
        accept: Number(data.accept || 0),
        ignore: Number(data.ignore || 0),
        refuse: Number(data.refuse || 0),
        status: (data.status as VotingRow["status"]) || "open",
        openedAt: String(data.openedAt || ""),
        closedAt: (data.closedAt as string) || null,
        outcome: (data.outcome as VotingRow["outcome"]) || null,
      };
    });

    const boxRows: VotingRow[] = boxSnap.docs
      .map(boxRequestToVotingRow)
      .filter((row): row is VotingRow => row !== null);

    const all = [...contentRows, ...boxRows]
      .filter((row) => {
        if (statusFilter && row.status !== statusFilter) return false;
        if (requestTypeFilter && row.requestType !== requestTypeFilter) return false;
        if (outcomeFilter && String(row.outcome ?? "") !== outcomeFilter) return false;
        return true;
      })
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt));

    let startIndex = 0;
    if (cursor) {
      const idx = all.findIndex((row) => row.id === cursor);
      if (idx >= 0) startIndex = idx + 1;
    }
    const page = all.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < all.length ? page[page.length - 1]?.id ?? null : null;

    return json({ items: page, nextCursor });
  } catch (e) {
    return error("list_failed", 500, { detail: String((e as Error).message) });
  }
}

export const POST = buildCreate("votingItems");
