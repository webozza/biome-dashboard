import { NextRequest } from "next/server";
import { guard } from "@/lib/server/guard";
import { error, json } from "@/lib/server/response";
import { sendRawEmail } from "@/lib/server/email/transport";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const g = guard(req);
  if (g) return g;

  let body: { to?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const to = (body.to || "").trim();
  if (!to) return error("missing_to", 400);

  const subject = "Biome Aura — test email";
  const text = `This is a test email from the Biome Aura admin dashboard.\n\nIf you received this, your Gmail connection is working.`;
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 24px auto; padding: 24px; border-radius: 16px; background: #0f0f10; color: #fff;">
      <h2 style="margin:0 0 8px;">Test Email</h2>
      <p style="color:#9ca3af; margin:0 0 16px;">Biome Aura admin dashboard</p>
      <p>If you received this, your connected Gmail account is sending correctly.</p>
    </div>
  `;

  const result = await sendRawEmail({ to, subject, html, text });
  if (!result.ok) {
    return error("send_failed", 500, {
      detail: result.error || "unknown",
      transport: result.transport,
    });
  }
  return json({ ok: true, transport: result.transport, fromEmail: result.fromEmail || null });
}
