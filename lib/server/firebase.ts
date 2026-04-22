import fs from "fs";
import path from "path";
import admin from "firebase-admin";

function resolveKeyPath(keyPath: string): string {
  if (path.isAbsolute(keyPath) && fs.existsSync(keyPath)) return keyPath;
  const candidates = [
    path.resolve(process.cwd(), keyPath),
    path.resolve(process.cwd(), "..", keyPath),
    path.resolve(__dirname, "..", "..", keyPath),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return keyPath;
}

let initialized = false;

export function initFirebase(): void {
  if (initialized || admin.apps.length) {
    initialized = true;
    return;
  }

  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  const keyPath =
    (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "").trim() ||
    (process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();

  let svc: admin.ServiceAccount & { private_key?: string };

  if (raw) {
    const trimmed = raw.replace(/^['"]|['"]$/g, "");
    svc = trimmed.startsWith("{")
      ? JSON.parse(trimmed)
      : JSON.parse(fs.readFileSync(resolveKeyPath(trimmed), "utf8"));
  } else if (keyPath) {
    svc = JSON.parse(fs.readFileSync(resolveKeyPath(keyPath), "utf8"));
  } else {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH"
    );
  }

  if (svc.private_key && svc.private_key.includes("\\n")) {
    svc.private_key = svc.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert(svc),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
  });
  initialized = true;
}

export function db(): FirebaseFirestore.Firestore {
  initFirebase();
  return admin.firestore();
}

export function auth(): admin.auth.Auth {
  initFirebase();
  return admin.auth();
}

export { admin };
