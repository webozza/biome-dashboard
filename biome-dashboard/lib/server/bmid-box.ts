import {
  bmidBoxRequests as seededRequests,
  bmidBoxSettings as seededSettings,
  type BmidBoxHistoryEntry,
  type BmidBoxIdentitySnapshot,
  type BmidBoxRequest,
  type BmidBoxRequestStatus,
  type BmidBoxSettings,
  type BmidBoxVote,
  type BmidBoxVoteType,
  type BmidBoxVotingStatus,
} from "@/lib/data/bmid-box";
import { users } from "@/lib/data/mock-data";
import {
  createDoc,
  deleteManyDocs,
  getDoc,
  listCollection,
  listDocIds,
  updateDoc,
} from "@/lib/server/firestore";
import { buildDualityRequestFromBox } from "@/lib/server/bmid";

const REQUESTS_COLLECTION = "bmidBoxRequests";
const SETTINGS_COLLECTION = "bmidBoxSettings";
const SETTINGS_DOC_ID = "global";
const DUALITY_COLLECTION = "dualityRequests";

export type BmidBoxRequestDoc = BmidBoxRequest & { id: string };

function nowIso() {
  return new Date().toISOString();
}

function identitySnapshot(userId: string | null): BmidBoxIdentitySnapshot | null {
  if (!userId) return null;
  const user = users.find((entry) => entry.id === userId);
  if (!user) {
    return {
      userId,
      name: "Unknown user",
      bmidNumber: null,
      verified: false,
    };
  }
  return {
    userId: user.id,
    name: user.name,
    bmidNumber: user.bmidNumber,
    verified: user.verified,
  };
}

async function backfillRequestSnapshots() {
  const { items } = await listCollection<BmidBoxRequest>(REQUESTS_COLLECTION, {
    limit: 100,
    orderBy: "createdAt",
  });

  await Promise.all(
    items.map(async (request) => {
      if (request.ownerSnapshot && (request.taggedSnapshot || request.taggedUserId === null)) return;
      await updateDoc(REQUESTS_COLLECTION, request.id, {
        ownerSnapshot: request.ownerSnapshot || identitySnapshot(request.ownerUserId),
        taggedSnapshot:
          request.taggedSnapshot !== undefined
            ? request.taggedSnapshot
            : identitySnapshot(request.taggedUserId),
      });
    })
  );
}

