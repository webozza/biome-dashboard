import { db } from "./firebase";
import type { Query, DocumentData, CollectionReference } from "firebase-admin/firestore";

export async function listCollection<T = DocumentData>(
  path: string,
  opts: { limit: number; cursor?: string; orderBy?: string; direction?: "asc" | "desc"; where?: { field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }[] } = {
    limit: 25,
  }
): Promise<{ items: (T & { id: string })[]; nextCursor: string | null }> {
  const orderBy = opts.orderBy || "createdAt";
  const direction = opts.direction || "desc";

  let q: Query = db().collection(path) as CollectionReference;
  if (opts.where?.length) {
    for (const w of opts.where) q = q.where(w.field, w.op, w.value);
  }
  q = q.orderBy(orderBy, direction).limit(opts.limit + 1);

  if (opts.cursor) {
    const cursorSnap = await db().collection(path).doc(opts.cursor).get();
    if (cursorSnap.exists) q = q.startAfter(cursorSnap);
  }

  const snap = await q.get();
  const docs = snap.docs;
  const hasMore = docs.length > opts.limit;
  const page = hasMore ? docs.slice(0, opts.limit) : docs;

  return {
    items: page.map((d) => ({ id: d.id, ...(d.data() as T) })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function getDoc<T = DocumentData>(
  path: string,
  id: string
): Promise<(T & { id: string }) | null> {
  const snap = await db().collection(path).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as T) };
}

export async function updateDoc(
  path: string,
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  await db()
    .collection(path)
    .doc(id)
    .set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function createDoc(
  path: string,
  payload: Record<string, unknown>,
  id?: string
): Promise<string> {
  const now = new Date().toISOString();
  const body = {
    ...payload,
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : now,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : now,
  };
  if (id) {
    await db().collection(path).doc(id).set(body);
    return id;
  }
  const ref = await db().collection(path).add(body);
  return ref.id;
}

export async function deleteDoc(path: string, id: string): Promise<void> {
  await db().collection(path).doc(id).delete();
}

export async function listDocIds(path: string): Promise<string[]> {
  const snap = await db().collection(path).select().get();
  return snap.docs.map((doc) => doc.id);
}

export async function deleteManyDocs(path: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const firestore = db();
  const batchSize = 400;
  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = firestore.batch();
    for (const id of ids.slice(index, index + batchSize)) {
      batch.delete(firestore.collection(path).doc(id));
    }
    await batch.commit();
  }
}

export async function countCollection(path: string, where?: { field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }[]): Promise<number> {
  let q: Query = db().collection(path);
  if (where?.length) for (const w of where) q = q.where(w.field, w.op, w.value);
  const snap = await q.count().get();
  return snap.data().count;
}
