import { users, type User } from "@/lib/data/mock-data";

export type BmidBoxRequestType = "own" | "duality";
export type BmidBoxPlatform = "instagram" | "tiktok" | "youtube" | "facebook";
export type BmidBoxRequestStatus =
  | "draft"
  | "submitted"
  | "pending_admin_review"
  | "pending_tagged_user"
  | "pending_voting"
  | "approved"
  | "refused"
  | "cancelled"
  | "removed";
export type BmidBoxVotingStatus = "open" | "closed" | "finalized";
export type BmidBoxVoteType = "accept" | "ignore" | "refuse";
export type TaggedUserAction = "pending" | "accepted" | "ignored" | "refused";

export interface BmidBoxIdentitySnapshot {
  userId: string | null;
  name: string;
  bmidNumber: string | null;
  verified: boolean;
}

export interface BmidBoxHistoryEntry {
  id: string;
  requestId: string;
  actionType:
    | "submitted"
    | "reviewed"
    | "status_changed"
    | "tagged_user_action"
    | "voting_opened"
    | "voting_closed"
    | "finalized"
    | "note_added"
    | "removed"
    | "notification_sent";
  actorId: string;
  actorName: string;
  note: string;
  createdAt: string;
}

export interface BmidBoxVote {
  id: string;
  requestId: string;
  voterUserId: string;
  voterName: string;
  voteType: BmidBoxVoteType;
  createdAt: string;
}

export interface BmidBoxRequest {
  id: string;
  ownerUserId: string;
  taggedUserId: string | null;
  ownerSnapshot: BmidBoxIdentitySnapshot;
  taggedSnapshot: BmidBoxIdentitySnapshot | null;
  type: BmidBoxRequestType;
  sourcePlatform: BmidBoxPlatform;
  sourceUrl: string;
  previewData: {
    title: string;
    caption: string;
    description: string;
    thumbnailUrl: string;
    embedEnabled: boolean;
    contentType: "video" | "photo" | "post";
  };
  currentStatus: BmidBoxRequestStatus;
  votingStatus: BmidBoxVotingStatus | null;
  acceptCount: number;
  ignoreCount: number;
  refuseCount: number;
  adminNotes: string[];
  rejectionReason: string | null;
  removalReason: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string;
  reviewedAt: string | null;
  votingStartAt: string | null;
  votingEndAt: string | null;
  finalizedAt: string | null;
  taggedUserAction: TaggedUserAction | null;
  taggedUserActionAt: string | null;
  taggedUserActionNote: string | null;
  ownerVerified: boolean;
  taggedUserVerified: boolean | null;
  verificationChecks: {
    ownerVerified: boolean;
    platformAllowed: boolean;
    urlReachable: boolean;
    duplicateUrl: boolean;
    supportedContentType: boolean;
  };
  notificationEvents: Array<{
    id: string;
    type:
      | "box_request_submitted"
      | "duality_tagged"
      | "request_moved_to_voting"
      | "request_approved"
      | "request_refused"
      | "request_removed";
    sentAt: string;
    recipient: string;
  }>;
  votes?: BmidBoxVote[];
  history: BmidBoxHistoryEntry[];
}

export interface BmidBoxSettings {
  allowedPlatforms: BmidBoxPlatform[];
  embedPreviewEnabled: boolean;
  maxPendingRequestsPerUser: number;
  duplicateUrlRule: "block_exact_match" | "warn_only";
  votingStartTrigger: "admin_manual" | "after_tagged_user_accept";
  votingDurationDays: number;
  autoCloseVotingOnExpiry: boolean;
  minimumVotesRequired: number;
  adminCanFinalize: boolean;
  supportedContentTypes: Array<"video" | "photo" | "post">;
}

