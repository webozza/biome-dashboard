import { db } from "../firebase";
import { pickFirstImage, pickVideoThumbnail } from "./media-pickers";

type AnyRecord = Record<string, unknown>;

export type PublicSocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "twitter";

export interface PublicProfileSocial {
  platform: PublicSocialPlatform;
  label: string;
  url: string;
  accountName?: string;
  accountHandle?: string;
  imageUrl?: string;
}

export interface PublicPortfolioItem {
  id: string;
  kind: "post" | "vibe" | "content" | "box";
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string;
  href: string;
  createdAt: string | null;
  viewCount?: number;
  likesCount?: number;
  commentsCount?: number;
}

export interface ResolvedPublicBmidProfile {
  uid: string;
  displayName: string;
  username: string;
  photoUrl: string;
  bio: string;
  tags: string[];
  postsCount: number;
  followersCount: number;
  followingCount: number;
  bmidNumber: string;
  bmidVerifiedAt: string | null;
  socials: PublicProfileSocial[];
  portfolio: PublicPortfolioItem[];
  bmidContent: PublicPortfolioItem[];
  bmidBox: PublicPortfolioItem[];
}

export type PublicBmidUnavailableReason =
  | "not-found"
  | "verification-inactive"
  | "profile-inactive";

export interface PublicBmidProfileResolution {
  profile: ResolvedPublicBmidProfile | null;
  unavailableReason: PublicBmidUnavailableReason | null;
}

const SOCIALS: Array<{
  platform: PublicSocialPlatform;
  label: string;
  hosts: string[];
  fromHandle: (handle: string) => string;
}> = [
  {
    platform: "instagram",
    label: "Instagram",
    hosts: ["instagram.com"],
    fromHandle: (handle) => `https://www.instagram.com/${handle}`,
  },
  {
    platform: "tiktok",
    label: "TikTok",
    hosts: ["tiktok.com"],
    fromHandle: (handle) => `https://www.tiktok.com/@${handle}`,
  },
  {
    platform: "youtube",
    label: "YouTube",
    hosts: ["youtube.com", "youtu.be"],
    fromHandle: (handle) => `https://www.youtube.com/${handle}`,
  },
  {
    platform: "facebook",
    label: "Facebook",
    hosts: ["facebook.com", "fb.com"],
    fromHandle: (handle) => `https://www.facebook.com/${handle}`,
  },
  {
    platform: "twitter",
    label: "X",
    hosts: ["x.com", "twitter.com"],
    fromHandle: (handle) => `https://x.com/${handle}`,
  },
];

function cleanText(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function normalizeBmidIdentifier(value: unknown): string {
  const identifier = cleanText(value, 64).toUpperCase();
  return /^[A-Z0-9-]+$/.test(identifier) ? identifier : "";
}

export function isPublicBmidUser(data: AnyRecord): boolean {
  const status = cleanText(data.bmidStatus, 40).toLowerCase();
  return (
    data.verified === true &&
    Boolean(normalizeBmidIdentifier(data.bmidNumber)) &&
    status !== "cancelled" &&
    status !== "removed" &&
    data.disabled !== true &&
    data.isDeleted !== true &&
    data.isDeactivated !== true
  );
}

function safeHttpUrl(value: unknown, allowedHosts?: string[]): string {
  const raw = cleanText(value, 2_000);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (allowedHosts?.length) {
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      if (!allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
        return "";
      }
    }
    return url.toString();
  } catch {
    return "";
  }
}

function socialUrl(
  value: unknown,
  platform: (typeof SOCIALS)[number]
): string {
  const raw = cleanText(value, 500);
  if (!raw) return "";
  const direct = safeHttpUrl(raw, platform.hosts);
  if (direct) return direct;
  const handle = raw
    .replace(/^@+/, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9._@-]/g, "")
    .slice(0, 100);
  return handle ? platform.fromHandle(handle) : "";
}

function handleFromUrl(value: string): string {
  try {
    const url = new URL(value);
    const path = url.pathname.split("/").filter(Boolean)[0] || "";
    return path.replace(/^@+/, "").slice(0, 100);
  } catch {
    return "";
  }
}

