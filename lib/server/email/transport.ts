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
  await sendRendered(to, rendered, `verification-${kind}`);
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
      const result = await sendGmail({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        fromName: brand.brandName,
        replyTo,
      });
      if (result.ok) {
        console.log(`[email] sent via Gmail OAuth (${gmailConn.email}) to ${to} [${logTag}]`);
        return;
      }
      console.error("[email] Gmail connected but sendGmail returned false", {
        to,
        logTag,
        error: result.error,
        code: result.code,
      });
    } catch (e) {
      console.error("[email] Gmail send failed", {
        to,
        logTag,
        error: (e as Error).message,
      });
    }
  } else {
    console.warn("[email] no Gmail OAuth configured, mail dropped", { to, logTag });
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
}): Promise<{ ok: boolean; transport: "gmail" | "none"; error?: string; fromEmail?: string }> {
  const gmailConn = await loadConnection().catch(() => null);
  const brand = brandConfig(gmailConn?.email);
  const replyTo = gmailConn?.email || (process.env.SMTP_REPLY_TO || "").trim() || undefined;

  if (gmailConn) {
    try {
      const result = await sendGmail({
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        fromName: brand.brandName,
        replyTo,
      });
      if (result.ok) return { ok: true, transport: "gmail", fromEmail: gmailConn.email };
      return { ok: false, transport: "gmail", error: result.error };
    } catch (e) {
      return { ok: false, transport: "gmail", error: (e as Error).message };
    }
  }

  return { ok: false, transport: "none", error: "No Gmail OAuth configured" };
}
