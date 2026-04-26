import { NextRequest } from "next/server";
import { generateFrameFromVideo, checkExistingFrame } from "@/lib/server/share/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(videoURL: string, prefix: string, force: boolean) {
  if (!videoURL || !prefix) {
    return Response.json({ error: "Missing videoURL or prefix" }, { status: 400 });
  }
  if (!force) {
    const existing = await checkExistingFrame(prefix);
    if (existing) return Response.json({ url: existing, cached: true });
  }
  const url = await generateFrameFromVideo(videoURL, prefix);
  return Response.json({ url, cached: false });
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const videoURL = u.searchParams.get("videoURL") || u.searchParams.get("videoUrl") || "";
  const prefix = u.searchParams.get("prefix") || "";
  const force = u.searchParams.get("force") === "1";
  try {
    return await handle(videoURL, prefix, force);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      videoURL?: string;
      videoUrl?: string;
      prefix?: string;
      force?: boolean;
    };
    const videoURL = body.videoURL || body.videoUrl || "";
    const prefix = body.prefix || "";
    return await handle(videoURL, prefix, Boolean(body.force));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