function publicSocials(user: AnyRecord): PublicProfileSocial[] {
  const socials =
    user.socials && typeof user.socials === "object"
      ? (user.socials as AnyRecord)
      : {};
  const connections =
    user.socialConnections && typeof user.socialConnections === "object"
      ? (user.socialConnections as AnyRecord)
      : {};

  return SOCIALS.flatMap((platform) => {
    const connection =
      connections[platform.platform] && typeof connections[platform.platform] === "object"
        ? (connections[platform.platform] as AnyRecord)
        : {};
    const connectedUrl =
      cleanText(connection.status, 40).toLowerCase() === "connected"
        ? connection.profileUrl
        : null;
    const url =
      socialUrl(socials[platform.platform], platform) ||
      socialUrl(connectedUrl, platform);
    const connectionDisplayName = cleanText(
      connection.displayName || connection.title || connection.name,
      100
    );
    const connectionHandle = cleanText(
      connection.username || connection.handle || handleFromUrl(url),
      100
    ).replace(/^@+/, "");
    const imageUrl = safeHttpUrl(
      connection.avatarUrl || connection.thumbnailUrl || connection.photoUrl
    );
    return url
      ? [{
        platform: platform.platform,
        label: platform.label,
        url,
        accountName: connectionDisplayName || connectionHandle || undefined,
        accountHandle: connectionHandle || undefined,
        imageUrl: imageUrl || undefined,
      }]
      : [];
  });
}

function timestampMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    const record = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof record.toDate === "function") return record.toDate().getTime();
    const seconds = record.seconds ?? record._seconds;
    if (typeof seconds === "number") return seconds * 1_000;
  }
  return null;
}

function isoTimestamp(value: unknown): string | null {
  const millis = timestampMillis(value);
  if (millis === null || !Number.isFinite(millis)) return null;
  return new Date(millis).toISOString();
}

function portfolioDate(value: unknown): string | null {
  return isoTimestamp(value);
}

function portfolioSortValue(item: PublicPortfolioItem): number {
  return item.createdAt ? Date.parse(item.createdAt) || 0 : 0;
}

function publicCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function maybePublicCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
}

async function countUserSubcollection(
  uid: string,
  name: "posts" | "followers" | "following"
): Promise<number> {
  const snap = await db().collection("users").doc(uid).collection(name).get();
  return snap.size;
}

async function loadPublicProfileStats(
  uid: string,
  user: AnyRecord
): Promise<Pick<ResolvedPublicBmidProfile, "postsCount" | "followersCount" | "followingCount">> {
  const directPosts = maybePublicCount(user.postsCount ?? user.postCount ?? user.totalPosts);
  const directFollowers = maybePublicCount(
    user.followersCount ?? user.followerCount ?? user.totalFollowers
  );
  const directFollowing = maybePublicCount(
    user.followingCount ?? user.following ?? user.totalFollowing
  );

  const [countedPosts, countedFollowers, countedFollowing] = await Promise.all([
    countUserSubcollection(uid, "posts"),
    countUserSubcollection(uid, "followers"),
    countUserSubcollection(uid, "following"),
  ]);

  return {
    postsCount: publicCount(Math.max(directPosts ?? 0, countedPosts)),
    followersCount: publicCount(Math.max(directFollowers ?? 0, countedFollowers)),
    followingCount: publicCount(Math.max(directFollowing ?? 0, countedFollowing)),
  };
}

async function loadPostEngagement(
  authorId: string,
  postId: string,
  fallback: AnyRecord
): Promise<Pick<PublicPortfolioItem, "viewCount" | "likesCount" | "commentsCount">> {
  let post: AnyRecord = {};
  if (authorId && postId) {
    const postDoc = await db()
      .collection("users")
      .doc(authorId)
      .collection("posts")
      .doc(postId)
      .get();
    post = postDoc.exists ? (postDoc.data() as AnyRecord) : {};
  }

  return {
    viewCount: publicCount(
      fallback.viewCount ?? fallback.viewsCount ?? fallback.views ??
      post.viewCount ?? post.viewsCount ?? post.views
    ),
    likesCount: publicCount(
      fallback.likesCount ?? fallback.likeCount ?? fallback.likes ??
      post.likesCount ?? post.likeCount ?? post.likes
    ),
    commentsCount: publicCount(
      fallback.commentsCount ?? fallback.commentCount ?? fallback.comments ??
      post.commentsCount ?? post.commentCount ?? post.comments
    ),
  };
}

