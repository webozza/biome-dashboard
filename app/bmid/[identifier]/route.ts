import { NextRequest } from "next/server";
import { resolvePublicBmidProfileResult } from "@/lib/server/share/profile";
import {
  renderPublicBmidProfile,
  renderUnavailableBmidProfile,
} from "@/lib/server/share/profile-render";
import { getBaseUrl } from "@/lib/server/share/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await ctx.params;
  const { profile, unavailableReason } = await resolvePublicBmidProfileResult(identifier);
  if (!profile) {
    return new Response(renderUnavailableBmidProfile(unavailableReason ?? "not-found"), {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=30, s-maxage=60",
        "X-Robots-Tag": "noindex",
      },
    });
  }

  const canonicalPath = `/bmid/${encodeURIComponent(profile.bmidNumber)}`;
  const requestUrl = new URL(req.url);
  if (requestUrl.pathname !== canonicalPath) {
    return Response.redirect(`${getBaseUrl(req)}${canonicalPath}`, 308);
  }

  const pageUrl = `${getBaseUrl(req)}${canonicalPath}`;
  const format = requestUrl.searchParams.get("format");
  if (format === "json") {
    return Response.json(profile, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=120" },
    });
  }

  return new Response(renderPublicBmidProfile({ profile, pageUrl }), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      "Content-Security-Policy": [
        "default-src 'self'",
        "img-src 'self' data: https:",
        "style-src 'unsafe-inline'",
        "script-src 'unsafe-inline'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
