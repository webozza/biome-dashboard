import { db } from "../lib/server/firebase.js";

async function resetGmail() {
  const docPath = "adminSettings/gmail";
  try {
    await db().doc(docPath).delete();
    console.log("Successfully cleared invalid Gmail connection from Firestore.");
    process.exit(0);
  } catch (e) {
    console.error("Failed to clear Gmail connection:", e);
    process.exit(1);
  }
}

resetGmail();
