import fs from "fs";
import path from "path";
import crypto from "crypto";
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

function generateTempPassword(length = 16) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
}

function deriveDisplayName(email) {
  const local = email.split("@")[0] || "Admin";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const args = process.argv.slice(2).filter((a) => a && !a.startsWith("--"));
const emails = args.length > 0 ? args : ["josuatainsing@gmail.com", "admin@biome-aura.com"];

const serviceAccount = loadServiceAccount();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

const results = [];

for (const rawEmail of emails) {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error(`Skipping invalid email: ${rawEmail}`);
    continue;
  }

  const displayName = deriveDisplayName(email);
  const tempPassword = generateTempPassword(16);

  let userRecord;
  let created = false;
  try {
    userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, {
      password: tempPassword,
      emailVerified: true,
      displayName: userRecord.displayName || displayName,
    });
    console.log(`[update] reused existing auth user: ${email} (uid=${userRecord.uid})`);
  } catch (e) {
    if (e?.code === "auth/user-not-found") {
      userRecord = await auth.createUser({
        email,
        password: tempPassword,
        emailVerified: true,
        displayName,
      });
      created = true;
      console.log(`[create] new auth user: ${email} (uid=${userRecord.uid})`);
    } else {
      console.error(`Failed to lookup/create ${email}:`, e?.message || e);
      continue;
    }
  }

  const userDocRef = db.collection("users").doc(userRecord.uid);
  const snap = await userDocRef.get();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const usernameGuess = email.split("@")[0] || null;

  if (!snap.exists) {
    await userDocRef.set({
      displayName: userRecord.displayName || displayName,
      photoURL: null,
      email,
      provider: "password",
      username: usernameGuess,
      bio: "",
      isDeactivated: false,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`[create] users/${userRecord.uid} doc written`);
  } else {
    await userDocRef.set(
      {
        displayName: snap.get("displayName") || userRecord.displayName || displayName,
        email,
        provider: snap.get("provider") || "password",
        updatedAt: now,
      },
      { merge: true }
    );
    console.log(`[update] users/${userRecord.uid} doc merged`);
  }

  results.push({ email, uid: userRecord.uid, tempPassword, created });
}

console.log("\n========================================");
console.log("  ADMIN ACCOUNT CREDENTIALS — KEEP SAFE");
console.log("========================================");
for (const r of results) {
  console.log(`Email:    ${r.email}`);
  console.log(`UID:      ${r.uid}`);
  console.log(`Password: ${r.tempPassword}`);
  console.log(`Status:   ${r.created ? "newly created" : "password reset for existing user"}`);
  console.log("----------------------------------------");
}
console.log("\nNext steps:");
console.log("  1. Send the email + temporary password to the client over a secure channel.");
console.log("  2. Add these emails to your ADMIN_EMAILS env var (comma-separated):");
console.log(`       ADMIN_EMAILS="${results.map((r) => r.email).join(",")}"`);
console.log("     Update both .env.local (dashboard dev) and your production env (Vercel/etc.).");
console.log("  3. Tell the client to log in to the mobile app with the temporary password,");
console.log("     then go to Settings → Change Password to set their own.");
console.log("");

process.exit(0);
