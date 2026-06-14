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
  taggedUsers?: TaggedUserState[];
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
  taggedUsers?: TaggedUserState[];
  status: "pending" | "approved" | "rejected" | "waiting_tagged" | "cancelled";
  source: "content" | "box";
  decisionHistory: { action: string; by: string; at: string }[];
  timeline: { event: string; at: string }[];
  reviewedBy?: string | null;
  adminNote?: string | null;
};

export type TaggedUserState = {
  userId: string;
  name: string;
  action: "pending" | "accepted" | "declined";
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

export function normalizeTaggedUsers(
  duality: Pick<DualityRequestDoc, "taggedUserId" | "taggedUserName" | "taggedUserAction"> & {
    taggedUsers?: TaggedUserState[];
  }
): TaggedUserState[] {
  if (Array.isArray(duality.taggedUsers) && duality.taggedUsers.length > 0) {
    return duality.taggedUsers
      .filter((user) => typeof user?.userId === "string" && user.userId)
      .map((user) => ({
        userId: user.userId,
        name: user.name || "Tagged User",
        action: user.action === "accepted" || user.action === "declined" ? user.action : "pending",
      }));
  }
  return [
    {
      userId: duality.taggedUserId,
      name: duality.taggedUserName || "Tagged User",
      action: duality.taggedUserAction || "pending",
    },
  ].filter((user) => user.userId);
}

export function userCanRespondToDuality(duality: DualityRequestDoc, userId: string) {
  return normalizeTaggedUsers(duality).some((user) => user.userId === userId);
}

export function aggregateTaggedUserStatus(taggedUsers: TaggedUserState[]) {
  if (taggedUsers.some((user) => user.action === "pending")) return "waiting_tagged";
  if (taggedUsers.some((user) => user.action === "declined")) return "rejected";
  if (taggedUsers.length > 0 && taggedUsers.every((user) => user.action === "accepted")) {
    return "pending";
  }
  return "waiting_tagged";
}

export function effectiveDualityStatus(duality: DualityRequestDoc) {
  if (duality.status === "approved" || duality.status === "cancelled") return duality.status;
  return aggregateTaggedUserStatus(normalizeTaggedUsers(duality));
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
    status: "approved",
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
    contentPatch.status = "approved";
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
    taggedUsers?: TaggedUserState[];
  }
) {
  const at = dayStamp();
  const taggedUsers =
    payload.taggedUsers && payload.taggedUsers.length > 0
      ? payload.taggedUsers
      : [{ userId: payload.taggedUserId, name: payload.taggedUserName, action: payload.taggedUserAction }];
  const status = aggregateTaggedUserStatus(taggedUsers);

  await createDoc(
    "dualityRequests",
    {
      ownerId: payload.ownerId,
      ownerName: payload.ownerName,
      taggedUserId: payload.taggedUserId,
      taggedUserName: payload.taggedUserName,
      taggedUserAction: payload.taggedUserAction,
      taggedUsers,
      status,
      source,
      reviewedBy: null,
      adminNote: null,
      decisionHistory: [{ action: "Created", by: payload.ownerName, at }],
      timeline: [
        { event: "Request created", at },
        ...(status === "waiting_tagged" ? [{ event: "Tagged users notified", at }] : []),
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
    taggedUsers?: TaggedUserState[];
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
    taggedUsers?: TaggedUserState[];
  }
) {
  await buildDualityRequest(boxId, "box", payload);
}

export async function applyTaggedUserDecision(
  id: string,
  duality: DualityRequestDoc,
  actorName: string,
  decision: "accepted" | "declined",
  actorUserId?: string
) {
  const at = dayStamp();
  const nowIso = new Date().toISOString();
  const targetUserId = actorUserId || duality.taggedUserId;
  const taggedUsers = normalizeTaggedUsers(duality);
  const updatedTaggedUsers = taggedUsers.map((user) =>
    user.userId === targetUserId ? { ...user, action: decision } : user
  );
  const targetTaggedUser = updatedTaggedUsers.find((user) => user.userId === targetUserId);
  if (!targetTaggedUser) return;
  const dualityStatus = aggregateTaggedUserStatus(updatedTaggedUsers);
  const firstTaggedUser = updatedTaggedUsers[0] || targetTaggedUser;

  await updateDoc("dualityRequests", id, {
    taggedUserId: firstTaggedUser.userId,
    taggedUserName: firstTaggedUser.name,
    taggedUserAction: firstTaggedUser.action,
    taggedUsers: updatedTaggedUsers,
    status: dualityStatus,
    decisionHistory: [
      ...(duality.decisionHistory || []),
      {
        action: decision === "accepted" ? "Tagged user accepted" : "Tagged user declined",
        by: actorName,
        at,
      },
      ...(dualityStatus === "rejected" ? [{ action: "Rejected", by: "System", at }] : []),
    ],
    timeline: [
      ...(duality.timeline || []),
      {
        event: decision === "accepted" ? "Tagged user accepted" : "Tagged user declined",
        at,
      },
      ...(dualityStatus === "rejected" ? [{ event: "Auto-rejected", at }] : []),
      ...(dualityStatus === "pending" ? [{ event: "All tagged users accepted", at }] : []),
    ],
  });

  if (duality.source === "box") {
    const box = await getDoc<Record<string, unknown>>("bmidBoxRequests", id);
    if (!box) return;
    const historyEntry = {
      id: `${id}-h${((box.history as unknown[])?.length || 0) + 1}-${Date.now()}`,
      requestId: id,
      actionType: "tagged_user_action",
      actorId: targetUserId,
      actorName,
      note: decision === "accepted" ? "Tagged user accepted" : "Tagged user declined",
      createdAt: nowIso,
    };
    const boxAction =
      firstTaggedUser.action === "declined"
        ? "refused"
        : firstTaggedUser.action;
    await updateDoc("bmidBoxRequests", id, {
      taggedUserId: firstTaggedUser.userId,
      taggedUserAction: boxAction,
      taggedUsers: updatedTaggedUsers,
      taggedUserActionAt: nowIso,
      taggedUserActionNote: decision === "accepted" ? "Tagged user accepted" : "Tagged user declined",
      currentStatus:
        dualityStatus === "pending"
          ? "pending_admin_review"
          : dualityStatus === "rejected"
            ? "refused"
            : "pending_tagged_user",
      rejectionReason: dualityStatus === "rejected" ? "Tagged user declined Duality participation" : null,
      finalizedAt: dualityStatus === "rejected" ? nowIso : null,
      history: [...((box.history as unknown[]) || []), historyEntry],
    });
    return;
  }

  const content = await getDoc<Record<string, unknown>>("contentRequests", id);
  const existingNotes = (content?.adminNotes as { note: string; by: string; at: string }[] | undefined) || [];
  await updateDoc("contentRequests", id, {
    taggedUserId: firstTaggedUser.userId,
    taggedUserName: firstTaggedUser.name,
    taggedUserAction: firstTaggedUser.action,
    taggedUsers: updatedTaggedUsers,
    status: dualityStatus === "pending" ? "pending" : dualityStatus,
    rejectionReason: dualityStatus === "rejected" ? "Tagged user declined" : null,
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
