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
    currentStatus: "pending_voting",
    votingStatus: "open",
    acceptCount: 41,
    ignoreCount: 6,
    refuseCount: 4,
    adminNotes: ["URL matched owner profile", "Ready for voting after media validation"],
    rejectionReason: null,
    removalReason: null,
    createdAt: "2026-04-11T09:12:00Z",
    updatedAt: "2026-04-15T16:30:00Z",
    submittedAt: "2026-04-11T09:12:00Z",
    reviewedAt: "2026-04-12T10:25:00Z",
    votingStartAt: "2026-04-13T08:00:00Z",
    votingEndAt: "2026-04-20T08:00:00Z",
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
      { id: "n2", type: "request_moved_to_voting", sentAt: "2026-04-13T08:01:00Z", recipient: "Alex Morgan" },
    ],
    history: history("box-2401", [
      ["submitted", "u1", "Alex Morgan", "Submitted Instagram reel into Box", "2026-04-11T09:12:00Z"],
      ["reviewed", "u6", "Sam Parker", "Verified owner and source URL", "2026-04-12T10:25:00Z"],
      ["voting_opened", "u6", "Sam Parker", "Moved to community voting", "2026-04-13T08:00:00Z"],
    ]),
  },
  {
    id: "box-2402",
    ownerUserId: "u2",
    taggedUserId: "u4",
    ownerSnapshot: identitySnapshot("u2")!,
    taggedSnapshot: identitySnapshot("u4"),
    type: "duality",
    sourcePlatform: "youtube",
    sourceUrl: "https://youtube.com/watch?v=duality2402",
    previewData: {
      title: "Live duet performance",
      caption: "Jordan tagged Taylor for a verified Duality submission.",
      description: "Clip from a live collaboration that needs tagged-user confirmation.",
      thumbnailUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80",
      embedEnabled: true,
      contentType: "video",
    },
    currentStatus: "pending_tagged_user",
    votingStatus: null,
    acceptCount: 0,
    ignoreCount: 0,
    refuseCount: 0,
    adminNotes: ["Duality requires tagged-user action before voting"],
    rejectionReason: null,
    removalReason: null,
    createdAt: "2026-04-14T13:05:00Z",
    updatedAt: "2026-04-16T11:10:00Z",
    submittedAt: "2026-04-14T13:05:00Z",
    reviewedAt: "2026-04-15T09:45:00Z",
    votingStartAt: null,
    votingEndAt: null,
    finalizedAt: null,
    taggedUserAction: "pending",
    taggedUserActionAt: null,
    taggedUserActionNote: null,
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
      { id: "n4", type: "duality_tagged", sentAt: "2026-04-15T09:46:00Z", recipient: "Taylor Swift" },
    ],
    history: history("box-2402", [
      ["submitted", "u2", "Jordan Lee", "Submitted YouTube collaboration clip", "2026-04-14T13:05:00Z"],
      ["reviewed", "u6", "Sam Parker", "Validated video and tagged user identity", "2026-04-15T09:45:00Z"],
      ["status_changed", "u6", "Sam Parker", "Moved to tagged-user stage", "2026-04-15T09:46:00Z"],
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
    adminNotes: ["Potential duplicate against an earlier creator upload"],
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
      ["note_added", "u6", "Sam Parker", "Duplicate URL warning flagged for review", "2026-04-17T09:00:00Z"],
    ]),
  },
  {
    id: "box-2404",
    ownerUserId: "u11",
    taggedUserId: "u9",
    ownerSnapshot: identitySnapshot("u11")!,
    taggedSnapshot: identitySnapshot("u9"),
    type: "duality",
    sourcePlatform: "facebook",
    sourceUrl: "https://facebook.com/reel/2404",
    previewData: {
      title: "Panel recap post",
      caption: "Avery tagged Quinn in a cross-posted event recap.",
      description: "Tagged user refused participation after admin review.",
      thumbnailUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80",
      embedEnabled: false,
      contentType: "post",
    },
    currentStatus: "refused",
    votingStatus: null,
    acceptCount: 0,
    ignoreCount: 0,
    refuseCount: 0,
    adminNotes: ["Tagged user declined participation"],
    rejectionReason: "Tagged user refused Duality participation",
    removalReason: null,
    createdAt: "2026-04-07T10:00:00Z",
    updatedAt: "2026-04-09T15:12:00Z",
    submittedAt: "2026-04-07T10:00:00Z",
    reviewedAt: "2026-04-08T12:00:00Z",
    votingStartAt: null,
    votingEndAt: null,
    finalizedAt: "2026-04-09T15:12:00Z",
    taggedUserAction: "refused",
    taggedUserActionAt: "2026-04-09T15:00:00Z",
    taggedUserActionNote: "Not my official collaboration asset",
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
      { id: "n6", type: "duality_tagged", sentAt: "2026-04-08T12:01:00Z", recipient: "Quinn Davis" },
      { id: "n7", type: "request_refused", sentAt: "2026-04-09T15:13:00Z", recipient: "Avery Brooks" },
    ],
    history: history("box-2404", [
      ["submitted", "u11", "Avery Brooks", "Submitted Facebook post for Duality", "2026-04-07T10:00:00Z"],
      ["reviewed", "u6", "Sam Parker", "Validated both verified identities", "2026-04-08T12:00:00Z"],
      ["tagged_user_action", "u9", "Quinn Davis", "Refused participation", "2026-04-09T15:00:00Z"],
      ["finalized", "u6", "Sam Parker", "Marked request refused", "2026-04-09T15:12:00Z"],
    ]),
  },
  {
    id: "box-2405",
    ownerUserId: "u3",
    taggedUserId: "u3",
    ownerSnapshot: identitySnapshot("u3")!,
    taggedSnapshot: identitySnapshot("u3"),
    type: "own",
    sourcePlatform: "instagram",
    sourceUrl: "https://instagram.com/p/unverified-2405",
    previewData: {
      title: "Street portrait set",
      caption: "Submission from a non-verified user.",
      description: "Fails BMID owner verification check.",
      thumbnailUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
      embedEnabled: true,
      contentType: "photo",
    },
    currentStatus: "submitted",
    votingStatus: null,
    acceptCount: 0,
    ignoreCount: 0,
    refuseCount: 0,
    adminNotes: ["Owner is not BMID verified yet"],
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
    ownerVerified: false,
    taggedUserVerified: false,
    verificationChecks: {
      ownerVerified: false,
      platformAllowed: true,
      urlReachable: true,
      duplicateUrl: false,
      supportedContentType: true,
    },
    notificationEvents: [
      { id: "n8", type: "box_request_submitted", sentAt: "2026-04-18T06:41:00Z", recipient: "Casey Kim" },
    ],
    history: history("box-2405", [
      ["submitted", "u3", "Casey Kim", "Submitted Instagram photo set into Box", "2026-04-18T06:40:00Z"],
    ]),
  },
  {
    id: "box-2406",
    ownerUserId: "u4",
    taggedUserId: "u2",
    ownerSnapshot: identitySnapshot("u4")!,
    taggedSnapshot: identitySnapshot("u2"),
    type: "duality",
    sourcePlatform: "youtube",
    sourceUrl: "https://youtube.com/watch?v=duality2406",
    previewData: {
      title: "Studio collaboration session",
      caption: "Voting closed and ready for admin finalization.",
      description: "Community voting completed with clear majority accept.",
      thumbnailUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80",
      embedEnabled: true,
      contentType: "video",
    },
    currentStatus: "pending_voting",
    votingStatus: "closed",
    acceptCount: 58,
    ignoreCount: 12,
    refuseCount: 9,
    adminNotes: ["Voting closed automatically on expiry", "Awaiting final manual decision"],
    rejectionReason: null,
    removalReason: null,
    createdAt: "2026-04-03T11:00:00Z",
    updatedAt: "2026-04-19T08:00:00Z",
    submittedAt: "2026-04-03T11:00:00Z",
    reviewedAt: "2026-04-04T10:00:00Z",
    votingStartAt: "2026-04-10T08:00:00Z",
    votingEndAt: "2026-04-17T08:00:00Z",
    finalizedAt: null,
    taggedUserAction: "accepted",
    taggedUserActionAt: "2026-04-05T07:30:00Z",
    taggedUserActionNote: "Approved this collaboration submission",
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
      { id: "n9", type: "duality_tagged", sentAt: "2026-04-04T10:01:00Z", recipient: "Jordan Lee" },
      { id: "n10", type: "request_moved_to_voting", sentAt: "2026-04-10T08:01:00Z", recipient: "Taylor Swift" },
    ],
    history: history("box-2406", [
      ["submitted", "u4", "Taylor Swift", "Submitted YouTube collaboration clip", "2026-04-03T11:00:00Z"],
      ["reviewed", "u6", "Sam Parker", "Validated URLs and both verified identities", "2026-04-04T10:00:00Z"],
      ["tagged_user_action", "u2", "Jordan Lee", "Accepted participation", "2026-04-05T07:30:00Z"],
      ["voting_opened", "u6", "Sam Parker", "Opened voting", "2026-04-10T08:00:00Z"],
      ["voting_closed", "system", "System", "Auto-closed on expiry", "2026-04-17T08:00:00Z"],
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
      caption: "Item removed after rights dispute.",
      description: "Admin removed the entry from Box after external complaint.",
      thumbnailUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80",
      embedEnabled: false,
      contentType: "video",
    },
    currentStatus: "removed",
    votingStatus: "finalized",
    acceptCount: 23,
    ignoreCount: 4,
    refuseCount: 17,
    adminNotes: ["Removed after rights dispute escalation"],
    rejectionReason: null,
    removalReason: "External rights complaint upheld by admin",
    createdAt: "2026-03-29T08:30:00Z",
    updatedAt: "2026-04-06T14:20:00Z",
    submittedAt: "2026-03-29T08:30:00Z",
    reviewedAt: "2026-03-30T11:00:00Z",
    votingStartAt: "2026-04-01T08:00:00Z",
    votingEndAt: "2026-04-05T08:00:00Z",
    finalizedAt: "2026-04-06T14:20:00Z",
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
    notificationEvents: [
      { id: "n11", type: "request_removed", sentAt: "2026-04-06T14:21:00Z", recipient: "Quinn Davis" },
    ],
    history: history("box-2407", [
      ["submitted", "u9", "Quinn Davis", "Submitted Facebook reel", "2026-03-29T08:30:00Z"],
      ["reviewed", "u6", "Sam Parker", "Validated reel metadata", "2026-03-30T11:00:00Z"],
      ["voting_opened", "u6", "Sam Parker", "Opened voting", "2026-04-01T08:00:00Z"],
      ["removed", "u6", "Sam Parker", "Removed item after rights complaint", "2026-04-06T14:20:00Z"],
    ]),
  },
];

export const bmidBoxVotes: BmidBoxVote[] = [
  { id: "vote-1", requestId: "box-2401", voterUserId: "u2", voterName: "Jordan Lee", voteType: "accept", createdAt: "2026-04-13T10:00:00Z" },
  { id: "vote-2", requestId: "box-2401", voterUserId: "u4", voterName: "Taylor Swift", voteType: "accept", createdAt: "2026-04-13T10:10:00Z" },
  { id: "vote-3", requestId: "box-2401", voterUserId: "u7", voterName: "Drew Chen", voteType: "ignore", createdAt: "2026-04-13T10:13:00Z" },
  { id: "vote-4", requestId: "box-2406", voterUserId: "u1", voterName: "Alex Morgan", voteType: "accept", createdAt: "2026-04-10T11:30:00Z" },
  { id: "vote-5", requestId: "box-2406", voterUserId: "u11", voterName: "Avery Brooks", voteType: "refuse", createdAt: "2026-04-11T08:40:00Z" },
];

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
