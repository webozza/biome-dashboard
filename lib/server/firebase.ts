import admin from "firebase-admin";

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

  let svc:
    | (admin.ServiceAccount & {
        private_key?: string;
        project_id?: string;
        client_email?: string;
      })
    | null = null;
  let credential: admin.credential.Credential;

  if (raw) {
    const trimmed = raw.replace(/^['"]|['"]$/g, "");
    if (!trimmed.startsWith("{")) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain service account JSON. Use FIREBASE_SERVICE_ACCOUNT_PATH for file paths.");
    }
    const parsedSvc = JSON.parse(trimmed) as admin.ServiceAccount & {
      private_key?: string;
      project_id?: string;
      client_email?: string;
    };
    svc = parsedSvc;
    if (svc.private_key && svc.private_key.includes("\\n")) {
      svc.private_key = svc.private_key.replace(/\\n/g, "\n");
    }
    credential = admin.credential.cert(svc);
  } else if (keyPath) {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
    }
    credential = admin.credential.applicationDefault();
  } else {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS"
    );
  }

  console.log("[firebase-admin] initializing", {
    projectId: svc?.project_id || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || null,
    clientEmail: svc?.client_email || null,
  });
  if (svc?.client_email?.startsWith("eas-submit@")) {
    console.warn(
      "[firebase-admin] EAS submit service account detected. It may not have Firebase Cloud Messaging send permission; grant cloudmessaging.messages.create or use a Firebase Admin SDK service account."
    );
  }

  admin.initializeApp({
    credential,
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

export function storage(): admin.storage.Storage {
  initFirebase();
  return admin.storage();
}

export { admin };
