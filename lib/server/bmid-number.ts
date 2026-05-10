import { db } from "./firebase";

const RESERVED_BMID_COUNT = 10;

let syncPromise: Promise<void> | null = null;

export function parseBmidSequence(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(?:BMID-|BM)(\d+)$/i);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

export function formatBmidNumber(sequence: number) {
  return `BM${String(sequence).padStart(4, "0")}`;
}

export function normalizeReservedSequence(sequence: number) {
  return sequence <= RESERVED_BMID_COUNT ? sequence + RESERVED_BMID_COUNT : sequence;
}

async function runReservedBmidSync() {
  const usersSnap = await db().collection("users").get();
  const updates = usersSnap.docs
    .map((doc) => {
      const current = typeof doc.data().bmidNumber === "string" ? doc.data().bmidNumber.trim() : "";
      const sequence = parseBmidSequence(current);
      if (!sequence) return null;

      const normalizedBmidNumber = formatBmidNumber(normalizeReservedSequence(sequence));
      if (current === normalizedBmidNumber) return null;

      return {
        userId: doc.id,
        bmidNumber: normalizedBmidNumber,
      };
    })
    .filter((item): item is { userId: string; bmidNumber: string } => Boolean(item));

  await Promise.all(
    updates.map(async ({ userId, bmidNumber }) => {
      const updatedAt = new Date().toISOString();

      await db().collection("users").doc(userId).set(
        {
          bmidNumber,
          verified: true,
          updatedAt,
        },
        { merge: true }
      );

      const [verificationSnap, contentSnap, boxOwnerSnap, boxTaggedSnap] = await Promise.all([
        db().collection("verificationRequests").where("userId", "==", userId).get(),
        db().collection("contentRequests").where("userId", "==", userId).get(),
        db().collection("bmidBoxRequests").where("ownerUserId", "==", userId).get(),
        db().collection("bmidBoxRequests").where("taggedUserId", "==", userId).get(),
      ]);

      await Promise.all([
        ...verificationSnap.docs.map((doc) =>
          doc.ref.set(
            {
              bmidNumber,
              updatedAt,
            },
            { merge: true }
          )
        ),
        ...contentSnap.docs.map((doc) =>
          doc.ref.set(
            {
              bmidNumber,
              updatedAt,
            },
            { merge: true }
          )
        ),
        ...boxOwnerSnap.docs.map((doc) => {
          const data = doc.data() as { ownerSnapshot?: Record<string, unknown> };
          return doc.ref.set(
            {
              ownerSnapshot: {
                ...(data.ownerSnapshot || {}),
                bmidNumber,
                verified: true,
              },
              updatedAt,
            },
            { merge: true }
          );
        }),
        ...boxTaggedSnap.docs.map((doc) => {
          const data = doc.data() as { taggedSnapshot?: Record<string, unknown> };
          return doc.ref.set(
            {
              taggedSnapshot: {
                ...(data.taggedSnapshot || {}),
                bmidNumber,
                verified: true,
              },
              updatedAt,
            },
            { merge: true }
          );
        }),
      ]);
    })
  );
}

export async function ensureReservedBmidAssignmentsSynced() {
  if (!syncPromise) {
    syncPromise = runReservedBmidSync().finally(() => {
      syncPromise = null;
    });
  }

  await syncPromise;
}

export { RESERVED_BMID_COUNT };