async function loadHighlightedPosts(uid: string): Promise<PublicPortfolioItem[]> {
  const snap = await db()
    .collection("users")
    .doc(uid)
    .collection("posts")
    .where("isHighlighted", "==", true)
    .limit(12)
    .get();

  return snap.docs
    .flatMap((doc): PublicPortfolioItem[] => {
      const data = doc.data() as AnyRecord;
      if (data.public === false) return [];
      const imageUrl = safeHttpUrl(pickFirstImage(data) || pickVideoThumbnail(data));
      const description = cleanText(data.caption || data.description, 280);
      return [{
        id: `post-${doc.id}`,
        kind: "post" as const,
        eyebrow: "Featured post",
        title: description ? description.slice(0, 90) : "Featured creator work",
        description,
        imageUrl,
        href: `/p/${encodeURIComponent(uid)}/${encodeURIComponent(doc.id)}`,
        createdAt: portfolioDate(data.highlightedAt || data.createdAt),
        viewCount: publicCount(data.viewCount ?? data.viewsCount ?? data.views),
        likesCount: publicCount(data.likesCount ?? data.likeCount ?? data.likes),
        commentsCount: publicCount(data.commentsCount ?? data.commentCount ?? data.comments),
      }];
    });
}

async function loadHighlightedVibes(uid: string): Promise<PublicPortfolioItem[]> {
  const snap = await db()
    .collection("users")
    .doc(uid)
    .collection("reels")
    .where("isHighlighted", "==", true)
    .limit(12)
    .get();

  return snap.docs.flatMap((doc): PublicPortfolioItem[] => {
    const data = doc.data() as AnyRecord;
    if (data.public === false) return [];
    const imageUrl = safeHttpUrl(pickVideoThumbnail(data) || pickFirstImage(data));
    const description = cleanText(data.caption || data.description, 280);
    return [{
      id: `vibe-${doc.id}`,
      kind: "vibe" as const,
      eyebrow: "Featured vibe",
      title: description ? description.slice(0, 90) : "Featured creator vibe",
      description,
      imageUrl,
      href: `/r/${encodeURIComponent(uid)}/${encodeURIComponent(doc.id)}`,
      createdAt: portfolioDate(data.highlightedAt || data.createdAt),
      viewCount: publicCount(data.viewCount ?? data.viewsCount ?? data.views),
      likesCount: publicCount(data.likesCount ?? data.likeCount ?? data.likes),
      commentsCount: publicCount(data.commentsCount ?? data.commentCount ?? data.comments),
    }];
  });
}

function isVisibleContent(data: AnyRecord): boolean {
  const status = cleanText(data.status, 50).toLowerCase();
  const votingStatus = cleanText(data.votingStatus, 50).toLowerCase();
  return status === "approved" || votingStatus === "open" || votingStatus === "finalized";
}

async function loadApprovedContent(uid: string): Promise<PublicPortfolioItem[]> {
  const snap = await db()
    .collection("contentRequests")
    .where("userId", "==", uid)
    .limit(50)
    .get();

  const items = await Promise.all(snap.docs.map(async (doc): Promise<PublicPortfolioItem | null> => {
    const data = doc.data() as AnyRecord;
    if (!isVisibleContent(data)) return null;
    const postId = cleanText(data.postId || data.publishedPostId, 200);
    const authorId = cleanText(data.userId || data.authorId, 200) || uid;
    const title = cleanText(data.postTitle || data.title, 120) || "Verified creator content";
    const description = cleanText(data.postPreview || data.description, 280);
    const imageUrl = safeHttpUrl(
      data.postImageUrl || pickFirstImage(data) || pickVideoThumbnail(data)
    );
    const engagement = await loadPostEngagement(authorId, postId, data);
    return {
      id: `content-${doc.id}`,
      kind: "content" as const,
      eyebrow: "BMID Content",
      title,
      description,
      imageUrl,
      href: postId
        ? `/p/${encodeURIComponent(authorId)}/${encodeURIComponent(postId)}`
        : "",
      createdAt: portfolioDate(data.createdAt),
      ...engagement,
    };
  }));

  return items.filter((item): item is PublicPortfolioItem => Boolean(item));
}

function isVisibleBox(data: AnyRecord): boolean {
  const status = cleanText(data.currentStatus || data.status, 50).toLowerCase();
  const votingStatus = cleanText(data.votingStatus, 50).toLowerCase();
  if (["removed", "refused", "cancelled"].includes(status)) return false;
  return status === "approved" || votingStatus === "open" || votingStatus === "finalized";
}

