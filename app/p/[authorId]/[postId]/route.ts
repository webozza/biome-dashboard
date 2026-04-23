import { NextRequest } from "next/server";
import { resolveShare } from "@/lib/server/share/resolve";
import { renderOgPage } from "@/lib/server/share/render";
import { getBaseUrl } from "@/lib/server/share/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ authorId: string; postId: string }> }
) {
  const { authorId, postId } = await ctx.params;
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const format = url.searchParams.get("format");

  const resolved = await resolveShare({ authorId, docId: postId, kind: "post" });
  if (!resolved) {
    return new Response("Post not found", { status: 404 });
  }

  if (format === "json" || debug) {
    return Response.json(resolved, { status: 200 });
  }

  const pageUrl = `${getBaseUrl(req)}/p/${encodeURIComponent(authorId)}/${encodeURIComponent(postId)}`;
  const html = renderOgPage({
    pageUrl,
    userName: resolved.userName,
    description: resolved.description,
    image: resolved.image,
    ogImage: resolved.ogImage,
    videoUrl: resolved.videoUrl,
    videoThumbImage: resolved.videoThumbImage,
    ogVideoThumbImage: resolved.ogVideoThumbImage,
    postId,
    authorId: resolved.authorId,
    likesCount: resolved.likesCount,
    commentsCount: resolved.commentsCount,
    commentsList: resolved.commentsList,
    imageURLs: resolved.imageURLs,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}
