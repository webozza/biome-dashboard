import { NextRequest } from "next/server";
import { requireAdmin, requireFirebaseUser } from "@/lib/server/auth";
import { error, json } from "@/lib/server/response";
import type { BmidBoxPlatform } from "@/lib/data/bmid-box";

type PreviewType = "video" | "image" | "post" | "link";
type YouTubePreview = {
  videoId: string;
  title: string;
  authorName: string;
  thumbnailUrl: string;
  canonicalUrl: string;
};
type TikTokPreview = {
  videoId: string;
  title: string;
  authorName: string;
  thumbnailUrl: string;
  canonicalUrl: string;
};

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

function cleanSubmittedUrl(value: unknown) {
  return clean(value).replace(/[),.]+$/g, "");
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

function youtubeVideoId(url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") return clean(url.pathname.split("/").filter(Boolean)[0]);
  if (host.includes("youtube.com")) {
    if (url.pathname === "/watch") return clean(url.searchParams.get("v"));
    const segments = url.pathname.split("/").filter(Boolean);
    const markerIndex = segments.findIndex((segment) => ["embed", "shorts", "live"].includes(segment.toLowerCase()));
    if (markerIndex >= 0) return clean(segments[markerIndex + 1]);
  }
  return "";
}

function youtubeCanonicalUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function youtubeFallbackThumbnail(videoId: string) {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

function tiktokVideoId(url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (!host.includes("tiktok.com")) return "";
  const segments = url.pathname.split("/").filter(Boolean);
  const markerIndex = segments.findIndex((segment) => segment.toLowerCase() === "video");
  return markerIndex >= 0 ? clean(segments[markerIndex + 1]) : "";
}

function tiktokCanonicalUrl(url: URL, videoId: string) {
  const segments = url.pathname.split("/").filter(Boolean);
  const author = segments.find((segment) => segment.startsWith("@"));
  if (author && videoId) return `https://www.tiktok.com/${author}/video/${encodeURIComponent(videoId)}`;
  return `https://www.tiktok.com${url.pathname}`;
}

function isGenericYouTubeText(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "youtube" ||
    normalized === "- youtube" ||
    normalized === "youtube - youtube" ||
    normalized.includes("enjoy the videos and music you love")
  );
}

function isGenericTikTokText(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "tiktok" ||
    normalized === "tiktok - make your day" ||
    normalized === "make your day" ||
    normalized.includes("make your day")
  );
}

async function fetchYouTubePreview(url: URL, signal: AbortSignal): Promise<YouTubePreview | null> {
  const videoId = youtubeVideoId(url);
  if (!videoId) return null;

  const canonicalUrl = youtubeCanonicalUrl(videoId);
  const fallback: YouTubePreview = {
    videoId,
    title: "",
    authorName: "",
    thumbnailUrl: youtubeFallbackThumbnail(videoId),
    canonicalUrl,
  };

  try {
    const oembed = new URL("https://www.youtube.com/oembed");
    oembed.searchParams.set("url", canonicalUrl);
    oembed.searchParams.set("format", "json");

    const resp = await fetch(oembed.toString(), {
      headers: {
        accept: "application/json",
        "user-agent": "BiomeDashboardSocialPreview/1.0",
      },
      signal,
    });
    if (!resp.ok) return fallback;

    const data = await resp.json() as Record<string, unknown>;
    return {
      ...fallback,
      title: clean(data.title),
      authorName: clean(data.author_name),
      thumbnailUrl: clean(data.thumbnail_url) || fallback.thumbnailUrl,
    };
  } catch {
    return fallback;
  }
}

