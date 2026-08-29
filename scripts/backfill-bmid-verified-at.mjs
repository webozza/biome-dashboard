import fs from "fs";
import path from "path";
import admin from "firebase-admin";

function resolveKeyPath(keyPath) {
  if (path.isAbsolute(keyPath) && fs.existsSync(keyPath)) return keyPath;
  for (const candidate of [
    path.resolve(process.cwd(), keyPath),
    path.resolve(process.cwd(), "..", keyPath),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return keyPath;
}

function loadServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  const keyPath =
    (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "").trim() ||
    (process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
  if (raw) {
    const trimmed = raw.replace(/^['"]|['"]$/g, "");
    const serviceAccount = trimmed.startsWith("{")
      ? JSON.parse(trimmed)
      : JSON.parse(fs.readFileSync(resolveKeyPath(trimmed), "utf8"));
    if (serviceAccount.private_key?.includes("\\n")) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    return serviceAccount;
  }
  if (!keyPath) {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS."
    );
  }
  const serviceAccount = JSON.parse(fs.readFileSync(resolveKeyPath(keyPath), "utf8"));
  if (serviceAccount.private_key?.includes("\\n")) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }
  return serviceAccount;
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const seconds = value.seconds ?? value._seconds;
  return typeof seconds === "number" ? seconds * 1000 : null;
}

function candidate(value, source, confidence) {
  const millis = toMillis(value);
  return millis && millis <= Date.now()
    ? { value: new Date(millis).toISOString(), millis, source, confidence }
    : null;
}

const apply = process.argv.includes("--apply");
const serviceAccount = loadServiceAccount();
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const [usersSnap, requestsSnap] = await Promise.all([
  db.collection("users").where("verified", "==", true).get(),
  db.collection("verificationRequests").where("status", "==", "approved").get(),
]);

const requestsByUser = new Map();
for (const requestDoc of requestsSnap.docs) {
  const data = requestDoc.data();
  const userId = typeof data.userId === "string" ? data.userId : "";
  if (!userId) continue;
  const rows = requestsByUser.get(userId) || [];
  rows.push(data);
  requestsByUser.set(userId, rows);
}

const updates = [];
const skipped = [];

for (const userDoc of usersSnap.docs) {
  const user = userDoc.data();
  if (toMillis(user.bmidVerifiedAt)) {
    skipped.push({ uid: userDoc.id, reason: "already_set" });
    continue;
  }

  const requests = requestsByUser.get(userDoc.id) || [];
  const requestCandidates = requests.flatMap((request) => [
    candidate(request.approvedAt, "verification_request.approvedAt", 3),
    candidate(request.createdAt, "verification_request.createdAt_estimate", 1),
  ]).filter(Boolean);

  const notificationSnap = await userDoc.ref
    .collection("notifications")
    .where("type", "==", "bmid_verification_approved")
    .limit(20)
    .get()
    .catch(() => null);
  const notificationCandidates = notificationSnap
    ? notificationSnap.docs
        .map((doc) => candidate(doc.data().createdAt || doc.data().serverCreatedAt, "approval_notification", 2))
        .filter(Boolean)
    : [];

  const candidates = [...requestCandidates, ...notificationCandidates];
  if (!candidates.length) {
    skipped.push({ uid: userDoc.id, reason: "no_approval_timestamp" });
    continue;
  }

  const strongestConfidence = Math.max(...candidates.map((item) => item.confidence));
  const strongest = candidates
    .filter((item) => item.confidence === strongestConfidence)
    .sort((a, b) => a.millis - b.millis)[0];
  updates.push({
    uid: userDoc.id,
    bmidNumber: user.bmidNumber || null,
    bmidVerifiedAt: strongest.value,
    source: strongest.source,
  });
}

console.log(`${apply ? "APPLY" : "DRY RUN"}: ${updates.length} BMID verification dates ready; ${skipped.length} skipped.`);
for (const row of updates) {
  console.log(`[${row.source}] ${row.uid} ${row.bmidNumber || "(no BMID)"} -> ${row.bmidVerifiedAt}`);
}
for (const row of skipped.filter((item) => item.reason !== "already_set")) {
  console.warn(`[skip:${row.reason}] ${row.uid}`);
}

if (!apply || !updates.length) {
  if (!apply) console.log("No writes performed. Re-run with --apply after reviewing this output.");
  process.exit(0);
}

for (let index = 0; index < updates.length; index += 400) {
  const batch = db.batch();
  for (const row of updates.slice(index, index + 400)) {
    batch.set(
      db.collection("users").doc(row.uid),
      {
        bmidVerifiedAt: row.bmidVerifiedAt,
        bmidVerifiedAtSource: row.source,
      },
      { merge: true }
    );
  }
  await batch.commit();
}

console.log(`Updated ${updates.length} verified user profiles.`);
