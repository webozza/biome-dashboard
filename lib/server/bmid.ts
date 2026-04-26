import { createDoc, getDoc, updateDoc } from "./firestore";

export type VoteDecision = "accept" | "ignore" | "refuse";
export type VotingOutcome = "accepted" | "ignored" | "refused" | null;
export type VotingStatus = "open" | "closed" | "finalized" | null;

export type ContentRequestDoc = {
  id: string;
  userId: string;
  userName: string;
  bmidNumber?: string | null;
  postTitle: string;
  postPreview: string;
  postImageUrl?: string | null;
  postId?: string | null;
  type: "own" | "duality";
  status: "pending" | "approved" | "rejected" | "in_review" | "cancelled" | "waiting_tagged";
  adminNotes?: { note: string; by: string; at: string }[];
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  taggedUserId?: string | null;
  taggedUserName?: string | null;
  taggedUserAction?: "pending" | "accepted" | "declined" | null;
  voteAccept?: number;
  voteIgnore?: number;
  voteRefuse?: number;
  votingStatus?: VotingStatus;
  votingOutcome?: VotingOutcome;
  createdAt: string;
  updatedAt: string;
};

export type DualityRequestDoc = {
  id: string;
  ownerId: string;
  ownerName: string;
  taggedUserId: string;
  taggedUserName: string;
  taggedUserAction: "pending" | "accepted" | "declined";
  status: "pending" | "approved" | "rejected" | "waiting_tagged" | "cancelled";
  source: "content" | "box";
  decisionHistory: { action: string; by: string; at: string }[];
  timeline: { event: string; at: string }[];
  reviewedBy?: string | null;
  adminNote?: string | null;
};

export type VotingItemDoc = {
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
  outcome: VotingOutcome;
};

function isoNow() {
  return new Date().toISOString();
}

function dayStamp() {
  return isoNow().split("T")[0];
}

export function computeVotingOutcome(accept: number, ignore: number, refuse: number): VotingOutcome {
  const max = Math.max(accept, ignore, refuse);
  if (max <= 0) return null;
  const winners = [
    accept === max ? "accepted" : null,
    ignore === max ? "ignored" : null,
    refuse === max ? "refused" : null,
  ].filter(Boolean);
  return winners.length === 1 ? (winners[0] as VotingOutcome) : null;
}

export async function ensureVotingSession(content: ContentRequestDoc): Promise<VotingItemDoc> {
  const existing = await getDoc<VotingItemDoc>("votingItems", content.id);
  const openedAt = existing?.openedAt || isoNow();
  const payload: Omit<VotingItemDoc, "id"> = {
    requestId: content.id,
    requestType: "content",
    title: `${content.postTitle} - ${content.userName}`,
    accept: existing?.accept || 0,
    ignore: existing?.ignore || 0,
    refuse: existing?.refuse || 0,
    status: "open",
    openedAt,
    closedAt: null,
    outcome: null,
  };
  if (existing) {
    await updateDoc("votingItems", content.id, payload);
  } else {
    await createDoc("votingItems", payload as unknown as Record<string, unknown>, content.id);
  }

  await updateDoc("contentRequests", content.id, {
    status: "in_review",
    votingStatus: "open",
    votingOutcome: null,
    voteAccept: payload.accept,
    voteIgnore: payload.ignore,
    voteRefuse: payload.refuse,
  });

  return (await getDoc<VotingItemDoc>("votingItems", content.id)) as VotingItemDoc;
}

export async function syncVotingToContent(voting: VotingItemDoc): Promise<void> {
  const outcome = voting.outcome ?? computeVotingOutcome(voting.accept, voting.ignore, voting.refuse);
  const contentPatch: Record<string, unknown> = {
    voteAccept: voting.accept,
    voteIgnore: voting.ignore,
    voteRefuse: voting.refuse,
    votingStatus: voting.status,
    votingOutcome: outcome,
  };

  if (voting.status === "finalized" && outcome) {
    if (outcome === "accepted") {
      contentPatch.status = "approved";
      contentPatch.rejectionReason = null;
    } else if (outcome === "refused") {
      contentPatch.status = "rejected";
      contentPatch.rejectionReason = "Community voted to refuse";
    } else if (outcome === "ignored") {
      contentPatch.status = "cancelled";
      contentPatch.rejectionReason = "Community vote resulted in ignore";
    }
  } else if (voting.status === "open") {
    contentPatch.status = "in_review";
  }

  await updateDoc("contentRequests", voting.requestId, contentPatch);
}

