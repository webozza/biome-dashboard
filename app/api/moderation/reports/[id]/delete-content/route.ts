import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { db } from "@/lib/server/firebase";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (g) return g;

  const { id } = await ctx.params;
  if (!id) return error("missing_id", 400);

  try {
    const firestore = db();
    const reportRef = firestore.collection("reports").doc(id);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) return error("not_found", 404);

    const report = reportSnap.data() as { contentPath?: string };
    const path = report?.contentPath || "";
    if (!path) return error("missing_content_path", 400);

    const segments = path.split("/").filter(Boolean);
    if (segments.length < 2 || segments.length % 2 !== 0) {
      return error("invalid_content_path", 400, { detail: path });
    }

    const contentRef = firestore.doc(path);
    const contentSnap = await contentRef.get();
    const alreadyGone = !contentSnap.exists;

    if (!alreadyGone) {
      await contentRef.delete();
    }

    const relatedSnap = await firestore
      .collection("reports")
      .where("contentPath", "==", path)
      .get();

    const batch = firestore.batch();
    for (const d of relatedSnap.docs) {
      batch.delete(d.ref);
    }
    if (!relatedSnap.docs.some((d) => d.id === id)) {
      batch.delete(reportRef);
    }
    await batch.commit();

    return json({
      id,
      deleted: !alreadyGone,
      alreadyGone,
      contentPath: path,
      reportsRemoved: relatedSnap.size || 1,
    });
  } catch (e) {
    return error("delete_content_failed", 500, { detail: String((e as Error).message) });
  }
}
