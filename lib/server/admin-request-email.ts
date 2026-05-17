import { loadConnection } from "@/lib/server/email/gmail-oauth";
import { sendRawEmail } from "@/lib/server/email/transport";
import { db } from "@/lib/server/firebase";

type AdminRequestType = "Verification" | "Content" | "BMID Box";

type AdminRequestEmailInput = {
  requestId: string;
  type: AdminRequestType;
  userName: string;
  userEmail?: string | null;
  details: string;
  dashboardPath: string;
  docPath: string;
};

const DASHBOARD_URL = (process.env.PUBLIC_BASE_URL || "https://dashboard.biome-aura.com").replace(/\/$/, "");

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function adminEmailFallbacks() {
  return (process.env.ADMIN_NOTIFY_EMAILS || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export async function notifyAdminRequestCreated(opts: AdminRequestEmailInput) {
  const docRef = db().doc(opts.docPath);
  const snap = await docRef.get();
  if (!snap.exists) return { ok: false, reason: "request_not_found" };

  const existing = snap.data() || {};
  if (existing.adminNotificationStatus === "sent") {
    return { ok: true, skipped: true, reason: "already_sent" };
  }

  const conn = await loadConnection().catch(() => null);
  const recipients = Array.from(new Set([conn?.email, ...adminEmailFallbacks()].filter(Boolean) as string[]));
  if (recipients.length === 0) {
    await docRef.set(
      {
        adminNotificationStatus: "failed",
        adminNotificationError: "No connected Gmail/admin recipient configured.",
      },
      { merge: true }
    );
    return { ok: false, reason: "no_admin_email" };
  }

  const dashboardLink = `${DASHBOARD_URL}${opts.dashboardPath}`;
  const subject = `New ${opts.type} Request - ${opts.userName}`;
  const text = [
    `A new ${opts.type} request has been submitted.`,
    "",
    `ID: ${opts.requestId}`,
    `User: ${opts.userName}`,
    `Email: ${opts.userEmail || "Not provided"}`,
    "Details:",
    opts.details,
    "",
    "View in Dashboard:",
    dashboardLink,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
      <h2 style="color: #111827;">New ${escapeHtml(opts.type)} Request</h2>
      <p>A new ${escapeHtml(opts.type.toLowerCase())} request has been submitted and is awaiting review.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">User</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(opts.userName)}</td></tr>
        <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Email</td><td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(opts.userEmail || "Not provided")}</td></tr>
        <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Request ID</td><td style="padding: 10px; border-bottom: 1px solid #eee;"><code>${escapeHtml(opts.requestId)}</code></td></tr>
        <tr><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; vertical-align: top;">Details</td><td style="padding: 10px; border-bottom: 1px solid #eee; white-space: pre-wrap;">${escapeHtml(opts.details)}</td></tr>
      </table>
      <p><a href="${escapeHtml(dashboardLink)}" style="background-color: #10b981; color: white; padding: 12px 18px; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Request</a></p>
    </div>
  `;

  let sentCount = 0;
  let lastError = "";
  for (const to of recipients) {
    const result = await sendRawEmail({ to, subject, html, text });
    if (result.ok) sentCount += 1;
    else lastError = result.error || "send_failed";
  }

  if (sentCount > 0) {
    await docRef.set(
      {
        adminNotificationStatus: "sent",
        adminNotificationSentAt: new Date().toISOString(),
        adminNotificationRecipients: recipients,
      },
      { merge: true }
    );
    return { ok: true, sentCount };
  }

  await docRef.set(
    {
      adminNotificationStatus: "failed",
      adminNotificationError: lastError || "send_failed",
      adminNotificationRecipients: recipients,
    },
    { merge: true }
  );
  return { ok: false, reason: "send_failed", error: lastError };
}
