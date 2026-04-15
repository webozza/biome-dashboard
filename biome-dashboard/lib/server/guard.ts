import type { NextRequest } from "next/server";
import { requireAdmin } from "./auth";
import { error } from "./response";

export function guard(req: NextRequest) {
  const check = requireAdmin(req);
  if (!check.ok) return error("unauthorized", 401, { reason: check.reason });
  return null;
}
