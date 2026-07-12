export type BmidBoxRequestType = "own" | "duality";
export type BmidBoxPlatform = "instagram" | "tiktok" | "youtube" | "facebook" | "x" | "generic";
export type BmidBoxContentType = "video" | "photo" | "image" | "post" | "link";
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
  email?: string | null;
  bmidNumber: string | null;
  verified: boolean;
}

export interface BmidBoxTaggedUserState {
  userId: string;
  name: string;
  action: "pending" | "accepted" | "declined";
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

export interface BmidBoxPreviewData {
  title: string;
  caption: string;
  description: string;
  thumbnailUrl: string;
  embedEnabled: boolean;
  contentType: BmidBoxContentType;
}

export interface BmidBoxSocialPreview {
  platform?: BmidBoxPlatform | string;
  type?: BmidBoxContentType | "image" | string;
  title?: string;
  caption?: string;
  description?: string;
  authorName?: string;
  thumbnailUrl?: string;
  videoUrl?: string | null;
  embedUrl?: string | null;
  canonicalUrl?: string;
  externalUrl?: string;
  status?: "ready" | "unavailable" | "failed" | string;
}

export type BmidBoxFacebookOwnershipStatus =
  | "verified"
  | "failed"
  | "needs_connection";
export type BmidBoxYoutubeOwnershipStatus = BmidBoxFacebookOwnershipStatus;

export interface BmidBoxFacebookOwnershipCheck {
  provider: "facebook";
  method: string;
  status: BmidBoxFacebookOwnershipStatus;
  sourceUrl: string;
  checkedAt: string;
  matchedOwnerId: string | null;
  matchedOwnerName: string | null;
  connectedProfileUrl: string | null;
  reason: string | null;
  message: string | null;
}

export interface BmidBoxYoutubeOwnershipCheck {
  provider: "youtube";
  method: string;
  status: BmidBoxYoutubeOwnershipStatus;
  sourceUrl: string;
  checkedAt: string;
  matchedOwnerId: string | null;
  matchedOwnerName: string | null;
  connectedProfileUrl: string | null;
  reason: string | null;
  message: string | null;
}

export interface BmidBoxVerificationChecks {
  ownerVerified: boolean;
  platformAllowed: boolean;
  urlReachable: boolean;
  duplicateUrl: boolean;
  supportedContentType: boolean;
  facebookOwnership?: BmidBoxFacebookOwnershipCheck | null;
  youtubeOwnership?: BmidBoxYoutubeOwnershipCheck | null;
  manualReviewRequired?: boolean;
}

export interface BmidBoxNotificationEvent {
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
}

export interface BmidBoxRequest {
  id: string;
  ownerUserId: string;
  taggedUserId: string | null;
  ownerSnapshot: BmidBoxIdentitySnapshot;
  taggedSnapshot: BmidBoxIdentitySnapshot | null;
  taggedSnapshots?: BmidBoxIdentitySnapshot[];
  type: BmidBoxRequestType;
  sourcePlatform: BmidBoxPlatform;
  sourceUrl: string;
  previewData: BmidBoxPreviewData;
  socialPreview?: BmidBoxSocialPreview | null;
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
  taggedUsers?: BmidBoxTaggedUserState[];
  taggedUserActionAt: string | null;
  taggedUserActionNote: string | null;
  ownerVerified: boolean;
  taggedUserVerified: boolean | null;
  verificationChecks: BmidBoxVerificationChecks;
  notificationEvents: BmidBoxNotificationEvent[];
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
  supportedContentTypes: BmidBoxContentType[];
}

export const bmidBoxSettings: BmidBoxSettings = {
  allowedPlatforms: ["instagram", "tiktok", "youtube", "facebook", "x", "generic"],
  embedPreviewEnabled: true,
  maxPendingRequestsPerUser: 3,
  duplicateUrlRule: "block_exact_match",
  votingStartTrigger: "after_tagged_user_accept",
  votingDurationDays: 7,
  autoCloseVotingOnExpiry: true,
  minimumVotesRequired: 25,
  adminCanFinalize: true,
  supportedContentTypes: ["video", "photo", "image", "post", "link"],
};
