import { NextRequest } from "next/server";
import { error, json } from "@/lib/server/response";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", 400);
  }

  const expectedEmail = (process.env.ADMIN_EMAIL || "").trim();
  const expectedPw = (process.env.ADMIN_PASSWORD || "").trim();
  const token = (process.env.ADMIN_API_TOKEN || "").trim();

  if (!expectedEmail || !expectedPw || !token) return error("server_not_configured", 500);
  if (body.email !== expectedEmail || body.password !== expectedPw) {
    return error("invalid_credentials", 401);
  }

  return json({
    token,
    user: { email: expectedEmail, role: "admin", name: "Root Admin" },
  });
}
