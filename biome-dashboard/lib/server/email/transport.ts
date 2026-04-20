import nodemailer, { type Transporter } from "nodemailer";
import {
  renderApprovedEmail,
  renderRejectedEmail,
  type BrandConfig,
  type VerificationContext,
} from "./templates";

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

function brandConfig(): BrandConfig {
  const appUrl = (process.env.PUBLIC_BASE_URL || "https://app.biome-aura.com/").trim();
  return {
    brandName: (process.env.SMTP_FROM_NAME || "Biome Aura").trim(),
    logoUrl: (process.env.SMTP_LOGO_URL || "").trim(),
    appUrl,
    supportEmail: (process.env.SMTP_REPLY_TO || process.env.SMTP_FROM_EMAIL || "").trim(),
  };
}

export async function sendVerificationEmail(
  to: string,
  kind: "approved" | "rejected",
  ctx: VerificationContext
): Promise<void> {
  if (!to) return;
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[email] SMTP not configured, skipping send");
    return;
  }

  const brand = brandConfig();
  const fromEmail = (process.env.SMTP_FROM_EMAIL || "").trim();
  const replyTo = (process.env.SMTP_REPLY_TO || "").trim() || undefined;
  const rendered =
    kind === "approved" ? renderApprovedEmail(brand, ctx) : renderRejectedEmail(brand, ctx);

  try {
    await transporter.sendMail({
      from: `"${brand.brandName}" <${fromEmail}>`,
      to,
      replyTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (e) {
    console.error("[email] send failed", { to, kind, error: (e as Error).message });
  }
}