async function buildDualityRequest(
  id: string,
  source: "content" | "box",
  payload: {
    ownerId: string;
    ownerName: string;
    taggedUserId: string;
    taggedUserName: string;
    taggedUserAction: "pending" | "accepted" | "declined";
  }
) {
  const at = dayStamp();
  const status =
    payload.taggedUserAction === "accepted"
      ? "pending"
      : payload.taggedUserAction === "declined"
        ? "rejected"
        : "waiting_tagged";

  await createDoc(
    "dualityRequests",
    {
      ownerId: payload.ownerId,
      ownerName: payload.ownerName,
      taggedUserId: payload.taggedUserId,
      taggedUserName: payload.taggedUserName,
      taggedUserAction: payload.taggedUserAction,
      status,
      source,
      reviewedBy: null,
      adminNote: null,
      decisionHistory: [{ action: "Created", by: payload.ownerName, at }],
      timeline: [
        { event: "Request created", at },
        ...(payload.taggedUserAction === "pending" ? [{ event: "Tagged user notified", at }] : []),
      ],
    },
    id
  );
}

export async function buildDualityRequestFromContent(
  contentId: string,
  payload: {
    ownerId: string;
    ownerName: string;
    taggedUserId: string;
    taggedUserName: string;
    taggedUserAction: "pending" | "accepted" | "declined";
  }
) {
  await buildDualityRequest(contentId, "content", payload);
}

export async function buildDualityRequestFromBox(
  boxId: string,
  payload: {
    ownerId: string;
    ownerName: string;
    taggedUserId: string;
    taggedUserName: string;
    taggedUserAction: "pending" | "accepted" | "declined";
  }
) {
  await buildDualityRequest(boxId, "box", payload);
}

export async function applyTaggedUserDecision(
  id: string,
  duality: DualityRequestDoc,
  actorName: string,
  decision: "accepted" | "declined"
) {
  const at = dayStamp();
  const nowIso = new Date().toISOString();
  const dualityStatus = decision === "accepted" ? "pending" : "rejected";

  await updateDoc("dualityRequests", id, {
    taggedUserAction: decision,
    status: dualityStatus,
    decisionHistory: [
      ...(duality.decisionHistory || []),
      {
        action: decision === "accepted" ? "Tagged user accepted" : "Tagged user declined",
        by: actorName,
        at,
      },
      ...(decision === "declined" ? [{ action: "Rejected", by: "System", at }] : []),
    ],
    timeline: [
      ...(duality.timeline || []),
      {
        event: decision === "accepted" ? "Tagged user accepted" : "Tagged user declined",
        at,
      },
      ...(decision === "declined" ? [{ event: "Auto-rejected", at }] : []),
    ],
  });

  if (duality.source === "box") {
    const box = await getDoc<Record<string, unknown>>("bmidBoxRequests", id);
    if (!box) return;
    const historyEntry = {
      id: `${id}-h${((box.history as unknown[])?.length || 0) + 1}-${Date.now()}`,
      requestId: id,
      actionType: "tagged_user_action",
      actorId: duality.taggedUserId,
      actorName,
      note: decision === "accepted" ? "Tagged user accepted" : "Tagged user declined",
      createdAt: nowIso,
    };
    await updateDoc("bmidBoxRequests", id, {
      taggedUserAction: decision === "accepted" ? "accepted" : "refused",
      taggedUserActionAt: nowIso,
      taggedUserActionNote: decision === "accepted" ? "Tagged user accepted" : "Tagged user declined",
      currentStatus: decision === "accepted" ? "pending_admin_review" : "refused",
      rejectionReason: decision === "declined" ? "Tagged user declined Duality participation" : null,
      finalizedAt: decision === "declined" ? nowIso : null,
      history: [...((box.history as unknown[]) || []), historyEntry],
    });
    return;
  }

  const content = await getDoc<Record<string, unknown>>("contentRequests", id);
  const existingNotes = (content?.adminNotes as { note: string; by: string; at: string }[] | undefined) || [];
  await updateDoc("contentRequests", id, {
    taggedUserAction: decision,
    status: decision === "accepted" ? "pending" : "rejected",
    rejectionReason: decision === "declined" ? "Tagged user declined" : null,
    adminNotes: [
      ...existingNotes,
      {
        note: decision === "accepted" ? "Tagged user accepted" : "Tagged user declined",
        by: actorName,
        at,
      },
    ],
  });
}