export const bmidBoxSettings: BmidBoxSettings = {
  allowedPlatforms: ["instagram", "tiktok", "youtube", "facebook"],
  embedPreviewEnabled: true,
  maxPendingRequestsPerUser: 3,
  duplicateUrlRule: "block_exact_match",
  votingStartTrigger: "after_tagged_user_accept",
  votingDurationDays: 7,
  autoCloseVotingOnExpiry: true,
  minimumVotesRequired: 25,
  adminCanFinalize: true,
  supportedContentTypes: ["video", "photo", "post"],
};

function history(
  requestId: string,
  entries: Array<[BmidBoxHistoryEntry["actionType"], string, string, string, string]>
): BmidBoxHistoryEntry[] {
  return entries.map(([actionType, actorId, actorName, note, createdAt], index) => ({
    id: `${requestId}-h${index + 1}`,
    requestId,
    actionType,
    actorId,
    actorName,
    note,
    createdAt,
  }));
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

export const bmidBoxRequests: BmidBoxRequest[] = [
  {
    id: "box-2401",
    ownerUserId: "u1",
    taggedUserId: "u1",
    ownerSnapshot: identitySnapshot("u1")!,
    taggedSnapshot: identitySnapshot("u1"),
    type: "own",
    sourcePlatform: "instagram",
    sourceUrl: "https://instagram.com/p/biome-own-2401",
    previewData: {
      title: "Studio routine clip",
      caption: "Verified creator reel submitted into BMID Box.",
      description: "Owner claims the content is original and wants it reviewed for voting.",
      thumbnailUrl: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80",
      embedEnabled: true,
      contentType: "video",
    },
    currentStatus: "pending_admin_review",
    votingStatus: null,
    acceptCount: 0,
    ignoreCount: 0,
    refuseCount: 0,
    adminNotes: [],
    rejectionReason: null,
    removalReason: null,
    createdAt: "2026-04-11T09:12:00Z",
    updatedAt: "2026-04-11T09:12:00Z",
    submittedAt: "2026-04-11T09:12:00Z",
    reviewedAt: null,
    votingStartAt: null,
    votingEndAt: null,
    finalizedAt: null,
    taggedUserAction: "accepted",
    taggedUserActionAt: "2026-04-11T09:12:00Z",
    taggedUserActionNote: "Own request auto-confirmed",
    ownerVerified: true,
    taggedUserVerified: true,
    verificationChecks: {
      ownerVerified: true,
      platformAllowed: true,
      urlReachable: true,
      duplicateUrl: false,
      supportedContentType: true,
    },
    notificationEvents: [
      { id: "n1", type: "box_request_submitted", sentAt: "2026-04-11T09:13:00Z", recipient: "Alex Morgan" },
    ],
    history: history("box-2401", [
      ["submitted", "u1", "Alex Morgan", "Submitted Instagram reel into Box", "2026-04-11T09:12:00Z"],
    ]),
  },
  {
    id: "box-2402",
    ownerUserId: "u2",
    taggedUserId: "u2",
    ownerSnapshot: identitySnapshot("u2")!,
    taggedSnapshot: identitySnapshot("u2"),
    type: "own",
    sourcePlatform: "youtube",
    sourceUrl: "https://youtube.com/watch?v=owner2402",
    previewData: {
      title: "Cinematic cooking short",
      caption: "Jordan submitted a verified own-post cooking reel.",
      description: "Original YouTube short queued for admin verification before voting.",
      thumbnailUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80",
      embedEnabled: true,
      contentType: "video",
    },
    currentStatus: "pending_admin_review",
    votingStatus: null,
    acceptCount: 0,
    ignoreCount: 0,
    refuseCount: 0,
    adminNotes: [],
    rejectionReason: null,
    removalReason: null,
    createdAt: "2026-04-14T13:05:00Z",
    updatedAt: "2026-04-14T13:05:00Z",
    submittedAt: "2026-04-14T13:05:00Z",
    reviewedAt: null,
    votingStartAt: null,
    votingEndAt: null,
    finalizedAt: null,
    taggedUserAction: "accepted",
    taggedUserActionAt: "2026-04-14T13:05:00Z",
    taggedUserActionNote: "Own request auto-confirmed",
    ownerVerified: true,
    taggedUserVerified: true,
    verificationChecks: {
      ownerVerified: true,
      platformAllowed: true,
      urlReachable: true,
      duplicateUrl: false,
      supportedContentType: true,
    },
    notificationEvents: [
      { id: "n3", type: "box_request_submitted", sentAt: "2026-04-14T13:06:00Z", recipient: "Jordan Lee" },
    ],
    history: history("box-2402", [
      ["submitted", "u2", "Jordan Lee", "Submitted YouTube cooking short into Box", "2026-04-14T13:05:00Z"],
    ]),
  },
  {
    id: "box-2403",
    ownerUserId: "u7",
    taggedUserId: "u7",
    ownerSnapshot: identitySnapshot("u7")!,
    taggedSnapshot: identitySnapshot("u7"),
    type: "own",
    sourcePlatform: "tiktok",
    sourceUrl: "https://tiktok.com/@drewchen/video/2403",
    previewData: {
      title: "Phone teardown short",
      caption: "Short-form review submitted by verified owner.",
      description: "Admin still needs to verify reachability and duplicate risk.",
      thumbnailUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
      embedEnabled: true,
      contentType: "video",
    },
    currentStatus: "pending_admin_review",
    votingStatus: null,
    acceptCount: 0,
    ignoreCount: 0,
    refuseCount: 0,
    adminNotes: [],
    rejectionReason: null,
    removalReason: null,
    createdAt: "2026-04-17T07:20:00Z",
    updatedAt: "2026-04-17T07:20:00Z",
    submittedAt: "2026-04-17T07:20:00Z",
    reviewedAt: null,
    votingStartAt: null,
    votingEndAt: null,
    finalizedAt: null,
    taggedUserAction: "accepted",
    taggedUserActionAt: "2026-04-17T07:20:00Z",
    taggedUserActionNote: "Own request auto-confirmed",
    ownerVerified: true,
    taggedUserVerified: true,
    verificationChecks: {
      ownerVerified: true,
      platformAllowed: true,
      urlReachable: true,
      duplicateUrl: true,
      supportedContentType: true,
    },
    notificationEvents: [
      { id: "n5", type: "box_request_submitted", sentAt: "2026-04-17T07:21:00Z", recipient: "Drew Chen" },
    ],
    history: history("box-2403", [
      ["submitted", "u7", "Drew Chen", "Submitted TikTok teardown clip", "2026-04-17T07:20:00Z"],
    ]),
  },
  {
    id: "box-2404",
    ownerUserId: "u11",
    taggedUserId: "u11",
    ownerSnapshot: identitySnapshot("u11")!,
    taggedSnapshot: identitySnapshot("u11"),
    type: "own",
    sourcePlatform: "facebook",
    sourceUrl: "https://facebook.com/reel/2404",
    previewData: {
      title: "Beat workflow recap",
      caption: "Avery submitted an own-post production recap.",
      description: "New own-post request waiting for admin review.",
      thumbnailUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80",
      embedEnabled: false,
      contentType: "post",
    },
    currentStatus: "pending_admin_review",
    votingStatus: null,
    acceptCount: 0,
    ignoreCount: 0,
    refuseCount: 0,
    adminNotes: [],
    rejectionReason: null,
    removalReason: null,
    createdAt: "2026-04-07T10:00:00Z",
    updatedAt: "2026-04-07T10:00:00Z",
    submittedAt: "2026-04-07T10:00:00Z",
    reviewedAt: null,
    votingStartAt: null,
    votingEndAt: null,
    finalizedAt: null,
    taggedUserAction: "accepted",
    taggedUserActionAt: "2026-04-07T10:00:00Z",
    taggedUserActionNote: "Own request auto-confirmed",
    ownerVerified: true,
    taggedUserVerified: true,
    verificationChecks: {
      ownerVerified: true,
      platformAllowed: true,
      urlReachable: true,
      duplicateUrl: false,
      supportedContentType: true,
    },
    notificationEvents: [{ id: "n7", type: "box_request_submitted", sentAt: "2026-04-07T10:01:00Z", recipient: "Avery Brooks" }],
    history: history("box-2404", [
      ["submitted", "u11", "Avery Brooks", "Submitted Facebook post into Box", "2026-04-07T10:00:00Z"],
    ]),
  },
  {
    id: "box-2405",
    ownerUserId: "u6",
    taggedUserId: "u6",
    ownerSnapshot: identitySnapshot("u6")!,
    taggedSnapshot: identitySnapshot("u6"),
    type: "own",
    sourcePlatform: "instagram",
    sourceUrl: "https://instagram.com/p/verified-2405",
    previewData: {
      title: "Community event highlight set",
      caption: "Sam submitted a verified own-post event carousel.",
      description: "New own-post request waiting for admin review.",
      thumbnailUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
      embedEnabled: true,
      contentType: "photo",
    },
    currentStatus: "pending_admin_review",
    votingStatus: null,
    acceptCount: 0,
    ignoreCount: 0,
    refuseCount: 0,
    adminNotes: [],
    rejectionReason: null,
    removalReason: null,
    createdAt: "2026-04-18T06:40:00Z",
    updatedAt: "2026-04-18T06:40:00Z",
    submittedAt: "2026-04-18T06:40:00Z",
    reviewedAt: null,
    votingStartAt: null,
    votingEndAt: null,
    finalizedAt: null,
    taggedUserAction: "accepted",
    taggedUserActionAt: "2026-04-18T06:40:00Z",
    taggedUserActionNote: "Own request auto-confirmed",
    ownerVerified: true,
    taggedUserVerified: true,
    verificationChecks: {
      ownerVerified: true,
      platformAllowed: true,
      urlReachable: true,
      duplicateUrl: false,
      supportedContentType: true,
    },
    notificationEvents: [
      { id: "n8", type: "box_request_submitted", sentAt: "2026-04-18T06:41:00Z", recipient: "Sam Parker" },
    ],
    history: history("box-2405", [
      ["submitted", "u6", "Sam Parker", "Submitted Instagram photo set into Box", "2026-04-18T06:40:00Z"],
    ]),
  },
  {
    id: "box-2406",
    ownerUserId: "u4",
    taggedUserId: "u4",
    ownerSnapshot: identitySnapshot("u4")!,
    taggedSnapshot: identitySnapshot("u4"),
    type: "own",
    sourcePlatform: "youtube",
    sourceUrl: "https://youtube.com/watch?v=owner2406",
    previewData: {
      title: "Studio session breakdown",
      caption: "Taylor submitted an own-post studio session clip.",
      description: "New own-post request waiting for admin review.",
      thumbnailUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80",
      embedEnabled: true,
      contentType: "video",
    },
    currentStatus: "pending_admin_review",
    votingStatus: null,
    acceptCount: 0,
    ignoreCount: 0,
    refuseCount: 0,
    adminNotes: [],
    rejectionReason: null,
    removalReason: null,
    createdAt: "2026-04-03T11:00:00Z",
    updatedAt: "2026-04-03T11:00:00Z",
    submittedAt: "2026-04-03T11:00:00Z",
    reviewedAt: null,
    votingStartAt: null,
    votingEndAt: null,
    finalizedAt: null,
    taggedUserAction: "accepted",
    taggedUserActionAt: "2026-04-03T11:00:00Z",
    taggedUserActionNote: "Own request auto-confirmed",
    ownerVerified: true,
    taggedUserVerified: true,
    verificationChecks: {
      ownerVerified: true,
      platformAllowed: true,
      urlReachable: true,
      duplicateUrl: false,
      supportedContentType: true,
    },
    notificationEvents: [{ id: "n10", type: "box_request_submitted", sentAt: "2026-04-03T11:01:00Z", recipient: "Taylor Swift" }],
    history: history("box-2406", [
      ["submitted", "u4", "Taylor Swift", "Submitted YouTube studio clip", "2026-04-03T11:00:00Z"],
    ]),
  },
  {
    id: "box-2407",
    ownerUserId: "u9",
    taggedUserId: "u9",
    ownerSnapshot: identitySnapshot("u9")!,
    taggedSnapshot: identitySnapshot("u9"),
    type: "own",
    sourcePlatform: "facebook",
    sourceUrl: "https://facebook.com/reel/2407",
    previewData: {
      title: "Campaign highlight montage",
      caption: "Verified owner submitted a Facebook highlight reel.",
      description: "New own-post request waiting for admin review.",
      thumbnailUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80",
      embedEnabled: false,
      contentType: "video",
    },
    currentStatus: "pending_admin_review",
    votingStatus: null,
    acceptCount: 0,
    ignoreCount: 0,
    refuseCount: 0,
    adminNotes: [],
    rejectionReason: null,
    removalReason: null,
    createdAt: "2026-03-29T08:30:00Z",
    updatedAt: "2026-03-29T08:30:00Z",
    submittedAt: "2026-03-29T08:30:00Z",
    reviewedAt: null,
    votingStartAt: null,
    votingEndAt: null,
    finalizedAt: null,
    taggedUserAction: "accepted",
    taggedUserActionAt: "2026-03-29T08:30:00Z",
    taggedUserActionNote: "Own request auto-confirmed",
    ownerVerified: true,
    taggedUserVerified: true,
    verificationChecks: {
      ownerVerified: true,
      platformAllowed: true,
      urlReachable: true,
      duplicateUrl: false,
      supportedContentType: true,
    },
    notificationEvents: [{ id: "n11", type: "box_request_submitted", sentAt: "2026-03-29T08:31:00Z", recipient: "Quinn Davis" }],
    history: history("box-2407", [
      ["submitted", "u9", "Quinn Davis", "Submitted Facebook reel", "2026-03-29T08:30:00Z"],
    ]),
  },
];

export const bmidBoxVotes: BmidBoxVote[] = [];

export const bmidBoxOpenQuestions = [
  "In Duality, should tagged-user action happen before admin review, after admin review, or both with separate checkpoints?",
  "What produces final approval: majority vote, threshold + quorum, admin decision, or a hybrid?",
  "Can users change votes after casting them?",
  "What is the fallback rule for tie votes or low-vote sessions?",
  "Which external platforms are enabled on day one of rollout?",
];

export function getBmidBoxRequestById(id: string) {
  return bmidBoxRequests.find((request) => request.id === id) || null;
}

export function getUserById(id: string | null): User | null {
  if (!id) return null;
  return users.find((user) => user.id === id) || null;
}

export function getBoxOwner(request: BmidBoxRequest) {
  return getUserById(request.ownerUserId);
}

export function getBoxTaggedUser(request: BmidBoxRequest) {
  return getUserById(request.taggedUserId);
}

export function getBmidBoxAuditRows() {
  return bmidBoxRequests.flatMap((request) =>
    request.history.map((entry) => ({
      id: entry.id,
      requestId: request.id,
      ownerName: request.ownerSnapshot.name,
      taggedName: request.taggedSnapshot?.name || null,
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

export function getBmidBoxSummary() {
  return {
    total: bmidBoxRequests.length,
    pendingAdminReview: bmidBoxRequests.filter((request) => request.currentStatus === "pending_admin_review").length,
    pendingTaggedUser: bmidBoxRequests.filter((request) => request.currentStatus === "pending_tagged_user").length,
    pendingVoting: bmidBoxRequests.filter((request) => request.currentStatus === "pending_voting").length,
    approved: bmidBoxRequests.filter((request) => request.currentStatus === "approved").length,
    refused: bmidBoxRequests.filter((request) => request.currentStatus === "refused").length,
    removed: bmidBoxRequests.filter((request) => request.currentStatus === "removed").length,
  };
}
