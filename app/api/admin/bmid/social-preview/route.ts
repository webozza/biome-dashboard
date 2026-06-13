import { NextRequest } from "next/server";
import { requireAdmin, requireFirebaseUser } from "@/lib/server/auth";
import { error, json } from "@/lib/server/response";
import type { BmidBoxPlatform } from "@/lib/data/bmid-box";

type PreviewType = "video" | "image" | "post" | "link";

const META_RE = /<meta\s+[^>]*(?:property|name)=["']([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>|<meta\s+[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']([^"']+)["'][^>]*>/gi;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function clean(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = decodeHtml(value).trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return "";
  return trimmed;
}

function absoluteUrl(value: string, base: URL) {
  if (!value) return "";
  try {
    return new URL(value, base).toString();
  } catch {
    return "";
  }
}

function detectPlatform(url: URL): BmidBoxPlatform {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
  if (host.includes("facebook.com") || host.includes("fb.watch")) return "facebook";
  if (host.includes("twitter.com") || host.includes("x.com")) return "x";
  return "generic";
}

function isExplicitVideoPath(platform: BmidBoxPlatform, url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const pathname = url.pathname.toLowerCase();

  if (platform === "facebook") {
    return (
      host.includes("fb.watch") ||
      pathname.includes("/videos/") ||
      pathname.includes("/watch/") ||
      pathname.includes("/reel/") ||
      pathname.includes("/reels/") ||
      pathname.includes("/video.php")
    );
  }

  return (
    pathname.includes("/reel/") ||
    pathname.includes("/reels/") ||
    pathname.includes("/shorts/") ||
    pathname.includes("/video/")
  );
}

function facebookPostId(url: URL) {
  if (detectPlatform(url) !== "facebook") return "";
  const segments = url.pathname.split("/").filter(Boolean);
  return segments
    .slice()
    .reverse()
    .find((segment) => /^\d{8,}$/.test(segment)) || "";
}

function hasFacebookVideoSignal(html: string, url: URL) {
  const id = facebookPostId(url);
  if (id) {
    const encodedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const idVideoPattern = new RegExp(`(?:/videos/|video_id["':=]+|videoID["':=]+)${encodedId}`, "i");
    if (idVideoPattern.test(html)) return true;
  }
  return false;
}

function inferType(platform: BmidBoxPlatform, url: URL, meta: Map<string, string>, html = ""): PreviewType {
  const ogType = clean(meta.get("og:type")).toLowerCase();
  const twitterPlayer = clean(meta.get("twitter:player"));
  const ogVideo = clean(meta.get("og:video") || meta.get("og:video:url") || meta.get("og:video:secure_url"));
  const explicitVideoPath = isExplicitVideoPath(platform, url);

  if (platform === "facebook" && !explicitVideoPath) {
    if (hasFacebookVideoSignal(html, url)) return "video";
    if (clean(meta.get("og:image") || meta.get("twitter:image"))) return "post";
    return "post";
  }

  if (
    ogType.includes("video") ||
    twitterPlayer ||
    ogVideo ||
    platform === "youtube" ||
    explicitVideoPath
  ) {
    return "video";
  }
  if (clean(meta.get("og:image") || meta.get("twitter:image"))) return platform === "generic" ? "link" : "post";
  return platform === "generic" ? "link" : "post";
}

function parseMeta(html: string) {
  const meta = new Map<string, string>();
  let match: RegExpExecArray | null;
  while ((match = META_RE.exec(html))) {
    const key = clean(match[1] || match[4]).toLowerCase();
    const value = clean(match[2] || match[3]);
    if (key && value && !meta.has(key)) meta.set(key, value);
  }
  const title = clean(TITLE_RE.exec(html)?.[1]);
  if (title && !meta.has("title")) meta.set("title", title);
  return meta;
}

function pickAuthor(meta: Map<string, string>) {
  return clean(
    meta.get("article:author") ||
      meta.get("author") ||
      meta.get("twitter:creator") ||
      meta.get("twitter:site") ||
      meta.get("og:site_name")
  );
}

export const dynamic = "force-dynamic";

async function requirePreviewAccess(req: NextRequest) {
  const admin = requireAdmin(req);
  if (admin.ok) return null;

  const user = await requireFirebaseUser(req);
  if (user.ok) return null;

  return error("unauthorized", 401, { reason: user.reason || admin.reason });
}

export async function POST(req: NextRequest) {
  const g = await requirePreviewAccess(req);
  if (g) return g;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const rawUrl = clean(body.url);
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return error("invalid_social_url", 400, { detail: "Invalid social media URL." });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return error("invalid_social_url", 400, { detail: "Invalid social media URL." });
  }

  const platform = detectPlatform(parsed);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const resp = await fetch(parsed.toString(), {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "BiomeDashboardSocialPreview/1.0",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (resp.status === 401 || resp.status === 403 || resp.status === 404) {
      return json({
        success: true,
        data: {
          platform,
          type: "post",
          canonicalUrl: parsed.toString(),
          externalUrl: parsed.toString(),
          status: "unavailable",
        },
      });
    }

    if (!resp.ok) {
      return error("preview_unavailable", 502, {
        detail: "The platform did not return preview information.",
      });
    }

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return json({
        success: true,
        data: {
          platform,
          type: contentType.startsWith("image/") ? "image" : "link",
          title: parsed.hostname,
          canonicalUrl: resp.url || parsed.toString(),
          externalUrl: parsed.toString(),
          status: "ready",
        },
      });
    }

    const html = await resp.text();
    const meta = parseMeta(html);
    const base = new URL(resp.url || parsed.toString());
    const canonical =
      absoluteUrl(clean(meta.get("og:url") || meta.get("twitter:url")), base) ||
      base.toString();
    const thumbnailUrl = absoluteUrl(clean(meta.get("og:image:secure_url") || meta.get("og:image") || meta.get("twitter:image")), base);
    const embedUrl = absoluteUrl(clean(meta.get("twitter:player") || meta.get("og:video") || meta.get("og:video:url")), base);
    const videoUrl = absoluteUrl(clean(meta.get("og:video:secure_url") || meta.get("og:video:url") || meta.get("og:video")), base);
    const title = clean(meta.get("og:title") || meta.get("twitter:title") || meta.get("title"));
    const description = clean(meta.get("og:description") || meta.get("twitter:description") || meta.get("description"));

    if (!title && !description && !thumbnailUrl) {
      return json({
        success: true,
        data: {
          platform,
          type: "post",
          canonicalUrl: canonical,
          externalUrl: parsed.toString(),
          status: "unavailable",
        },
      });
    }

    return json({
      success: true,
      data: {
        platform,
        type: inferType(platform, new URL(canonical || base.toString()), meta, html),
        title,
        caption: description,
        description,
        authorName: pickAuthor(meta),
        thumbnailUrl,
        videoUrl: videoUrl || null,
        embedUrl: embedUrl || null,
        canonicalUrl: canonical,
        externalUrl: parsed.toString(),
        status: "ready",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return error("preview_timeout", 504, { detail: "Preview request timed out." });
    }
    return error("preview_failed", 502, {
      detail: "Preview could not be loaded. You can still enter the information manually.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
