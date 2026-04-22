import fs from "fs";
import path from "path";
import admin from "firebase-admin";

function resolveKeyPath(keyPath) {
  if (path.isAbsolute(keyPath) && fs.existsSync(keyPath)) return keyPath;
  const candidates = [
    path.resolve(process.cwd(), keyPath),
    path.resolve(process.cwd(), "..", keyPath),
  ];
  for (const candidate of candidates) {
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
    throw new Error("Missing Firebase credentials.");
  }

  const serviceAccount = JSON.parse(fs.readFileSync(resolveKeyPath(keyPath), "utf8"));
  if (serviceAccount.private_key?.includes("\\n")) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }
  return serviceAccount;
}

const serviceAccount = loadServiceAccount();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
});

const db = admin.firestore();
const snap = await db.collection("bmidBoxRequests").select().get();

if (snap.empty) {
  console.log("bmidBoxRequests already empty");
  process.exit(0);
}

const batch = db.batch();
for (const doc of snap.docs) {
  batch.delete(doc.ref);
}
await batch.commit();

console.log(`Deleted ${snap.size} bmidBoxRequests documents`);