async function loadApprovedBox(uid: string): Promise<PublicPortfolioItem[]> {
  const snap = await db()
    .collection("bmidBoxRequests")
    .where("ownerUserId", "==", uid)
    .limit(50)
    .get();

  return snap.docs.flatMap((doc) => {
    const data = doc.data() as AnyRecord;
    if (!isVisibleBox(data)) return [];
    const preview =
      data.previewData && typeof data.previewData === "object"
        ? (data.previewData as AnyRecord)
        : {};
    const socialPreview =
      data.socialPreview && typeof data.socialPreview === "object"
        ? (data.socialPreview as AnyRecord)
        : {};
    const title = cleanText(preview.title || socialPreview.title, 120) || "Verified shared work";
    const description = cleanText(
      preview.caption || preview.description || socialPreview.caption || socialPreview.description,
      280
    );
    const imageUrl = safeHttpUrl(
      preview.thumbnailUrl || socialPreview.thumbnailUrl || pickFirstImage(data)
    );
    const href = safeHttpUrl(
      data.sourceUrl || socialPreview.canonicalUrl || socialPreview.externalUrl
    );
    return [{
      id: `box-${doc.id}`,
      kind: "box" as const,
      eyebrow: "BMID Box",
      title,
      description,
      imageUrl,
      href,
      createdAt: portfolioDate(data.createdAt || data.submittedAt),
    }];
  });
}

async function findUserByBmid(identifier: string) {
  const snap = await db()
    .collection("users")
    .where("bmidNumber", "==", identifier)
    .limit(2)
    .get();
  return snap.docs[0] ?? null;
}

export async function resolvePublicBmidProfile(
  rawIdentifier: string
): Promise<ResolvedPublicBmidProfile | null> {
  const result = await resolvePublicBmidProfileResult(rawIdentifier);
  return result.profile;
}

export async function resolvePublicBmidProfileResult(
  rawIdentifier: string
): Promise<PublicBmidProfileResolution> {
  const identifier = normalizeBmidIdentifier(rawIdentifier);
  if (!identifier) return { profile: null, unavailableReason: "not-found" };

  const userDoc = await findUserByBmid(identifier);
  if (!userDoc) return { profile: null, unavailableReason: "not-found" };
  const user = userDoc.data() as AnyRecord;
  if (!isPublicBmidUser(user)) {
    const inactive = user.disabled === true || user.isDeleted === true || user.isDeactivated === true;
    return {
      profile: null,
      unavailableReason: inactive ? "profile-inactive" : "verification-inactive",
    };
  }

  const portfolioGroups = await Promise.all([
    loadHighlightedPosts(userDoc.id),
    loadHighlightedVibes(userDoc.id),
    loadApprovedContent(userDoc.id),
    loadApprovedBox(userDoc.id),
    loadPublicProfileStats(userDoc.id, user),
  ]);
  const [highlightedPosts, highlightedVibes, approvedContent, approvedBox, profileStats] = portfolioGroups;
  const portfolio = [...highlightedPosts, ...highlightedVibes]
    .sort((a, b) => portfolioSortValue(b) - portfolioSortValue(a))
    .slice(0, 6);
  const bmidContent = approvedContent
    .sort((a, b) => portfolioSortValue(b) - portfolioSortValue(a))
    .slice(0, 6);
  const bmidBox = approvedBox
    .sort((a, b) => portfolioSortValue(b) - portfolioSortValue(a))
    .slice(0, 6);

  const tags = Array.isArray(user.tags)
    ? user.tags.map((tag) => cleanText(tag, 40)).filter(Boolean).slice(0, 5)
    : [];

  return {
    profile: {
      uid: userDoc.id,
      displayName:
        cleanText(user.displayName || user.name || user.username, 100) || "Biome Creator",
      username: cleanText(user.username, 100).replace(/^@+/, ""),
      photoUrl: safeHttpUrl(user.photoURL),
      bio: cleanText(user.bio, 600),
      tags,
      ...profileStats,
      bmidNumber: normalizeBmidIdentifier(user.bmidNumber),
      bmidVerifiedAt: isoTimestamp(user.bmidVerifiedAt),
      socials: publicSocials(user),
      portfolio,
      bmidContent,
      bmidBox,
    },
    unavailableReason: null,
  };
}
