import nodemailer, { type Transporter } from "nodemailer";
import {
  renderApprovedEmail,
  renderRejectedEmail,
  type BrandConfig,
  type VerificationContext,
} from "./templates";
import { loadConnection, sendGmail } from "./gmail-oauth";

let cached: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cached) return cached;
  const host = (process.env.SMTP_HOST || "").trim();
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASSWORD || "").trim();
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = (process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

  cached = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return cached;
}

function brandConfig(overrideSupportEmail?: string | null): BrandConfig {
  const appUrl = (process.env.PUBLIC_BASE_URL || "https://app.biome-aura.com/").trim();
  const fallback = (process.env.SMTP_REPLY_TO || process.env.SMTP_FROM_EMAIL || "").trim();
  return {
    brandName: (process.env.SMTP_FROM_NAME || "Biome Aura").trim(),
    logoUrl: (process.env.SMTP_LOGO_URL || "").trim(),
    appUrl,
    supportEmail: (overrideSupportEmail || fallback).trim(),
  };
}

export async function sendVerificationEmail(
  to: string,
  kind: "approved" | "rejected",
  ctx: VerificationContext
): Promise<void> {
  if (!to) return;

  const gmailConn = await loadConnection().catch(() => null);
  const brand = brandConfig(gmailConn?.email);
  const rendered =
    kind === "approved" ? renderApprovedEmail(brand, ctx) : renderRejectedEmail(brand, ctx);
  const replyTo = gmailConn?.email || (process.env.SMTP_REPLY_TO || "").trim() || undefined;

  if (gmailConn) {
    try {
      const sent = await sendGmail({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        fromName: brand.brandName,
        replyTo,
      });
      if (sent) {
        console.log(`[email] sent via Gmail OAuth (${gmailConn.email}) to ${to}`);
        return;
      }
      console.error("[email] Gmail connected but sendGmail returned false (no fallback)", { to, kind });
    } catch (e) {
      console.error("[email] Gmail send failed (admin Gmail is connected — not falling back to SMTP)", {
        to,
        kind,
        error: (e as Error).message,
      });
    }
    return;
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[email] no mail transport configured (no Gmail connection, no SMTP env)");
    return;
  }

  const fromEmail = (process.env.SMTP_FROM_EMAIL || "").trim();
  try {
    await transporter.sendMail({
      from: `"${brand.brandName}" <${fromEmail}>`,
      to,
      replyTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    console.log(`[email] sent via SMTP (${fromEmail}) to ${to}`);
  } catch (e) {
    console.error("[email] smtp send failed", { to, kind, error: (e as Error).message });
  }
}

export async function sendRawEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; transport: "gmail" | "smtp" | "none"; error?: string; fromEmail?: string }> {
  const gmailConn = await loadConnection().catch(() => null);
  const brand = brandConfig(gmailConn?.email);
  const replyTo = gmailConn?.email || (process.env.SMTP_REPLY_TO || "").trim() || undefined;

  if (gmailConn) {
    try {
      const sent = await sendGmail({
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        fromName: brand.brandName,
        replyTo,
      });
      if (sent) return { ok: true, transport: "gmail", fromEmail: gmailConn.email };
      return { ok: false, transport: "gmail", error: "sendGmail returned false (authed client unavailable)" };
    } catch (e) {
      return { ok: false, transport: "gmail", error: (e as Error).message };
    }
  }

  const transporter = getTransporter();
  if (!transporter) return { ok: false, transport: "none", error: "No mail transport configured" };

  const fromEmail = (process.env.SMTP_FROM_EMAIL || "").trim();
  try {
    await transporter.sendMail({
      from: `"${brand.brandName}" <${fromEmail}>`,
      to: opts.to,
      replyTo,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return { ok: true, transport: "smtp", fromEmail };
  } catch (e) {
    return { ok: false, transport: "smtp", error: (e as Error).message };
  }
}