async function fetchTikTokPreview(url: URL, signal: AbortSignal): Promise<TikTokPreview | null> {
  const videoId = tiktokVideoId(url);
  if (!videoId) return null;

  const canonicalUrl = tiktokCanonicalUrl(url, videoId);
  try {
    const oembed = new URL("https://www.tiktok.com/oembed");
    oembed.searchParams.set("url", canonicalUrl);

    const resp = await fetch(oembed.toString(), {
      headers: {
        accept: "application/json",
        "user-agent": "BiomeDashboardSocialPreview/1.0",
      },
      signal,
    });
    if (!resp.ok) return null;

    const data = await resp.json() as Record<string, unknown>;
    return {
      videoId,
      title: clean(data.title),
      authorName: clean(data.author_name),
      thumbnailUrl: clean(data.thumbnail_url),
      canonicalUrl,
    };
  } catch {
    return null;
  }
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

  const rawUrl = cleanSubmittedUrl(body.url);
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
    const youtubePreview = platform === "youtube" ? await fetchYouTubePreview(parsed, controller.signal) : null;
    const tiktokPreview = platform === "tiktok" ? await fetchTikTokPreview(parsed, controller.signal) : null;
    if (tiktokPreview) {
      return json({
        success: true,
        data: {
          platform,
          type: "video",
          title: tiktokPreview.title,
          caption: tiktokPreview.title,
          description: tiktokPreview.title,
          authorName: tiktokPreview.authorName,
          thumbnailUrl: tiktokPreview.thumbnailUrl,
          videoUrl: null,
          embedUrl: null,
          canonicalUrl: tiktokPreview.canonicalUrl,
          externalUrl: parsed.toString(),
          status: "ready",
        },
      });
    }

    const resp = await fetch(parsed.toString(), {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "BiomeDashboardSocialPreview/1.0",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (resp.status === 401 || resp.status === 403 || resp.status === 404) {
      if (youtubePreview) {
        return json({
          success: true,
          data: {
            platform,
            type: "video",
            title: youtubePreview.title,
            caption: "",
            description: "",
            authorName: youtubePreview.authorName,
            thumbnailUrl: youtubePreview.thumbnailUrl,
            videoUrl: null,
            embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(youtubePreview.videoId)}`,
            canonicalUrl: youtubePreview.canonicalUrl,
            externalUrl: parsed.toString(),
            status: "ready",
          },
        });
      }
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
      if (youtubePreview) {
        return json({
          success: true,
          data: {
            platform,
            type: "video",
            title: youtubePreview.title,
            caption: "",
            description: "",
            authorName: youtubePreview.authorName,
            thumbnailUrl: youtubePreview.thumbnailUrl,
            videoUrl: null,
            embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(youtubePreview.videoId)}`,
            canonicalUrl: youtubePreview.canonicalUrl,
            externalUrl: parsed.toString(),
            status: "ready",
          },
        });
      }
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
    const resolvedTitle =
      platform === "youtube" && isGenericYouTubeText(title)
        ? youtubePreview?.title || ""
        : platform === "tiktok" && isGenericTikTokText(title)
          ? ""
        : title || youtubePreview?.title || "";
    const resolvedDescription =
      platform === "youtube" && isGenericYouTubeText(description)
        ? ""
        : platform === "tiktok" && isGenericTikTokText(description)
          ? ""
        : description;
    const resolvedThumbnailUrl = thumbnailUrl || youtubePreview?.thumbnailUrl || "";
    const resolvedCanonical = youtubePreview?.canonicalUrl || canonical;
    const resolvedAuthor = pickAuthor(meta) || youtubePreview?.authorName || "";
    const resolvedEmbedUrl =
      embedUrl ||
      (youtubePreview ? `https://www.youtube.com/embed/${encodeURIComponent(youtubePreview.videoId)}` : null);

    if (!resolvedTitle && !resolvedDescription && !resolvedThumbnailUrl) {
      return json({
        success: true,
        data: {
          platform,
          type: "post",
          canonicalUrl: resolvedCanonical,
          externalUrl: parsed.toString(),
          status: "unavailable",
        },
      });
    }

    return json({
      success: true,
      data: {
        platform,
        type: inferType(platform, new URL(resolvedCanonical || base.toString()), meta, html),
        title: resolvedTitle,
        caption: resolvedDescription,
        description: resolvedDescription,
        authorName: resolvedAuthor,
        thumbnailUrl: resolvedThumbnailUrl,
        videoUrl: videoUrl || null,
        embedUrl: resolvedEmbedUrl,
        canonicalUrl: resolvedCanonical,
        externalUrl: parsed.toString(),
        status: "ready",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return error("preview_timeout", 504, { detail: "Preview request timed out." });
    }
    if (platform === "youtube") {
      const videoId = youtubeVideoId(parsed);
      if (videoId) {
        return json({
          success: true,
          data: {
            platform,
            type: "video",
            title: "",
            caption: "",
            description: "",
            authorName: "",
            thumbnailUrl: youtubeFallbackThumbnail(videoId),
            videoUrl: null,
            embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`,
            canonicalUrl: youtubeCanonicalUrl(videoId),
            externalUrl: parsed.toString(),
            status: "ready",
          },
        });
      }
    }
    return error("preview_failed", 502, {
      detail: "Preview could not be loaded. You can still enter the information manually.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
