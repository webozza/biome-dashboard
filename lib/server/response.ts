import { NextResponse } from "next/server";

export const json = <T>(data: T, status = 200) =>
  NextResponse.json(data, { status });

export const error = (message: string, status = 400, extra?: Record<string, unknown>) =>
  NextResponse.json({ error: message, ...(extra || {}) }, { status });

export function parsePagination(url: URL) {
  const defaultSize = Number(process.env.DEFAULT_PAGE_SIZE || 25);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || defaultSize));
  const cursor = url.searchParams.get("cursor") || undefined;
  return { limit, cursor };
}
