import { admin, db } from "./firebase";

export type NotificationType =
  | "bmid_content_approved"
  | "bmid_content_rejected"
  | "bmid_box_approved"
  | "bmid_box_rejected"
  | "bmid_verification_approved"
  | "bmid_verification_rejected";

export type NotificationNavigationMeta = {
  authorId?: string | null;
  postId?: string | null;
  docPath?: string | null;
  requestDocPath?: string | null;
};

export type NotificationPayload = {
  type: NotificationType;
  title: string;
  body: string;
  bmidRequestId: string;
  bmidSource: "content" | "box" | "verification";
  bmidDecision: "accepted" | "rejected";
  fromUid?: string;
} & NotificationNavigationMeta;

export type ApprovalNotificationSource = Exclude<NotificationPayload["bmidSource"], "verification">;
export type ApprovalNotificationRequestType = "own" | "duality";

type PushProvider = "expo" | "fcm";

type StoredPushToken = {
  ref: FirebaseFirestore.DocumentReference;
  token: string;
  provider: PushProvider;
  deviceId: string | null;
  platform: string | null;
  createdAtMs: number;
};

type ExpoPushTicket = {
  status?: "ok" | "error";
  message?: string;
  details?: {
    error?: string;
  };
};

export type UserNotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  message: string;
  read: boolean;
  isRead: boolean;
  createdAt: string | null;
  timestamp: string | null;
  fromUid: string | null;
  fromPhotoURL: string | null;
  bmidRequestId: string;
  bmidSource: NotificationPayload["bmidSource"];
  source: NotificationPayload["bmidSource"];
  bmidDecision: NotificationPayload["bmidDecision"];
  authorId: string | null;
  postId: string | null;
  docPath: string | null;
  requestDocPath: string | null;
};

type ResolvedNotificationNavigationMeta = {
  authorId: string | null;
  postId: string | null;
  docPath: string | null;
  requestDocPath: string | null;
};

type CreateNotificationDocResult = {
  created: boolean;
  docId: string;
  navigation: ResolvedNotificationNavigationMeta;
  status: "created" | "deduped" | "failed";
};

type NotificationDebugContext = {
  stage: "broadcast" | "direct";
  type: NotificationType;
  requestId: string;
  source: NotificationPayload["bmidSource"];
  decision: NotificationPayload["bmidDecision"];
  actorUid?: string;
  actorName?: string;
  targetUid?: string;
};

type SendPushNotificationOptions = {
  debugContext?: NotificationDebugContext;
  alreadyQueuedTokenKeys?: Set<string>;
};

function buildNotificationDebugPrefix(ctx: NotificationDebugContext) {
  const parts = [
    "[notification][debug]",
    `stage=${ctx.stage}`,
    `type=${ctx.type}`,
    `request=${ctx.requestId}`,
    `source=${ctx.source}`,
    `decision=${ctx.decision}`,
    ctx.actorUid ? `actorUid=${ctx.actorUid}` : null,
    ctx.actorName ? `actorName=${JSON.stringify(ctx.actorName)}` : null,
    ctx.targetUid ? `targetUid=${ctx.targetUid}` : null,
  ].filter(Boolean);

  return parts.join(" ");
}

function buildApprovalAudienceLabel(
  source: ApprovalNotificationSource,
  requestType: ApprovalNotificationRequestType
): string {
  const sourceLabel = source === "content" ? "BMID content" : "BMID box content";
  if (requestType === "duality") return `a duality ${sourceLabel}`;
  return `their own ${sourceLabel}`;
}

export function buildApprovalNotificationCopy(input: {
  actorName: string;
  source: ApprovalNotificationSource;
  requestType: ApprovalNotificationRequestType;
  postTitle?: string | null;
}) {
  const title = `${input.actorName} posted ${buildApprovalAudienceLabel(input.source, input.requestType)}`;
  const normalizedPostTitle = input.postTitle?.trim();
  const body = normalizedPostTitle
    ? `Open the app to review "${normalizedPostTitle}".`
    : "Open the app to review it.";

  return { title, body };
}

function sanitizeNotificationKeyPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildNotificationDocId(payload: NotificationPayload): string {
  return [
    sanitizeNotificationKeyPart(payload.type),
    sanitizeNotificationKeyPart(payload.bmidRequestId),
    sanitizeNotificationKeyPart(payload.bmidDecision),
    sanitizeNotificationKeyPart(payload.fromUid || "admin"),
  ].join("__");
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: unknown }).code === 6 || (error as { code?: unknown }).code === "already-exists")
  );
}

function isProbablyFcmToken(value: string): boolean {
  const token = value.trim();
  return !isExpoPushToken(token) && (token.length >= 80 || token.includes(":"));
}

function isExpoPushToken(value: string): boolean {
  const token = value.trim();
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

function getOptionalString(data: Record<string, unknown>, key: string): string | null {
  return typeof data[key] === "string" && data[key].trim() ? data[key].trim() : null;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildUserPostDocPath(authorId: string | null | undefined, postId: string | null | undefined): string | null {
  const normalizedAuthorId = normalizeOptionalString(authorId);
  const normalizedPostId = normalizeOptionalString(postId);
  if (!normalizedAuthorId || !normalizedPostId) return null;
  return `users/${normalizedAuthorId}/posts/${normalizedPostId}`;
}

export function buildNotificationRequestDocPath(
  source: NotificationPayload["bmidSource"],
  requestId: string
): string | null {
  const normalizedRequestId = normalizeOptionalString(requestId);
  if (!normalizedRequestId) return null;
  if (source === "content") return `contentRequests/${normalizedRequestId}`;
  if (source === "box") return `bmidBoxRequests/${normalizedRequestId}`;
  return `verificationRequests/${normalizedRequestId}`;
}

async function readContentNotificationMeta(requestId: string) {
  const snap = await db().collection("contentRequests").doc(requestId).get();
  if (!snap.exists) return null;
  const raw = (snap.data() || {}) as Record<string, unknown>;
  const authorId = normalizeOptionalString(raw.userId);
  const postId = normalizeOptionalString(raw.postId);
  return {
    authorId,
    postId,
    docPath: buildUserPostDocPath(authorId, postId),
  };
}

async function readBoxNotificationMeta(requestId: string) {
  const snap = await db().collection("bmidBoxRequests").doc(requestId).get();
  if (!snap.exists) return null;
  const raw = (snap.data() || {}) as Record<string, unknown>;
  return {
    authorId: normalizeOptionalString(raw.ownerUserId),
    postId: null,
    docPath: null,
  };
}

async function resolveNotificationNavigationMeta(
  payload: Pick<
    NotificationPayload,
    "bmidRequestId" | "bmidSource" | "authorId" | "postId" | "docPath" | "requestDocPath"
  >
): Promise<ResolvedNotificationNavigationMeta> {
  const resolved: ResolvedNotificationNavigationMeta = {
    authorId: normalizeOptionalString(payload.authorId),
    postId: normalizeOptionalString(payload.postId),
    docPath: normalizeOptionalString(payload.docPath),
    requestDocPath:
      normalizeOptionalString(payload.requestDocPath) ||
      buildNotificationRequestDocPath(payload.bmidSource, payload.bmidRequestId),
  };

  const needsContentLookup =
    payload.bmidSource === "content" && (!resolved.authorId || !resolved.postId || !resolved.docPath);
  const needsBoxLookup = payload.bmidSource === "box" && (!resolved.authorId || !resolved.docPath);

  if (needsContentLookup) {
    const content = await readContentNotificationMeta(payload.bmidRequestId);
    if (content) {
      resolved.authorId = resolved.authorId || content.authorId;
      resolved.postId = resolved.postId || content.postId;
      resolved.docPath = resolved.docPath || content.docPath;
    }
  } else if (needsBoxLookup) {
    const box = await readBoxNotificationMeta(payload.bmidRequestId);
    if (box) {
      resolved.authorId = resolved.authorId || box.authorId;
    }
  }

  if (!resolved.docPath) {
    resolved.docPath = buildUserPostDocPath(resolved.authorId, resolved.postId) || resolved.requestDocPath;
  }

  return resolved;
}

function shouldBackfillNotificationNavigation(item: UserNotificationItem) {
  if (!item.docPath || !item.requestDocPath) return true;
  if (item.bmidSource === "content") {
    return !item.authorId || !item.postId;
  }
  if (item.bmidSource === "box") {
    return !item.authorId;
  }
  return false;
}

async function enrichNotificationItem(item: UserNotificationItem): Promise<UserNotificationItem> {
  if (!shouldBackfillNotificationNavigation(item)) return item;
  const navigation = await resolveNotificationNavigationMeta({
    bmidRequestId: item.bmidRequestId,
    bmidSource: item.bmidSource,
    authorId: item.authorId,
    postId: item.postId,
    docPath: item.docPath,
    requestDocPath: item.requestDocPath,
  });
  return {
    ...item,
    ...navigation,
  };
}

function buildPushNotificationData(
  payload: NotificationPayload,
  navigation: ResolvedNotificationNavigationMeta,
  fromUid?: string
): Record<string, string> {
  const data: Record<string, string> = {
    type: payload.type,
    bmidRequestId: payload.bmidRequestId,
    bmidSource: payload.bmidSource,
    source: payload.bmidSource,
    bmidDecision: payload.bmidDecision,
  };

  const authorId = navigation.authorId || normalizeOptionalString(payload.authorId);
  const postId = navigation.postId || normalizeOptionalString(payload.postId);
  const docPath = navigation.docPath || normalizeOptionalString(payload.docPath);
  const requestDocPath =
    navigation.requestDocPath ||
    normalizeOptionalString(payload.requestDocPath) ||
    buildNotificationRequestDocPath(payload.bmidSource, payload.bmidRequestId);

  if (fromUid) data.fromUid = fromUid;
  if (authorId) data.authorId = authorId;
  if (postId) data.postId = postId;
  if (docPath) data.docPath = docPath;
  if (requestDocPath) data.requestDocPath = requestDocPath;

  return data;
}

function toMillis(value: unknown): number {
  const iso = toIso(value);
  if (!iso) return 0;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : 0;
}

function buildStoredPushToken(
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>,
  rawToken: string
): StoredPushToken | null {
  const token = rawToken.trim();
  const provider = isExpoPushToken(token) ? "expo" : isProbablyFcmToken(token) ? "fcm" : null;
  if (!provider) return null;

  const data = doc.data() as Record<string, unknown>;
  return {
    ref: doc.ref,
    token,
    provider,
    deviceId: getOptionalString(data, "deviceId"),
    platform: getOptionalString(data, "platform"),
    createdAtMs:
      (typeof data.createdAtMs === "number" && Number.isFinite(data.createdAtMs) ? data.createdAtMs : 0) ||
      toMillis(data.createdAt) ||
      toMillis(data.timestamp),
  };
}

function readStoredPushToken(
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
): StoredPushToken | null {
  const data = doc.data() as Record<string, unknown>;
  const candidates = [
    data.token,
    data.fcmToken,
    data.registrationToken,
    data.value,
    data.pushToken,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const parsed = buildStoredPushToken(doc, candidate);
      if (parsed) return parsed;
    }
  }

  return buildStoredPushToken(doc, doc.id);
}

async function removeTokenRefs(
  targetUid: string,
  refs: FirebaseFirestore.DocumentReference[],
  provider: PushProvider
) {
  if (refs.length === 0) return;
  const batch = db().batch();
  refs.forEach((ref) => {
    batch.delete(ref);
  });
  await batch.commit();
  console.log(`[${provider}] removed ${refs.length} stale tokens for ${targetUid}`);
}

function summarizeFailureCodes(failureCodes: Map<string, number>): string {
  return Array.from(failureCodes.entries())
    .map(([code, count]) => `${code}:${count}`)
    .join(", ");
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  if (typeof value === "number") return new Date(value).toISOString();
  return null;
}

function dedupeTokenEntries(entries: StoredPushToken[]) {
  const unique = new Map<string, StoredPushToken>();
  const duplicateRefs: FirebaseFirestore.DocumentReference[] = [];

  for (const entry of entries) {
    const dedupeKey = entry.deviceId
      ? `${entry.provider}:device:${entry.deviceId}`
      : `${entry.provider}:token:${entry.token}`;
    const existing = unique.get(dedupeKey);
    if (!existing) {
      unique.set(dedupeKey, entry);
      continue;
    }

    if (entry.createdAtMs >= existing.createdAtMs) {
      duplicateRefs.push(existing.ref);
      unique.set(dedupeKey, entry);
      continue;
    }

    duplicateRefs.push(entry.ref);
  }

  return {
    entries: Array.from(unique.values()),
    duplicateRefs,
  };
}

function normalizeNotificationDoc(
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>
): UserNotificationItem | null {
  if (!doc.exists) return null;
  const raw = doc.data() as Record<string, unknown> | undefined;
  if (!raw) return null;

  const body = typeof raw.body === "string" ? raw.body : typeof raw.message === "string" ? raw.message : "";
  const createdAt = toIso(raw.createdAt) || toIso(raw.timestamp) || toIso(raw.serverCreatedAt);

  return {
    id: doc.id,
    type: (typeof raw.type === "string" ? raw.type : "bmid_content_approved") as NotificationType,
    title: typeof raw.title === "string" ? raw.title : "",
    body,
    message: typeof raw.message === "string" ? raw.message : body,
    read: raw.read === true || raw.isRead === true,
    isRead: raw.isRead === true || raw.read === true,
    createdAt,
    timestamp: toIso(raw.timestamp) || createdAt,
    fromUid: typeof raw.fromUid === "string" ? raw.fromUid : null,
    fromPhotoURL: typeof raw.fromPhotoURL === "string" ? raw.fromPhotoURL : null,
    bmidRequestId: typeof raw.bmidRequestId === "string" ? raw.bmidRequestId : "",
    bmidSource: (typeof raw.bmidSource === "string" ? raw.bmidSource : typeof raw.source === "string" ? raw.source : "content") as NotificationPayload["bmidSource"],
    source: (typeof raw.source === "string" ? raw.source : typeof raw.bmidSource === "string" ? raw.bmidSource : "content") as NotificationPayload["bmidSource"],
    bmidDecision: (typeof raw.bmidDecision === "string" ? raw.bmidDecision : "accepted") as NotificationPayload["bmidDecision"],
    authorId: normalizeOptionalString(raw.authorId),
    postId: normalizeOptionalString(raw.postId),
    docPath: normalizeOptionalString(raw.docPath),
    requestDocPath: normalizeOptionalString(raw.requestDocPath),
  };
}

function chunkEntries<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function sendExpoPushNotifications(
  targetUid: string,
  tokenEntries: StoredPushToken[],
  title: string,
  body: string,
  data?: Record<string, string>,
  debugPrefix?: string
) {
  const staleRefs: FirebaseFirestore.DocumentReference[] = [];
  const failureCodes = new Map<string, number>();
  let successCount = 0;

  try {
    for (const chunk of chunkEntries(tokenEntries, 100)) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          chunk.map((entry) => ({
            to: entry.token,
            title,
            body,
            data,
            sound: "default",
            priority: "high",
            channelId: "high_importance_channel",
          }))
        ),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${debugPrefix || "[expo]"} request failed for ${targetUid}: ${response.status} ${errorText}`);
        continue;
      }

      const payload = (await response.json()) as { data?: ExpoPushTicket[] };
      const tickets = Array.isArray(payload.data) ? payload.data : [];

      tickets.forEach((ticket, index) => {
        if (ticket.status === "ok") {
          successCount += 1;
          return;
        }

        const errorCode = ticket.details?.error || ticket.message || "unknown";
        failureCodes.set(errorCode, (failureCodes.get(errorCode) || 0) + 1);
        if (ticket.details?.error === "DeviceNotRegistered") {
          staleRefs.push(chunk[index].ref);
        }
      });
    }

    await removeTokenRefs(targetUid, staleRefs, "expo");

    if (failureCodes.size > 0) {
      const failureSummary = summarizeFailureCodes(failureCodes);
      if (successCount > 0) {
        console.log(
          `${debugPrefix || "[expo]"} delivered to ${successCount} devices for ${targetUid} (${failureSummary})`
        );
      } else {
        console.warn(
          `${debugPrefix || "[expo]"} all ${tokenEntries.length} tokens failed for ${targetUid}${failureSummary ? ` (${failureSummary})` : ""}`
        );
      }
      return;
    }

    console.log(`${debugPrefix || "[expo]"} successfully delivered to all ${tokenEntries.length} devices for ${targetUid}`);
  } catch (e) {
    console.error(`${debugPrefix || "[expo]"} critical failure for ${targetUid}`, e);
  }
}

async function sendFcmPushNotifications(
  targetUid: string,
  tokenEntries: StoredPushToken[],
  title: string,
  body: string,
  data?: Record<string, string>,
  debugPrefix?: string
) {
  const tokens = tokenEntries.map((entry) => entry.token);
  if (tokens.length === 0) return;

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: {
      title,
      body,
    },
    data: {
      ...data,
      title,
      body,
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      type: data?.type || "general",
    },
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "high_importance_channel",
        clickAction: "FLUTTER_NOTIFICATION_CLICK",
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    },
    apns: {
      payload: {
        aps: {
          contentAvailable: true,
          mutableContent: true,
          badge: 1,
          sound: "default",
          alert: {
            title,
            body,
          },
        },
      },
      headers: {
        "apns-priority": "10",
      },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    if (response.failureCount > 0) {
      const tokenRefsToRemove: FirebaseFirestore.DocumentReference[] = [];
      const failureCodes = new Map<string, number>();
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code || "unknown";
          failureCodes.set(errorCode, (failureCodes.get(errorCode) || 0) + 1);
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/mismatched-credential"
          ) {
            tokenRefsToRemove.push(tokenEntries[idx].ref);
          }
        }
      });

      await removeTokenRefs(targetUid, tokenRefsToRemove, "fcm");

      const failureSummary = summarizeFailureCodes(failureCodes);
      if (failureCodes.has("messaging/mismatched-credential")) {
        console.error(
          `${debugPrefix || "[fcm]"} credential mismatch: removing tokens that do not belong to this Firebase project`
        );
      }
      const actuallySent = response.successCount;
      if (actuallySent > 0) {
        console.log(
          `${debugPrefix || "[fcm]"} delivered to ${actuallySent} devices for ${targetUid} (${response.failureCount} failed${failureSummary ? `; ${failureSummary}` : ""})`
        );
      } else {
        console.warn(
          `${debugPrefix || "[fcm]"} all ${tokens.length} tokens failed for ${targetUid}${failureSummary ? ` (${failureSummary})` : ""}`
        );
      }
    } else {
      console.log(`${debugPrefix || "[fcm]"} successfully delivered to all ${tokens.length} devices for ${targetUid}`);
    }
  } catch (e) {
    console.error(`${debugPrefix || "[fcm]"} critical failure for ${targetUid}`, e);
  }
}

/**
 * Creates a notification document in the user's specific collection.
 * Path: users/{targetUid}/notifications/
 */
export async function createNotificationDoc(
  targetUid: string,
  payload: NotificationPayload,
  debugContext?: NotificationDebugContext
): Promise<CreateNotificationDocResult> {
  const createdAt = new Date().toISOString();
  const docId = buildNotificationDocId(payload);
  const navigation = await resolveNotificationNavigationMeta(payload);
  const doc = {
    ...payload,
    ...navigation,
    source: payload.bmidSource,
    fromUid: payload.fromUid || "admin",
    fromPhotoURL: null,
    createdAt,
    timestamp: createdAt,
    createdAtMs: Date.now(),
    serverCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
    read: false,
    isRead: false,
    message: payload.body,
  };

  try {
    await db()
      .collection("users")
      .doc(targetUid)
      .collection("notifications")
      .doc(docId)
      .create(doc);
    if (debugContext) {
      console.log(`${buildNotificationDebugPrefix({ ...debugContext, targetUid })} notificationDoc=created docId=${docId}`);
    }
    return { created: true, docId, navigation, status: "created" };
  } catch (e) {
    if (isAlreadyExistsError(e)) {
      if (debugContext) {
        console.log(`${buildNotificationDebugPrefix({ ...debugContext, targetUid })} notificationDoc=deduped docId=${docId}`);
      } else {
        console.log(`[notification] deduped existing notification for ${targetUid}`, {
          type: payload.type,
          requestId: payload.bmidRequestId,
          decision: payload.bmidDecision,
        });
      }
      return { created: false, docId, navigation, status: "deduped" };
    }
    if (debugContext) {
      console.error(`${buildNotificationDebugPrefix({ ...debugContext, targetUid })} notificationDoc=failed docId=${docId}`, e);
    }
    console.error(`[notification] failed to write doc for ${targetUid}`, e);
    return { created: false, docId, navigation, status: "failed" };
  }
}

export async function listUserNotifications(targetUid: string, limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const collection = db().collection("users").doc(targetUid).collection("notifications");

  const [serverOrdered, legacyOrdered] = await Promise.all([
    collection.orderBy("serverCreatedAt", "desc").limit(safeLimit).get().catch(() => null),
    collection.orderBy("createdAt", "desc").limit(safeLimit).get().catch(() => null),
  ]);

  const docs = new Map<string, UserNotificationItem>();
  for (const snap of [serverOrdered, legacyOrdered]) {
    if (!snap) continue;
    for (const doc of snap.docs) {
      const normalized = normalizeNotificationDoc(doc);
      if (!normalized) continue;
      docs.set(normalized.id, normalized);
    }
  }

  const items = (await Promise.all(Array.from(docs.values()).map(enrichNotificationItem)))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, safeLimit);

  return {
    items,
    unreadCount: items.filter((item) => !item.read).length,
  };
}

export async function markUserNotificationsRead(
  targetUid: string,
  opts: { ids?: string[]; read?: boolean; all?: boolean } = {}
) {
  const read = opts.read ?? true;
  const collection = db().collection("users").doc(targetUid).collection("notifications");

  let refs: FirebaseFirestore.DocumentReference[] = [];
  if (opts.all) {
    const snap = await collection.limit(500).get();
    refs = snap.docs.map((doc) => doc.ref);
  } else if (opts.ids?.length) {
    refs = opts.ids.map((id) => collection.doc(id));
  } else {
    return { updatedCount: 0 };
  }

  if (refs.length === 0) return { updatedCount: 0 };

  const batch = db().batch();
  const readAt = new Date().toISOString();
  refs.forEach((ref) => {
    batch.set(
      ref,
      {
        read,
        isRead: read,
        readAt: read ? readAt : null,
        updatedAt: readAt,
      },
      { merge: true }
    );
  });
  await batch.commit();

  return { updatedCount: refs.length };
}

/**
 * Sends FCM push notification to all active tokens of a user.
 * Now includes automatic cleanup of invalid/expired tokens.
 */
export async function sendPushNotification(
  targetUid: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  options: SendPushNotificationOptions = {}
) {
  const { debugContext, alreadyQueuedTokenKeys } = options;
  const tokensSnap = await db()
    .collection("users")
    .doc(targetUid)
    .collection("pushTokens")
    .get();

  const invalidTokenDocCount = tokensSnap.docs.filter((doc) => !readStoredPushToken(doc)).length;
  const rawTokenEntries = Array.from(
    new Map(
      tokensSnap.docs
        .map(readStoredPushToken)
        .filter((entry): entry is StoredPushToken => Boolean(entry))
        .map((entry) => [`${entry.provider}:${entry.token}`, entry])
    ).values()
  );
  const { entries: tokenEntries, duplicateRefs } = dedupeTokenEntries(rawTokenEntries);

  if (invalidTokenDocCount > 0) {
    console.warn(`[push] ignored ${invalidTokenDocCount} unsupported token docs for ${targetUid}`);
  }

  if (duplicateRefs.length > 0) {
    const duplicateExpoRefs = duplicateRefs.filter((ref) => {
      const entry = rawTokenEntries.find((candidate) => candidate.ref.path === ref.path);
      return entry?.provider === "expo";
    });
    const duplicateFcmRefs = duplicateRefs.filter((ref) => {
      const entry = rawTokenEntries.find((candidate) => candidate.ref.path === ref.path);
      return entry?.provider === "fcm";
    });
    await Promise.all([
      duplicateExpoRefs.length > 0 ? removeTokenRefs(targetUid, duplicateExpoRefs, "expo") : Promise.resolve(),
      duplicateFcmRefs.length > 0 ? removeTokenRefs(targetUid, duplicateFcmRefs, "fcm") : Promise.resolve(),
    ]);
    console.log(
      `[push] deduped ${duplicateRefs.length} stale duplicate tokens for ${targetUid} before sending`
    );
  }

  const expoEntries = tokenEntries.filter((entry) => entry.provider === "expo");
  const expoDeviceIds = new Set(expoEntries.map((entry) => entry.deviceId).filter((value): value is string => Boolean(value)));
  const fcmEntries = tokenEntries.filter(
    (entry) => entry.provider === "fcm" && !(entry.deviceId && expoDeviceIds.has(entry.deviceId))
  );
  const skippedFcmEntries = tokenEntries.filter(
    (entry) => entry.provider === "fcm" && Boolean(entry.deviceId && expoDeviceIds.has(entry.deviceId))
  );
  const broadcastSkippedEntries = tokenEntries.filter((entry) =>
    Boolean(alreadyQueuedTokenKeys?.has(`${entry.provider}:${entry.token}`))
  );
  const filteredExpoEntries = expoEntries.filter(
    (entry) => !alreadyQueuedTokenKeys?.has(`${entry.provider}:${entry.token}`)
  );
  const filteredFcmEntries = fcmEntries.filter(
    (entry) => !alreadyQueuedTokenKeys?.has(`${entry.provider}:${entry.token}`)
  );
  const debugPrefix = debugContext
    ? buildNotificationDebugPrefix({ ...debugContext, targetUid })
    : `[push][debug] targetUid=${targetUid}`;

  console.log(
    `${debugPrefix} pushTokens rawDocs=${tokensSnap.size} invalidDocs=${invalidTokenDocCount} parsed=${rawTokenEntries.length} deduped=${tokenEntries.length} expo=${expoEntries.length} fcm=${fcmEntries.length} skippedFcm=${skippedFcmEntries.length}`
  );
  console.log(
    `${debugPrefix} pushTokenEntries`,
    tokenEntries.map((entry) => ({
      docId: entry.ref.id,
      provider: entry.provider,
      deviceId: entry.deviceId,
      platform: entry.platform,
      createdAtMs: entry.createdAtMs,
    }))
  );

  if (broadcastSkippedEntries.length > 0) {
    console.log(
      `${debugPrefix} push=skipped_shared_tokens count=${broadcastSkippedEntries.length}`,
      broadcastSkippedEntries.map((entry) => ({
        docId: entry.ref.id,
        provider: entry.provider,
        deviceId: entry.deviceId,
        platform: entry.platform,
      }))
    );
  }

  if (skippedFcmEntries.length > 0) {
    console.log(
      `[push] skipped ${skippedFcmEntries.length} FCM tokens for ${targetUid} because the same device already has an Expo token`
    );
  }

  if (tokenEntries.length === 0) {
    console.log(`${debugPrefix} push=skipped reason=no_tokens`);
    return;
  }
  if (filteredExpoEntries.length === 0 && filteredFcmEntries.length === 0) {
    console.log(`${debugPrefix} push=skipped reason=all_tokens_already_sent_in_broadcast`);
    return;
  }

  if (alreadyQueuedTokenKeys) {
    for (const entry of [...filteredExpoEntries, ...filteredFcmEntries]) {
      alreadyQueuedTokenKeys.add(`${entry.provider}:${entry.token}`);
    }
  }

  await Promise.all([
    filteredExpoEntries.length > 0
      ? sendExpoPushNotifications(targetUid, filteredExpoEntries, title, body, data, `${debugPrefix} [expo]`)
      : Promise.resolve(),
    filteredFcmEntries.length > 0
      ? sendFcmPushNotifications(targetUid, filteredFcmEntries, title, body, data, `${debugPrefix} [fcm]`)
      : Promise.resolve(),
  ]);
}

/**
 * Helper to fetch all verified users (BMID holders)
 */
async function getVerifiedUserIds(): Promise<string[]> {
  const snap = await db().collection("users").where("verified", "==", true).get();
  return snap.docs.map(d => d.id);
}

/**
 * Helper to fetch all followers of a user.
 * Assumes subcollection structure: users/{uid}/followers/{followerUid}
 */
async function getFollowerUserIds(userId: string): Promise<string[]> {
  try {
    const snap = await db().collection("users").doc(userId).collection("followers").get();
    return snap.docs.map(d => d.id);
  } catch (e) {
    console.warn(`[notification] could not fetch followers for ${userId}`, e);
    return [];
  }
}

/**
 * Broadcaster: Sends notification only to followers who are also verified users.
 */
export async function broadcastPostNotification(actorUid: string, actorName: string, opts: NotificationPayload) {
  try {
    const baseDebugContext: NotificationDebugContext = {
      stage: "broadcast",
      type: opts.type,
      requestId: opts.bmidRequestId,
      source: opts.bmidSource,
      decision: opts.bmidDecision,
      actorUid,
      actorName,
    };

    // 1. Resolve target users
    const [followers, verified] = await Promise.all([
      getFollowerUserIds(actorUid),
      getVerifiedUserIds()
    ]);

    const verifiedSet = new Set(verified);
    const targetUids = Array.from(
      new Set(followers.filter((uid) => uid !== actorUid && verifiedSet.has(uid)))
    );

    if (targetUids.length === 0) {
      console.log(
        `${buildNotificationDebugPrefix(baseDebugContext)} audience=empty followers=${followers.length} verified=${verified.length} eligibleFollowers=0`
      );
      return;
    }

    console.log(
      `${buildNotificationDebugPrefix(baseDebugContext)} audience followers=${followers.length} verified=${verified.length} eligibleFollowers=${targetUids.length}`,
      targetUids
    );
    const alreadyQueuedTokenKeys = new Set<string>();

    // 2. Notify everyone (Batching for Firestore if needed, but here we do parallel writes)
    // Push tokens may be duplicated across different user docs; keep broadcast sequential
    // so the same token is only used once per event.
    for (const uid of targetUids) {
      const targetDebugContext = { ...baseDebugContext, targetUid: uid };
      const notification = await createNotificationDoc(uid, { ...opts, fromUid: actorUid }, targetDebugContext);
      if (!notification.created) {
        console.log(
          `${buildNotificationDebugPrefix(targetDebugContext)} push=skipped reason=${
            notification.status === "deduped" ? "notification_doc_exists" : "notification_doc_write_failed"
          }`
        );
        continue;
      }
      await sendPushNotification(
        uid,
        opts.title,
        opts.body,
        buildPushNotificationData(opts, notification.navigation, actorUid),
        {
          debugContext: targetDebugContext,
          alreadyQueuedTokenKeys,
        }
      );
    }
  } catch (e) {
    console.error(`[notification] broadcast failed`, e);
  }
}

/**
 * Single-user notification (Direct)
 */
export async function notifyUser(targetUid: string, opts: NotificationPayload) {
  try {
    const debugContext: NotificationDebugContext = {
      stage: "direct",
      type: opts.type,
      requestId: opts.bmidRequestId,
      source: opts.bmidSource,
      decision: opts.bmidDecision,
      actorUid: opts.fromUid,
      targetUid,
    };
    const notification = await createNotificationDoc(targetUid, opts, debugContext);
    if (!notification.created) {
      console.log(
        `${buildNotificationDebugPrefix(debugContext)} push=skipped reason=${
          notification.status === "deduped" ? "notification_doc_exists" : "notification_doc_write_failed"
        }`
      );
      return;
    }
    await sendPushNotification(
      targetUid,
      opts.title,
      opts.body,
      buildPushNotificationData(opts, notification.navigation, opts.fromUid),
      { debugContext }
    );
  } catch (e) {
    console.error(`[notification] failed for user ${targetUid}`, e);
  }
}
