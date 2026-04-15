// ─── Static mock data for Biome Dashboard ───

export interface User {
  id: string;
  name: string;
  email: string;
  bmidNumber: string | null;
  verified: boolean;
  role: "user" | "moderator" | "admin";
  avatar: string;
  createdAt: string;
}

export interface VerificationRequest {
  id: string;
  userId: string;
  userName: string;
  email: string;
  socialAccount: string;
  platform: string;
  documentUrl: string;
  status: "pending" | "approved" | "rejected" | "removed" | "appealed";
  adminNote: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedBy: string | null;
}

export interface ContentRequest {
  id: string;
  userId: string;
  userName: string;
  bmidNumber: string;
  postTitle: string;
  postPreview: string;
  type: "own";
  status: "pending" | "approved" | "rejected" | "in_review" | "cancelled";
  adminNotes: { note: string; by: string; at: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface BoxRequest {
  id: string;
  userId: string;
  userName: string;
  bmidNumber: string;
  sharedUrl: string;
  platform: "tiktok" | "instagram" | "youtube" | "facebook" | "twitter" | "other";
  contentPreview: string;
  status: "pending" | "approved" | "rejected" | "in_review" | "cancelled";
  adminNotes: { note: string; by: string; at: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface DualityRequest {
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
  createdAt: string;
  updatedAt: string;
}

export interface VotingItem {
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
}

export interface AuditLog {
  id: string;
  requestId: string;
  ownerUser: string;
  taggedUser: string | null;
  requestType: "own" | "duality";
  source: "content" | "box";
  status: string;
  voteAccept: number;
  voteIgnore: number;
  voteRefuse: number;
  adminNote: string | null;
  rejectionReason: string | null;
  approvedBy: string | null;
  statusChangedAt: string;
  taggedUserActedAt: string | null;
  votingOpenedAt: string | null;
  votingClosedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlaggedItem {
  id: string;
  type: "user" | "link" | "voting" | "content";
  description: string;
  severity: "low" | "medium" | "high";
  status: "open" | "reviewed" | "resolved" | "dismissed";
  flaggedAt: string;
  relatedId: string;
}

export interface PostReport {
  id: string;
  reporterId: string;
  reporterName: string;
  postId: string;
  postTitle: string;
  reason: "spam" | "inappropriate" | "harassment" | "copyright" | "other";
  details: string;
  status: "pending" | "reviewed" | "dismissed" | "actioned";
  createdAt: string;
}

export interface BlockedUser {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  blockedBy: string;
  blockedAt: string;
}

export interface Activity {
  id: string;
  type: "verification" | "approval" | "refusal" | "duality" | "removal" | "flag";
  description: string;
  user: string;
  timestamp: string;
}

// ─── Mock Users ───
export const users: User[] = [
  { id: "u1", name: "Alex Morgan", email: "alex@example.com", bmidNumber: "BMID-001", verified: true, role: "user", avatar: "AM", createdAt: "2025-11-15" },
  { id: "u2", name: "Jordan Lee", email: "jordan@example.com", bmidNumber: "BMID-002", verified: true, role: "user", avatar: "JL", createdAt: "2025-12-01" },
  { id: "u3", name: "Casey Kim", email: "casey@example.com", bmidNumber: null, verified: false, role: "user", avatar: "CK", createdAt: "2026-01-10" },
  { id: "u4", name: "Taylor Swift", email: "taylor@example.com", bmidNumber: "BMID-003", verified: true, role: "user", avatar: "TS", createdAt: "2026-01-20" },
  { id: "u5", name: "Riley Johnson", email: "riley@example.com", bmidNumber: null, verified: false, role: "user", avatar: "RJ", createdAt: "2026-02-05" },
  { id: "u6", name: "Sam Parker", email: "sam@example.com", bmidNumber: "BMID-004", verified: true, role: "moderator", avatar: "SP", createdAt: "2025-10-01" },
  { id: "u7", name: "Drew Chen", email: "drew@example.com", bmidNumber: "BMID-005", verified: true, role: "user", avatar: "DC", createdAt: "2026-02-15" },
  { id: "u8", name: "Morgan Blake", email: "morgan@example.com", bmidNumber: null, verified: false, role: "user", avatar: "MB", createdAt: "2026-03-01" },
  { id: "u9", name: "Quinn Davis", email: "quinn@example.com", bmidNumber: "BMID-006", verified: true, role: "user", avatar: "QD", createdAt: "2026-03-10" },
  { id: "u10", name: "Jamie Fox", email: "jamie@example.com", bmidNumber: null, verified: false, role: "user", avatar: "JF", createdAt: "2026-03-20" },
  { id: "u11", name: "Avery Brooks", email: "avery@example.com", bmidNumber: "BMID-007", verified: true, role: "user", avatar: "AB", createdAt: "2026-01-05" },
  { id: "u12", name: "Harper Wilson", email: "harper@example.com", bmidNumber: null, verified: false, role: "user", avatar: "HW", createdAt: "2026-04-01" },
];

// ─── Verification Requests ───
export const verificationRequests: VerificationRequest[] = [
  { id: "vr1", userId: "u3", userName: "Casey Kim", email: "casey@example.com", socialAccount: "@caseykim", platform: "Instagram", documentUrl: "/docs/id-casey.jpg", status: "pending", adminNote: null, rejectionReason: null, createdAt: "2026-03-28", updatedAt: "2026-03-28", reviewedBy: null },
  { id: "vr2", userId: "u5", userName: "Riley Johnson", email: "riley@example.com", socialAccount: "@rileyjohnson", platform: "TikTok", documentUrl: "/docs/id-riley.jpg", status: "pending", adminNote: null, rejectionReason: null, createdAt: "2026-04-01", updatedAt: "2026-04-01", reviewedBy: null },
  { id: "vr3", userId: "u1", userName: "Alex Morgan", email: "alex@example.com", socialAccount: "@alexmorgan", platform: "Instagram", documentUrl: "/docs/id-alex.jpg", status: "approved", adminNote: "Identity confirmed", rejectionReason: null, createdAt: "2025-11-10", updatedAt: "2025-11-15", reviewedBy: "Admin" },
  { id: "vr4", userId: "u8", userName: "Morgan Blake", email: "morgan@example.com", socialAccount: "@morganblake", platform: "YouTube", documentUrl: "/docs/id-morgan.jpg", status: "rejected", adminNote: "Document unclear", rejectionReason: "Submitted ID is not legible", createdAt: "2026-03-15", updatedAt: "2026-03-18", reviewedBy: "Admin" },
  { id: "vr5", userId: "u10", userName: "Jamie Fox", email: "jamie@example.com", socialAccount: "@jamiefox", platform: "Twitter", documentUrl: "/docs/id-jamie.jpg", status: "pending", adminNote: null, rejectionReason: null, createdAt: "2026-04-05", updatedAt: "2026-04-05", reviewedBy: null },
  { id: "vr6", userId: "u12", userName: "Harper Wilson", email: "harper@example.com", socialAccount: "@harperwilson", platform: "Facebook", documentUrl: "/docs/id-harper.jpg", status: "appealed", adminNote: "Re-reviewing after appeal", rejectionReason: "Previous: social account mismatch", createdAt: "2026-04-02", updatedAt: "2026-04-08", reviewedBy: null },
  { id: "vr7", userId: "u8", userName: "Morgan Blake", email: "morgan@example.com", socialAccount: "@morganblake", platform: "YouTube", documentUrl: "/docs/id-morgan2.jpg", status: "pending", adminNote: null, rejectionReason: null, createdAt: "2026-04-10", updatedAt: "2026-04-10", reviewedBy: null },
];

// ─── Content Requests ───
export const contentRequests: ContentRequest[] = [
  { id: "cr1", userId: "u1", userName: "Alex Morgan", bmidNumber: "BMID-001", postTitle: "Morning Routine", postPreview: "A daily morning routine vlog showing healthy habits and productivity tips.", type: "own", status: "approved", adminNotes: [{ note: "Valid original content", by: "Admin", at: "2026-02-15" }], createdAt: "2026-02-10", updatedAt: "2026-02-15" },
  { id: "cr2", userId: "u2", userName: "Jordan Lee", bmidNumber: "BMID-002", postTitle: "Cooking Tutorial", postPreview: "Step-by-step guide to making Korean BBQ at home.", type: "own", status: "pending", adminNotes: [], createdAt: "2026-04-01", updatedAt: "2026-04-01" },
  { id: "cr3", userId: "u4", userName: "Taylor Swift", bmidNumber: "BMID-003", postTitle: "Travel Diary", postPreview: "Exploring hidden gems in Southeast Asia.", type: "own", status: "in_review", adminNotes: [{ note: "Checking content authenticity", by: "Moderator", at: "2026-04-03" }], createdAt: "2026-03-30", updatedAt: "2026-04-03" },
  { id: "cr4", userId: "u7", userName: "Drew Chen", bmidNumber: "BMID-005", postTitle: "Tech Review: AI Tools", postPreview: "Reviewing the latest AI productivity tools for creators.", type: "own", status: "pending", adminNotes: [], createdAt: "2026-04-05", updatedAt: "2026-04-05" },
  { id: "cr5", userId: "u9", userName: "Quinn Davis", bmidNumber: "BMID-006", postTitle: "Fitness Challenge", postPreview: "30-day fitness transformation challenge documentation.", type: "own", status: "rejected", adminNotes: [{ note: "Content does not meet guidelines", by: "Admin", at: "2026-03-25" }], createdAt: "2026-03-20", updatedAt: "2026-03-25" },
  { id: "cr6", userId: "u11", userName: "Avery Brooks", bmidNumber: "BMID-007", postTitle: "Music Production Tips", postPreview: "How to produce beats from scratch using free software.", type: "own", status: "pending", adminNotes: [], createdAt: "2026-04-08", updatedAt: "2026-04-08" },
];

// ─── Box Requests ───
export const boxRequests: BoxRequest[] = [
  { id: "br1", userId: "u1", userName: "Alex Morgan", bmidNumber: "BMID-001", sharedUrl: "https://tiktok.com/@alexmorgan/video/123", platform: "tiktok", contentPreview: "Viral dance challenge with 2M views", status: "approved", adminNotes: [{ note: "Platform verified", by: "Admin", at: "2026-03-01" }], createdAt: "2026-02-25", updatedAt: "2026-03-01" },
  { id: "br2", userId: "u2", userName: "Jordan Lee", bmidNumber: "BMID-002", sharedUrl: "https://instagram.com/p/abc123", platform: "instagram", contentPreview: "Photography showcase - urban landscapes", status: "pending", adminNotes: [], createdAt: "2026-04-02", updatedAt: "2026-04-02" },
  { id: "br3", userId: "u4", userName: "Taylor Swift", bmidNumber: "BMID-003", sharedUrl: "https://youtube.com/watch?v=xyz789", platform: "youtube", contentPreview: "Behind-the-scenes studio session", status: "in_review", adminNotes: [{ note: "Checking external link", by: "Moderator", at: "2026-04-04" }], createdAt: "2026-03-28", updatedAt: "2026-04-04" },
  { id: "br4", userId: "u6", userName: "Sam Parker", bmidNumber: "BMID-004", sharedUrl: "https://facebook.com/samparker/posts/456", platform: "facebook", contentPreview: "Community event recap and highlights", status: "rejected", adminNotes: [{ note: "Platform not supported for this content type", by: "Admin", at: "2026-03-20" }], createdAt: "2026-03-15", updatedAt: "2026-03-20" },
  { id: "br5", userId: "u7", userName: "Drew Chen", bmidNumber: "BMID-005", sharedUrl: "https://tiktok.com/@drewchen/video/789", platform: "tiktok", contentPreview: "Tech unboxing - latest smartphone review", status: "pending", adminNotes: [], createdAt: "2026-04-06", updatedAt: "2026-04-06" },
  { id: "br6", userId: "u9", userName: "Quinn Davis", bmidNumber: "BMID-006", sharedUrl: "https://instagram.com/p/def456", platform: "instagram", contentPreview: "Workout transformation progress photos", status: "pending", adminNotes: [], createdAt: "2026-04-09", updatedAt: "2026-04-09" },
  { id: "br7", userId: "u11", userName: "Avery Brooks", bmidNumber: "BMID-007", sharedUrl: "https://youtube.com/watch?v=music01", platform: "youtube", contentPreview: "Original beat production livestream highlight", status: "approved", adminNotes: [{ note: "Content verified, YouTube link valid", by: "Admin", at: "2026-04-07" }], createdAt: "2026-04-03", updatedAt: "2026-04-07" },
];

// ─── Duality Requests ───
export const dualityRequests: DualityRequest[] = [
  { id: "dr1", ownerId: "u1", ownerName: "Alex Morgan", taggedUserId: "u2", taggedUserName: "Jordan Lee", taggedUserAction: "accepted", status: "approved", source: "content", decisionHistory: [{ action: "Created", by: "Alex Morgan", at: "2026-03-01" }, { action: "Tagged user accepted", by: "Jordan Lee", at: "2026-03-03" }, { action: "Approved", by: "Admin", at: "2026-03-05" }], timeline: [{ event: "Request created", at: "2026-03-01" }, { event: "Tagged user notified", at: "2026-03-01" }, { event: "Tagged user accepted", at: "2026-03-03" }, { event: "Admin approved", at: "2026-03-05" }], createdAt: "2026-03-01", updatedAt: "2026-03-05" },
  { id: "dr2", ownerId: "u4", ownerName: "Taylor Swift", taggedUserId: "u7", taggedUserName: "Drew Chen", taggedUserAction: "pending", status: "waiting_tagged", source: "content", decisionHistory: [{ action: "Created", by: "Taylor Swift", at: "2026-04-02" }], timeline: [{ event: "Request created", at: "2026-04-02" }, { event: "Tagged user notified", at: "2026-04-02" }], createdAt: "2026-04-02", updatedAt: "2026-04-02" },
  { id: "dr3", ownerId: "u2", ownerName: "Jordan Lee", taggedUserId: "u9", taggedUserName: "Quinn Davis", taggedUserAction: "declined", status: "rejected", source: "box", decisionHistory: [{ action: "Created", by: "Jordan Lee", at: "2026-03-20" }, { action: "Tagged user declined", by: "Quinn Davis", at: "2026-03-22" }, { action: "Rejected", by: "System", at: "2026-03-22" }], timeline: [{ event: "Request created", at: "2026-03-20" }, { event: "Tagged user notified", at: "2026-03-20" }, { event: "Tagged user declined", at: "2026-03-22" }, { event: "Auto-rejected", at: "2026-03-22" }], createdAt: "2026-03-20", updatedAt: "2026-03-22" },
  { id: "dr4", ownerId: "u7", ownerName: "Drew Chen", taggedUserId: "u4", taggedUserName: "Taylor Swift", taggedUserAction: "accepted", status: "pending", source: "content", decisionHistory: [{ action: "Created", by: "Drew Chen", at: "2026-04-06" }, { action: "Tagged user accepted", by: "Taylor Swift", at: "2026-04-07" }], timeline: [{ event: "Request created", at: "2026-04-06" }, { event: "Tagged user notified", at: "2026-04-06" }, { event: "Tagged user accepted", at: "2026-04-07" }], createdAt: "2026-04-06", updatedAt: "2026-04-07" },
  { id: "dr5", ownerId: "u11", ownerName: "Avery Brooks", taggedUserId: "u1", taggedUserName: "Alex Morgan", taggedUserAction: "pending", status: "waiting_tagged", source: "box", decisionHistory: [{ action: "Created", by: "Avery Brooks", at: "2026-04-09" }], timeline: [{ event: "Request created", at: "2026-04-09" }, { event: "Tagged user notified", at: "2026-04-09" }], createdAt: "2026-04-09", updatedAt: "2026-04-09" },
];

// ─── Voting Items ───
export const votingItems: VotingItem[] = [
  { id: "v1", requestId: "cr1", requestType: "content", title: "Morning Routine - Alex Morgan", accept: 124, ignore: 12, refuse: 8, status: "finalized", openedAt: "2026-02-15", closedAt: "2026-02-22", outcome: "accepted" },
  { id: "v2", requestId: "br1", requestType: "box", title: "TikTok Dance Challenge - Alex Morgan", accept: 98, ignore: 23, refuse: 15, status: "finalized", openedAt: "2026-03-01", closedAt: "2026-03-08", outcome: "accepted" },
  { id: "v3", requestId: "cr3", requestType: "content", title: "Travel Diary - Taylor Swift", accept: 45, ignore: 8, refuse: 3, status: "open", openedAt: "2026-04-03", closedAt: null, outcome: null },
  { id: "v4", requestId: "br3", requestType: "box", title: "YouTube Studio Session - Taylor Swift", accept: 32, ignore: 15, refuse: 7, status: "open", openedAt: "2026-04-04", closedAt: null, outcome: null },
  { id: "v5", requestId: "cr5", requestType: "content", title: "Fitness Challenge - Quinn Davis", accept: 18, ignore: 5, refuse: 67, status: "finalized", openedAt: "2026-03-25", closedAt: "2026-04-01", outcome: "refused" },
  { id: "v6", requestId: "br7", requestType: "box", title: "Beat Production - Avery Brooks", accept: 56, ignore: 10, refuse: 4, status: "open", openedAt: "2026-04-07", closedAt: null, outcome: null },
];

// ─── Audit Logs ───
export const auditLogs: AuditLog[] = [
  { id: "al1", requestId: "cr1", ownerUser: "Alex Morgan", taggedUser: null, requestType: "own", source: "content", status: "approved", voteAccept: 124, voteIgnore: 12, voteRefuse: 8, adminNote: "Valid original content", rejectionReason: null, approvedBy: "Admin", statusChangedAt: "2026-02-15", taggedUserActedAt: null, votingOpenedAt: "2026-02-15", votingClosedAt: "2026-02-22", createdAt: "2026-02-10", updatedAt: "2026-02-22" },
  { id: "al2", requestId: "br1", ownerUser: "Alex Morgan", taggedUser: null, requestType: "own", source: "box", status: "approved", voteAccept: 98, voteIgnore: 23, voteRefuse: 15, adminNote: "Platform verified", rejectionReason: null, approvedBy: "Admin", statusChangedAt: "2026-03-01", taggedUserActedAt: null, votingOpenedAt: "2026-03-01", votingClosedAt: "2026-03-08", createdAt: "2026-02-25", updatedAt: "2026-03-08" },
  { id: "al3", requestId: "dr1", ownerUser: "Alex Morgan", taggedUser: "Jordan Lee", requestType: "duality", source: "content", status: "approved", voteAccept: 0, voteIgnore: 0, voteRefuse: 0, adminNote: null, rejectionReason: null, approvedBy: "Admin", statusChangedAt: "2026-03-05", taggedUserActedAt: "2026-03-03", votingOpenedAt: null, votingClosedAt: null, createdAt: "2026-03-01", updatedAt: "2026-03-05" },
  { id: "al4", requestId: "cr5", ownerUser: "Quinn Davis", taggedUser: null, requestType: "own", source: "content", status: "rejected", voteAccept: 18, voteIgnore: 5, voteRefuse: 67, adminNote: "Content does not meet guidelines", rejectionReason: "Community voted to refuse", approvedBy: null, statusChangedAt: "2026-03-25", taggedUserActedAt: null, votingOpenedAt: "2026-03-25", votingClosedAt: "2026-04-01", createdAt: "2026-03-20", updatedAt: "2026-04-01" },
  { id: "al5", requestId: "dr3", ownerUser: "Jordan Lee", taggedUser: "Quinn Davis", requestType: "duality", source: "box", status: "rejected", voteAccept: 0, voteIgnore: 0, voteRefuse: 0, adminNote: null, rejectionReason: "Tagged user declined", approvedBy: null, statusChangedAt: "2026-03-22", taggedUserActedAt: "2026-03-22", votingOpenedAt: null, votingClosedAt: null, createdAt: "2026-03-20", updatedAt: "2026-03-22" },
  { id: "al6", requestId: "br4", ownerUser: "Sam Parker", taggedUser: null, requestType: "own", source: "box", status: "rejected", voteAccept: 0, voteIgnore: 0, voteRefuse: 0, adminNote: "Platform not supported for this content type", rejectionReason: "Unsupported platform", approvedBy: null, statusChangedAt: "2026-03-20", taggedUserActedAt: null, votingOpenedAt: null, votingClosedAt: null, createdAt: "2026-03-15", updatedAt: "2026-03-20" },
  { id: "al7", requestId: "vr3", ownerUser: "Alex Morgan", taggedUser: null, requestType: "own", source: "content", status: "approved", voteAccept: 0, voteIgnore: 0, voteRefuse: 0, adminNote: "Identity confirmed", rejectionReason: null, approvedBy: "Admin", statusChangedAt: "2025-11-15", taggedUserActedAt: null, votingOpenedAt: null, votingClosedAt: null, createdAt: "2025-11-10", updatedAt: "2025-11-15" },
  { id: "al8", requestId: "vr4", ownerUser: "Morgan Blake", taggedUser: null, requestType: "own", source: "content", status: "rejected", voteAccept: 0, voteIgnore: 0, voteRefuse: 0, adminNote: "Document unclear", rejectionReason: "Submitted ID is not legible", approvedBy: null, statusChangedAt: "2026-03-18", taggedUserActedAt: null, votingOpenedAt: null, votingClosedAt: null, createdAt: "2026-03-15", updatedAt: "2026-03-18" },
];

// ─── Flagged Items ───
export const flaggedItems: FlaggedItem[] = [
  { id: "f1", type: "user", description: "Multiple failed verification attempts from same IP", severity: "high", status: "open", flaggedAt: "2026-04-10", relatedId: "u8" },
  { id: "f2", type: "link", description: "Suspicious external link in Box request - potential phishing", severity: "high", status: "open", flaggedAt: "2026-04-09", relatedId: "br5" },
  { id: "f3", type: "voting", description: "Unusual voting pattern - 50 votes in 2 minutes", severity: "medium", status: "reviewed", flaggedAt: "2026-04-07", relatedId: "v3" },
  { id: "f4", type: "user", description: "User created multiple accounts with similar emails", severity: "medium", status: "open", flaggedAt: "2026-04-06", relatedId: "u10" },
  { id: "f5", type: "link", description: "Broken external link in approved Box request", severity: "low", status: "resolved", flaggedAt: "2026-03-30", relatedId: "br1" },
  { id: "f6", type: "voting", description: "Bot-like voting behavior detected on content request", severity: "high", status: "open", flaggedAt: "2026-04-11", relatedId: "v6" },
];

// ─── Post Reports ───
export const postReports: PostReport[] = [
  { id: "pr1", reporterId: "u2", reporterName: "Jordan Lee", postId: "cr1", postTitle: "Morning Routine", reason: "copyright", details: "This content is stolen from my YouTube channel.", status: "pending", createdAt: "2026-04-10" },
  { id: "pr2", reporterId: "u4", reporterName: "Taylor Swift", postId: "br1", postTitle: "TikTok Dance Challenge", reason: "spam", details: "Repeatedly posting the same link in multiple requests.", status: "reviewed", createdAt: "2026-04-08" },
  { id: "pr3", reporterId: "u7", reporterName: "Drew Chen", postId: "cr4", postTitle: "Tech Review: AI Tools", reason: "inappropriate", details: "Contains misleading information about AI safety.", status: "dismissed", createdAt: "2026-04-05" },
  { id: "pr4", reporterId: "u1", reporterName: "Alex Morgan", postId: "br7", postTitle: "Beat Production", reason: "harassment", details: "Background music contains offensive lyrics targeted at a specific group.", status: "actioned", createdAt: "2026-04-11" },
];

// ─── Blocked Users ───
export const blockedUsers: BlockedUser[] = [
  { id: "b1", userId: "u8", userName: "Morgan Blake", reason: "Multiple fraudulent verification attempts", blockedBy: "Admin", blockedAt: "2026-04-10" },
  { id: "b2", userId: "u10", userName: "Jamie Fox", reason: "Bot activity detected during voting", blockedBy: "System", blockedAt: "2026-04-11" },
];

// ─── Recent Activity ───
export const recentActivities: Activity[] = [
  { id: "a1", type: "verification", description: "New verification request from Harper Wilson", user: "Harper Wilson", timestamp: "2026-04-12T08:30:00" },
  { id: "a2", type: "flag", description: "Bot-like voting behavior detected", user: "System", timestamp: "2026-04-11T22:15:00" },
  { id: "a3", type: "verification", description: "New verification request from Morgan Blake (reapply)", user: "Morgan Blake", timestamp: "2026-04-10T14:20:00" },
  { id: "a4", type: "duality", description: "New duality request: Avery Brooks tagged Alex Morgan", user: "Avery Brooks", timestamp: "2026-04-09T11:00:00" },
  { id: "a5", type: "approval", description: "Box request approved: Beat Production by Avery Brooks", user: "Admin", timestamp: "2026-04-07T16:45:00" },
  { id: "a6", type: "duality", description: "Drew Chen tagged Taylor Swift in content request", user: "Drew Chen", timestamp: "2026-04-06T09:30:00" },
  { id: "a7", type: "refusal", description: "Fitness Challenge by Quinn Davis was refused by community vote", user: "System", timestamp: "2026-04-01T00:00:00" },
  { id: "a8", type: "verification", description: "Verification request rejected: Morgan Blake", user: "Admin", timestamp: "2026-03-18T10:00:00" },
  { id: "a9", type: "approval", description: "Duality request approved: Alex Morgan & Jordan Lee", user: "Admin", timestamp: "2026-03-05T15:30:00" },
  { id: "a10", type: "removal", description: "BMID removed from flagged user account", user: "Super Admin", timestamp: "2026-03-01T08:00:00" },
];

// ─── Chart Data ───
export const requestVolumeData = [
  { date: "Jan", verification: 12, content: 8, box: 5, duality: 3 },
  { date: "Feb", verification: 18, content: 14, box: 9, duality: 6 },
  { date: "Mar", verification: 25, content: 20, box: 15, duality: 10 },
  { date: "Apr", verification: 15, content: 12, box: 11, duality: 8 },
];

export const statusBreakdownData = [
  { name: "Pending", value: 14, color: "#f59e0b" },
  { name: "Approved", value: 22, color: "#10b981" },
  { name: "Refused", value: 8, color: "#ef4444" },
  { name: "Removed", value: 2, color: "#6b7280" },
  { name: "Cancelled", value: 1, color: "#8b5cf6" },
];

export const approvalTrendData = [
  { date: "Week 1", approved: 5, refused: 2, pending: 8 },
  { date: "Week 2", approved: 8, refused: 3, pending: 12 },
  { date: "Week 3", approved: 12, refused: 4, pending: 10 },
  { date: "Week 4", approved: 10, refused: 5, pending: 6 },
  { date: "Week 5", approved: 14, refused: 2, pending: 9 },
  { date: "Week 6", approved: 9, refused: 6, pending: 11 },
  { date: "Week 7", approved: 16, refused: 3, pending: 7 },
  { date: "Week 8", approved: 11, refused: 4, pending: 8 },
];

export const votingDistributionData = [
  { name: "Accept", value: 373, color: "#10b981" },
  { name: "Ignore", value: 73, color: "#f59e0b" },
  { name: "Refuse", value: 104, color: "#ef4444" },
];

export const sourceBreakdownData = [
  { name: "BMID Content", value: 6 },
  { name: "BMID Box", value: 7 },
  { name: "Own", value: 10 },
  { name: "Duality", value: 5 },
];

export const platformBreakdownData = [
  { name: "TikTok", value: 3 },
  { name: "Instagram", value: 2 },
  { name: "YouTube", value: 2 },
  { name: "Facebook", value: 1 },
  { name: "Twitter", value: 1 },
];

// ─── Dashboard KPI Stats ───
export const dashboardStats = {
  totalUsers: 12,
  totalVerifiedUsers: 7,
  pendingVerifications: 4,
  totalContentRequests: 6,
  totalBoxRequests: 7,
  pendingDuality: 2,
  approvedRequests: 22,
  refusedRequests: 8,
};