async function ensureSettingsSeeded() {
  const existing = await getDoc<BmidBoxSettings>(SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  if (existing) return;
  await createDoc(
    SETTINGS_COLLECTION,
    seededSettings as unknown as Record<string, unknown>,
    SETTINGS_DOC_ID
  );
}

async function backfillBoxDualityRequests() {
  const { items } = await listCollection<BmidBoxRequest>(REQUESTS_COLLECTION, {
    limit: 100,
    orderBy: "createdAt",
  });

  await Promise.all(
    items.map(async (request) => {
      if (request.type !== "duality") return;
      if (request.currentStatus !== "pending_tagged_user") return;
      if (!request.taggedUserId) return;
      const existing = await getDoc(DUALITY_COLLECTION, request.id);
      if (existing) return;
      await buildDualityRequestFromBox(request.id, {
        ownerId: request.ownerUserId,
        ownerName: request.ownerSnapshot?.name || "Unknown owner",
        taggedUserId: request.taggedUserId,
        taggedUserName: request.taggedSnapshot?.name || "Unknown tagged user",
        taggedUserAction: "pending",
      });
    })
  );
}

export async function ensureBmidBoxSeeded() {
  await ensureSettingsSeeded();
  await backfillRequestSnapshots();
  await backfillBoxDualityRequests();
}

export async function listBmidBoxRequests() {
  await ensureBmidBoxSeeded();
  const { items } = await listCollection<BmidBoxRequest>(REQUESTS_COLLECTION, {
    limit: 100,
    orderBy: "createdAt",
  });
  return items;
}

export async function getBmidBoxRequestById(id: string) {
  await ensureBmidBoxSeeded();
  return getDoc<BmidBoxRequest>(REQUESTS_COLLECTION, id);
}

export async function listFilteredBmidBoxRequests(searchParams: URLSearchParams) {
  const all = await listBmidBoxRequests();
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const platform = searchParams.get("platform");
  const ownerUserId = searchParams.get("ownerUserId");
  const taggedUserId = searchParams.get("taggedUserId");
  const verifiedOnly = searchParams.get("verifiedOnly");
  const search = searchParams.get("search")?.trim().toLowerCase();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  return all.filter((request) => {
    if (status && status !== "all" && request.currentStatus !== status) return false;
    if (type && type !== "all" && request.type !== type) return false;
    if (platform && platform !== "all" && request.sourcePlatform !== platform) return false;
    if (ownerUserId && request.ownerUserId !== ownerUserId) return false;
    if (taggedUserId && request.taggedUserId !== taggedUserId) return false;
    if (verifiedOnly === "true" && !request.ownerVerified) return false;
    if (verifiedOnly === "true" && request.type === "duality" && !request.taggedUserVerified) return false;
    if (from && new Date(request.createdAt) < new Date(from)) return false;
    if (to && new Date(request.createdAt) > new Date(to)) return false;
    if (search) {
      const haystack = [
        request.id,
        request.sourceUrl,
        request.previewData.title,
        request.previewData.caption,
        request.previewData.description,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export async function getBmidBoxSettings() {
  await ensureBmidBoxSeeded();
  const settings = await getDoc<BmidBoxSettings>(SETTINGS_COLLECTION, SETTINGS_DOC_ID);
  return settings || { id: SETTINGS_DOC_ID, ...seededSettings };
}

export async function patchBmidBoxSettings(patch: Partial<BmidBoxSettings>) {
  await ensureBmidBoxSeeded();
  await updateDoc(SETTINGS_COLLECTION, SETTINGS_DOC_ID, patch as Record<string, unknown>);
  return getBmidBoxSettings();
}

export async function getBmidBoxSummary() {
  const requests = await listBmidBoxRequests();
  const active = requests.filter((request) => request.currentStatus !== "removed");
  return {
    total: active.length,
    pendingAdminReview: active.filter((request) => request.currentStatus === "pending_admin_review").length,
    pendingTaggedUser: active.filter((request) => request.currentStatus === "pending_tagged_user").length,
    pendingVoting: active.filter((request) => request.currentStatus === "pending_voting").length,
    approved: active.filter((request) => request.currentStatus === "approved").length,
    refused: active.filter((request) => request.currentStatus === "refused").length,
    removed: requests.filter((request) => request.currentStatus === "removed").length,
  };
}

export async function getBmidBoxVotingRows() {
  const requests = await listBmidBoxRequests();
  return requests.filter((request) => request.currentStatus === "pending_voting" || Boolean(request.votingStatus));
}

export async function getBmidBoxAuditRows() {
  const requests = await listBmidBoxRequests();
  return requests.flatMap((request) =>
    request.history.map((entry) => ({
      id: entry.id,
      requestId: request.id,
      ownerName: request.ownerSnapshot?.name || request.ownerUserId,
      taggedName: request.taggedSnapshot?.name || request.taggedUserId,
      requestType: request.type,
      sourcePlatform: request.sourcePlatform,
      requestStatus: request.currentStatus,
      votingStatus: request.votingStatus,
      actionType: entry.actionType,
      actorName: entry.actorName,
      note: entry.note,
      rejectionReason: request.rejectionReason,
      removalReason: request.removalReason,
      createdAt: entry.createdAt,
    }))
  );
}

function buildHistoryEntry(
  request: BmidBoxRequestDoc,
  actionType: BmidBoxHistoryEntry["actionType"],
  actorName: string,
  note: string
): BmidBoxHistoryEntry {
  return {
    id: `${request.id}-h${(request.history?.length || 0) + 1}-${Date.now()}`,
    requestId: request.id,
    actionType,
    actorId: "admin",
    actorName,
    note,
    createdAt: nowIso(),
  };
}

function determineFinalState(request: BmidBoxRequestDoc) {
  const highest = Math.max(request.acceptCount, request.ignoreCount, request.refuseCount);
  if (highest === 0) return "cancelled";
  if (highest === request.acceptCount) return "approved";
  if (highest === request.refuseCount) return "refused";
  return "cancelled";
}

export async function appendBmidBoxNote(id: string, actorName: string, note: string) {
  const request = await getBmidBoxRequestById(id);
  if (!request) return null;

  const historyEntry = buildHistoryEntry(request, "note_added", actorName, note);
  await updateDoc(REQUESTS_COLLECTION, id, {
    adminNotes: [...(request.adminNotes || []), note],
    history: [...(request.history || []), historyEntry],
  });
  return getBmidBoxRequestById(id);
}

export async function applyBmidBoxAction(
  id: string,
  input: {
    actorName: string;
    action:
      | "approve_request"
      | "reject_request"
      | "mark_invalid"
      | "move_to_tagged_user_stage"
      | "move_to_voting_stage"
      | "close_voting"
      | "finalize_voting"
      | "remove_request";
    note?: string | null;
    rejectionReason?: string | null;
    removalReason?: string | null;
    result?: "approved" | "refused" | "cancelled" | null;
  }
) {
  const request = await getBmidBoxRequestById(id);
  if (!request) return null;

  const patch: Partial<BmidBoxRequest> = {};
  const actionNow = nowIso();
  let actionType: BmidBoxHistoryEntry["actionType"] = "status_changed";
  let note = input.note?.trim() || input.action.replaceAll("_", " ");

  switch (input.action) {
    case "approve_request":
      patch.currentStatus = request.currentStatus === "pending_voting" ? "approved" : "pending_voting";
      if (patch.currentStatus === "approved") {
        patch.votingStatus = "finalized";
        patch.finalizedAt = actionNow;
      } else {
        patch.votingStatus = "open";
        patch.votingStartAt = request.votingStartAt || actionNow;
        patch.finalizedAt = null;
      }
      break;
    case "reject_request":
      patch.currentStatus = "refused";
      patch.votingStatus = request.votingStatus ? "finalized" : request.votingStatus;
      patch.rejectionReason = input.rejectionReason || "Rejected by admin";
      patch.finalizedAt = actionNow;
      actionType = "finalized";
      break;
    case "mark_invalid":
      patch.currentStatus = "cancelled";
      patch.rejectionReason = input.rejectionReason || "Marked invalid by admin";
      actionType = "status_changed";
      break;
    case "move_to_tagged_user_stage":
      patch.currentStatus = "pending_tagged_user";
      break;
    case "move_to_voting_stage":
      patch.currentStatus = "pending_voting";
      patch.votingStatus = "open";
      patch.votingStartAt = request.votingStartAt || actionNow;
      patch.finalizedAt = null;
      actionType = "voting_opened";
      note = input.note?.trim() || "Moved to voting";
      break;
    case "close_voting":
      patch.votingStatus = "closed";
      patch.votingEndAt = actionNow;
      actionType = "voting_closed";
      note = input.note?.trim() || "Voting closed";
      break;
    case "finalize_voting":
      patch.votingStatus = "finalized";
      patch.finalizedAt = actionNow;
      patch.currentStatus = input.result || determineFinalState(request);
      actionType = "finalized";
      note = input.note?.trim() || "Voting finalized";
      break;
    case "remove_request":
      patch.currentStatus = "removed";
      patch.votingStatus = request.votingStatus ? "finalized" : request.votingStatus;
      patch.removalReason = input.removalReason || "Removed by admin";
      patch.finalizedAt = actionNow;
      actionType = "removed";
      note = input.note?.trim() || patch.removalReason;
      break;
  }

  if (patch.currentStatus === "pending_voting" && patch.votingStatus === undefined) {
    patch.votingStatus = "open";
    patch.finalizedAt = null;
  }

  const historyEntry = buildHistoryEntry(request, actionType, input.actorName, note);
  await updateDoc(REQUESTS_COLLECTION, id, {
    ...patch,
    history: [...(request.history || []), historyEntry],
  } as Record<string, unknown>);

  return getBmidBoxRequestById(id);
}

export async function getBmidBoxDashboardPayload() {
  const [summary, requests, voting, audit] = await Promise.all([
    getBmidBoxSummary(),
    listBmidBoxRequests(),
    getBmidBoxVotingRows(),
    getBmidBoxAuditRows(),
  ]);
  return { summary, requests, voting, audit };
}

export function mapRequestStatusToBadge(status: BmidBoxRequestStatus) {
  return status;
}

export function mapVotingStatusToBadge(status: BmidBoxVotingStatus | null) {
  return status || "submitted";
}

export async function resetBmidBoxRequests() {
  const ids = await listDocIds(REQUESTS_COLLECTION);
  await deleteManyDocs(REQUESTS_COLLECTION, ids);
  return { deletedCount: ids.length };
}

export async function castBmidBoxVote(
  requestId: string,
  input: { voterUserId: string; voterName: string; voteType: BmidBoxVoteType }
): Promise<
  | { ok: true; request: BmidBoxRequest & { id: string } }
  | { ok: false; reason: "not_found" | "voting_not_open" | "already_voted" }
> {
  const request = await getBmidBoxRequestById(requestId);
  if (!request) return { ok: false, reason: "not_found" };
  if (request.votingStatus !== "open") return { ok: false, reason: "voting_not_open" };

  const votes: BmidBoxVote[] = (request as unknown as { votes?: BmidBoxVote[] }).votes || [];
  if (votes.some((vote) => vote.voterUserId === input.voterUserId)) {
    return { ok: false, reason: "already_voted" };
  }

  const now = nowIso();
  const newVote: BmidBoxVote = {
    id: `${requestId}-v${votes.length + 1}-${Date.now()}`,
    requestId,
    voterUserId: input.voterUserId,
    voterName: input.voterName,
    voteType: input.voteType,
    createdAt: now,
  };

  const patch: Partial<BmidBoxRequest> & { votes: BmidBoxVote[] } = {
    votes: [...votes, newVote],
    acceptCount: request.acceptCount + (input.voteType === "accept" ? 1 : 0),
    ignoreCount: request.ignoreCount + (input.voteType === "ignore" ? 1 : 0),
    refuseCount: request.refuseCount + (input.voteType === "refuse" ? 1 : 0),
  };

  const historyEntry = buildHistoryEntry(
    request,
    "status_changed",
    input.voterName,
    `Cast ${input.voteType} vote`
  );

  await updateDoc(REQUESTS_COLLECTION, requestId, {
    ...patch,
    history: [...(request.history || []), historyEntry],
  } as Record<string, unknown>);

  const fresh = await getBmidBoxRequestById(requestId);
  return { ok: true, request: fresh! };
}

export async function seedBmidBoxRequests(options: { force?: boolean } = {}) {
  await ensureSettingsSeeded();

  if (options.force) {
    const ids = await listDocIds(REQUESTS_COLLECTION);
    await deleteManyDocs(REQUESTS_COLLECTION, ids);
  }

  const existingIds = new Set(await listDocIds(REQUESTS_COLLECTION));
  let insertedCount = 0;
  let skippedCount = 0;

  for (const request of seededRequests) {
    if (existingIds.has(request.id)) {
      skippedCount += 1;
      continue;
    }
    const { id, ...payload } = request;
    await createDoc(REQUESTS_COLLECTION, payload as unknown as Record<string, unknown>, id);
    insertedCount += 1;
  }

  return {
    insertedCount,
    skippedCount,
    totalSeedFixtures: seededRequests.length,
    forced: Boolean(options.force),
  };
}
