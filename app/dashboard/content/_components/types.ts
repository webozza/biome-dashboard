export type ContentDoc = {
  id: string;
  userId: string;
  userName: string;
  bmidNumber: string;
  postTitle: string;
  postPreview: string;
  postImageUrl?: string | null;
  type: "own" | "duality";
  status: "pending" | "approved" | "rejected" | "in_review" | "cancelled" | "waiting_tagged";
  adminNotes: { note: string; by: string; at: string }[];
  createdAt: string;
  updatedAt: string;
  taggedUserId?: string | null;
  taggedUserName?: string | null;
  taggedUserAction?: "pending" | "accepted" | "declined" | null;
  voteAccept?: number;
  voteIgnore?: number;
  voteRefuse?: number;
  votingStatus?: "open" | "closed" | "finalized" | null;
  votingOutcome?: "accepted" | "refused" | "ignored" | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  postId?: string | null;
};

export type ListResponse = { items: ContentDoc[]; nextCursor: string | null };

export type UserPostOption = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  createdAt: unknown;
};
