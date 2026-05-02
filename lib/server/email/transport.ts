import nodemailer, { type Transporter } from "nodemailer";
import {
  renderApprovedEmail,
  renderRejectedEmail,
  renderContentApprovedEmail,
  renderBoxApprovedEmail,
  renderContentFinalizedEmail,
  renderBoxFinalizedEmail,
  renderPasswordResetOtpEmail,
  type BrandConfig,
  type VerificationContext,
  type ContentApprovalContext,
  type BoxApprovalContext,
  type FinalizationContext,
  type PasswordResetOtpContext,
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
  const overrideLogo = (process.env.SMTP_LOGO_URL || "").trim();
  const defaultLogo = `${appUrl.replace(/\/+$/, "")}/icon.png`;
  return {
    brandName: (process.env.SMTP_FROM_NAME || "Biome Aura").trim(),
    logoUrl: overrideLogo || defaultLogo,
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

async function sendRendered(
  to: string,
  rendered: { subject: string; html: string; text: string },
  logTag: string
): Promise<void> {
  if (!to) return;

  const gmailConn = await loadConnection().catch(() => null);
  const brand = brandConfig(gmailConn?.email);
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
        console.log(`[email] sent via Gmail OAuth (${gmailConn.email}) to ${to} [${logTag}]`);
        return;
      }
      console.error("[email] Gmail connected but sendGmail returned false — falling back to SMTP", {
        to,
        logTag,
      });
    } catch (e) {
      console.error("[email] Gmail send failed — falling back to SMTP", {
        to,
        logTag,
        error: (e as Error).message,
      });
    }
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[email] no mail transport configured (Gmail unavailable, SMTP env missing)");
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
    console.log(`[email] sent via SMTP (${fromEmail}) to ${to} [${logTag}]`);
  } catch (e) {
    console.error("[email] smtp send failed", { to, logTag, error: (e as Error).message });
  }
}

export async function sendContentApprovalEmail(
  to: string,
  ctx: ContentApprovalContext
): Promise<void> {
  if (!to) return;
  const gmailConn = await loadConnection().catch(() => null);
  const brand = brandConfig(gmailConn?.email);
  const rendered = renderContentApprovedEmail(brand, ctx);
  await sendRendered(to, rendered, "content-approved");
}

export async function sendBoxApprovalEmail(
  to: string,
  ctx: BoxApprovalContext
): Promise<void> {
  if (!to) return;
  const gmailConn = await loadConnection().catch(() => null);
  const brand = brandConfig(gmailConn?.email);
  const rendered = renderBoxApprovedEmail(brand, ctx);
  await sendRendered(to, rendered, "box-approved");
}

export async function sendContentFinalizedEmail(
  to: string,
  ctx: FinalizationContext
): Promise<void> {
  if (!to) return;
  const gmailConn = await loadConnection().catch(() => null);
  const brand = brandConfig(gmailConn?.email);
  const rendered = renderContentFinalizedEmail(brand, ctx);
  await sendRendered(to, rendered, `content-finalized-${ctx.outcome}`);
}

export async function sendBoxFinalizedEmail(
  to: string,
  ctx: FinalizationContext
): Promise<void> {
  if (!to) return;
  const gmailConn = await loadConnection().catch(() => null);
  const brand = brandConfig(gmailConn?.email);
  const rendered = renderBoxFinalizedEmail(brand, ctx);
  await sendRendered(to, rendered, `box-finalized-${ctx.outcome}`);
}

export async function sendPasswordResetOtpEmail(
  to: string,
  ctx: PasswordResetOtpContext
): Promise<void> {
  if (!to) return;
  const gmailConn = await loadConnection().catch(() => null);
  const brand = brandConfig(gmailConn?.email);
  const rendered = renderPasswordResetOtpEmail(brand, ctx);
  await sendRendered(to, rendered, "password-reset-otp");
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
