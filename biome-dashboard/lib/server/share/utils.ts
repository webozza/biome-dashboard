
export function escapeHtml(str: unknown = ""): string {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function env(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === null || String(v).trim() === ""
    ? fallback
    : String(v).trim();
}

export function makeAbsoluteUrl(url: string, fallbackBase = ""): string {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!fallbackBase) return raw;
  const base = fallbackBase.replace(/\/$/, "");
  const suffix = raw.startsWith("/") ? raw : `/${raw}`;
  return `${base}${suffix}`;
}

export function normalizeUrlParam(value: string | null | undefined): string {
  let out = String(value || "").trim();
  if (!out) return "";
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(out);
      if (decoded === out) break;
      out = decoded;
    } catch {
      break;
    }
  }
  return out.replaceAll("&amp;", "&");
}

export function ogProxyUrl(originalUrl: string): string {
  if (!originalUrl) return "";
  return `https://wsrv.nl/?url=${encodeURIComponent(originalUrl)}&w=1200&h=630&fit=cover&a=center&output=jpg&q=85`;
}

export function getBaseUrl(req: Request): string {
  const forced = env("PUBLIC_BASE_URL", "");
  if (forced) return forced.replace(/\/$/, "");
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (/localhost|127\.0\.0\.1/i.test(host) ? "http" : "https");
  return `${proto}://${host}`.replace(/\/$/, "");
}
