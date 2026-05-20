import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { sendGmail, loadConnection } from "./gmail";

admin.initializeApp();

setGlobalOptions({ region: "asia-southeast1" });

const DASHBOARD_URL = (process.env.PUBLIC_BASE_URL || "https://app.biome-aura.com/").replace(/\/+$/, "");

type AdminRequestType = "Verification" | "Content" | "BMID Box";

function stringValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function nestedStringValue(data: Record<string, unknown>, key: string, nestedKey: string): string {
  const nested = data[key];
  if (!nested || typeof nested !== "object") return "";
  return stringValue((nested as Record<string, unknown>)[nestedKey]);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function adminEmailFallbacks(): string[] {
  return (process.env.ADMIN_NOTIFY_EMAILS || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function primaryAdminInbox(): string {
  return (process.env.ADMIN_REQUEST_TO_EMAIL || "admin@biome-aura.com").trim();
}

function requestAdminCc(): string[] {
  const primary = primaryAdminInbox().toLowerCase();
  return Array.from(new Set(adminEmailFallbacks())).filter((email) => email.toLowerCase() !== primary);
}

function logoUrl(): string {
  return (process.env.SMTP_LOGO_URL || `${DASHBOARD_URL}/icon.png`).trim();
}

function detailRows(details: string): { label: string; value: string }[] {
  return details
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) return { label: "Detail", value: line };
      return {
        label: line.slice(0, separator).trim() || "Detail",
        value: line.slice(separator + 1).trim() || "N/A",
      };
    });
}

function detailsTable(rows: { label: string; value: string }[]): string {
  return rows
    .map(
      (row) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;font:700 11px Arial,sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:.08em;width:38%;">
            ${escapeHtml(row.label)}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;font:700 14px Arial,sans-serif;color:#0f172a;text-align:right;word-break:break-word;">
            ${escapeHtml(row.value)}
          </td>
        </tr>
      `
    )
    .join("");
}

function detailValue(rows: { label: string; value: string }[], ...labels: string[]): string {
  const normalized = labels.map((label) => label.toLowerCase());
  return rows.find((row) => normalized.includes(row.label.toLowerCase()))?.value || "";
}

function detailCard(label: string, value: string, options?: { wide?: boolean; muted?: boolean }): string {
  return `
    <td width="${options?.wide ? "100%" : "50%"}" style="padding:6px;${options?.wide ? "" : "vertical-align:top;"}">
      <div style="border:1px solid #e5e7eb;background:${options?.muted ? "#f8fafc" : "#ffffff"};border-radius:14px;padding:14px 16px;">
        <div style="font:800 10px Arial,sans-serif;color:#64748b;text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px;">
          ${escapeHtml(label)}
        </div>
        <div style="font:700 14px Arial,sans-serif;color:#0f172a;line-height:1.45;word-break:break-word;">
          ${escapeHtml(value || "N/A")}
        </div>
      </div>
    </td>
  `;
}

function contentDetailsLayout(rows: { label: string; value: string }[], type: AdminRequestType): string {
  const requestId = detailValue(rows, "Request ID");
  const submittedBy = detailValue(rows, "Submitted By");
  const userEmail = detailValue(rows, "User Email");
  const status = detailValue(rows, "Status");
  const sourcePlatform = detailValue(rows, "Source Platform", "Platform", "Box Platform");
  const sourceUrl = detailValue(rows, "Source URL", "URL");
  const requestType = detailValue(rows, "Type", "Request Type");
  const content = detailValue(rows, "Content", "Post Preview", "Description", "Preview");
  const title = detailValue(rows, "Title", "Post Title", "Preview");
  const remainingRows = rows.filter(
    (row) =>
      ![
        "Request Type",
        "Request ID",
        "Submitted By",
        "User Email",
        "Status",
        "Type",
        "Platform",
        "Source Platform",
        "Box Platform",
        "URL",
        "Source URL",
        "Title",
        "Post Title",
        "Content",
        "Post Preview",
        "Description",
        "Preview",
      ].includes(row.label)
  );

  const mainLeftLabel = type === "Content" ? "Content" : "Source Platform";
  const mainLeftValue = type === "Content" ? content || title || "Not provided" : sourcePlatform || "Not provided";
  const mainRightLabel = type === "Content" ? "Request Type" : "Source URL";
  const mainRightValue = type === "Content" ? requestType || type : sourceUrl || "Not provided";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding:18px 18px 16px;border:1px solid #d1fae5;background:#ecfdf5;border-radius:18px;">
          <div style="font:800 11px Arial,sans-serif;color:#059669;text-transform:uppercase;letter-spacing:.14em;margin-bottom:10px;">
            ${escapeHtml(type)} review package
          </div>
          <div style="font:800 22px Arial,sans-serif;color:#0f172a;line-height:1.2;letter-spacing:-.02em;">
            ${escapeHtml(title || `${type} request from ${submittedBy || "a user"}`)}
          </div>
          <div style="font:500 13px Arial,sans-serif;color:#475569;line-height:1.6;margin-top:8px;">
            Submitted by <strong style="color:#0f172a;">${escapeHtml(submittedBy || "Unknown user")}</strong>${userEmail ? ` (${escapeHtml(userEmail)})` : ""}.
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding-top:14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              ${detailCard("Request ID", requestId, { muted: true })}
              ${detailCard("Status", status || "Pending review", { muted: true })}
            </tr>
            <tr>
              ${detailCard(mainLeftLabel, mainLeftValue, { muted: true })}
              ${detailCard(mainRightLabel, mainRightValue, { muted: true })}
            </tr>
          </table>
        </td>
      </tr>
      ${
        remainingRows.length
          ? `<tr>
              <td style="padding-top:8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  ${remainingRows
                    .map((row) => `<tr>${detailCard(row.label, row.value, { wide: true, muted: true })}</tr>`)
                    .join("")}
                </table>
              </td>
            </tr>`
          : ""
      }
    </table>
  `;
}

function requestDetailsLayout(rows: { label: string; value: string }[], type: AdminRequestType): string {
  if (type === "Verification") {
    return `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        ${detailsTable(rows)}
      </table>
    `;
  }
  return contentDetailsLayout(rows, type);
}

function renderAdminRequestEmail(opts: {
  requestId: string;
  type: AdminRequestType;
  userName: string;
  userEmail?: string;
  details: string;
}, dashboardLink: string): string {
  const rows = [
    { label: "Request Type", value: opts.type },
    { label: "Request ID", value: opts.requestId },
    { label: "Submitted By", value: opts.userName },
    { label: "User Email", value: opts.userEmail || "Not provided" },
    ...detailRows(opts.details),
  ];

  return `
    <div style="margin:0;padding:0;background:#f8fafc;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
              <tr>
                <td align="center" style="padding:28px 24px 12px;">
                  <img src="${escapeHtml(logoUrl())}" alt="Biome Aura" height="44" style="display:block;height:44px;max-width:220px;border:0;outline:0;text-decoration:none;" />
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0 28px 20px;">
                  <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#ecfdf5;border:1px solid #a7f3d0;font:800 11px Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#059669;">
                    New ${escapeHtml(opts.type)} Request
                  </div>
                  <h1 style="margin:18px 0 8px;font:800 28px Arial,sans-serif;line-height:1.15;color:#0f172a;letter-spacing:-.03em;">
                    Review required
                  </h1>
                  <p style="margin:0;font:500 14px Arial,sans-serif;line-height:1.7;color:#475569;">
                    A new ${escapeHtml(opts.type.toLowerCase())} request was submitted. Review the request summary and open the dashboard when ready.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px 24px;">
                  ${requestDetailsLayout(rows, opts.type)}
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:4px 28px 32px;">
                  <a href="${escapeHtml(dashboardLink)}" target="_blank" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;border-radius:12px;padding:14px 26px;font:800 14px Arial,sans-serif;">
                    Review Request
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;font:500 12px Arial,sans-serif;color:#94a3b8;">
              Sent automatically from Biome Aura Admin.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Common notification handler
 */
async function notifyAdmin(opts: {
  requestId: string;
  type: AdminRequestType;
  userName: string;
  userEmail?: string;
  details: string;
  dashboardPath: string;
  docPath: string;
}) {
  const logContext = {
    requestId: opts.requestId,
    type: opts.type,
    docPath: opts.docPath,
    dashboardPath: opts.dashboardPath,
  };
  console.log("[admin-email][function][request-created] started", logContext);

  const db = admin.firestore();
  const docRef = db.doc(opts.docPath);
  const snap = await docRef.get();
  
  if (!snap.exists) {
    console.warn("[admin-email][function][request-created] skipped_missing_doc", logContext);
    return;
  }
  const data = snap.data() || {};

  // Check if already notified
  if (data.adminNotificationStatus === "sent") {
    console.log("[admin-email][function][request-created] skipped_already_sent", {
      ...logContext,
      status: data.adminNotificationStatus,
    });
    return;
  }

  // Fetch the connected "System Governance" email
  const conn = await loadConnection();
  const connectedEmail = conn?.email;

  const to = primaryAdminInbox();
  const cc = requestAdminCc();

  console.log("[admin-email][function][request-created] recipients_resolved", {
    ...logContext,
    connectedGmail: connectedEmail || null,
    envAdminEmails: adminEmailFallbacks(),
    to,
    cc,
  });

  if (!to) {
    console.warn("[admin-email][function][request-created] failed_no_recipients", logContext);
    return;
  }

  const dashboardLink = `${DASHBOARD_URL}${opts.dashboardPath}`;
  
  const subject = `New ${opts.type} Request - ${opts.userName}`;
  const text = `
A new ${opts.type} request has been submitted.

ID: ${opts.requestId}
User: ${opts.userName}
Email: ${opts.userEmail || "Not provided"}
Details:
${opts.details}

View in Dashboard:
${dashboardLink}
  `.trim();

  const html = renderAdminRequestEmail(opts, dashboardLink);

  try {
    console.log("[admin-email][function][request-created] sending", { ...logContext, to, cc });
    const result = await sendGmail({
      to,
      cc,
      subject,
      html,
      text,
      fromName: "Biome Aura Notifications",
    });

    if (result.ok) {
      console.log("[admin-email][function][request-created] sent", { ...logContext, to, cc });
      await docRef.update({
        adminNotificationStatus: "sent",
        adminNotificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
        adminNotificationRecipients: [to, ...cc],
        adminNotificationTo: to,
        adminNotificationCc: cc,
      });
    } else {
      console.error("[admin-email][function][request-created] send_failed", {
        ...logContext,
        to,
        cc,
        error: result.error,
      });
      await docRef.update({
        adminNotificationStatus: "failed",
        adminNotificationError: result.error,
        adminNotificationRecipients: [to, ...cc],
        adminNotificationTo: to,
        adminNotificationCc: cc,
      });
    }
  } catch (e) {
    console.error("[admin-email][function][request-created] send_exception", {
      ...logContext,
      to,
      cc,
      error: (e as Error).message,
    });
    await docRef.update({
      adminNotificationStatus: "failed",
      adminNotificationError: (e as Error).message,
      adminNotificationRecipients: [to, ...cc],
      adminNotificationTo: to,
      adminNotificationCc: cc,
    });
  }

  console.log("[admin-email][function][request-created] completed", {
    ...logContext,
    to,
    cc,
  });
}

/**
 * Triggers
 */

export const onVerificationRequestCreated = onDocumentCreated("verificationRequests/{id}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const request = data as Record<string, unknown>;

  await notifyAdmin({
    requestId: event.params.id,
    type: "Verification",
    userName: stringValue(request.userName) || stringValue(request.name) || "Unknown User",
    userEmail: stringValue(request.email) || stringValue(request.contactEmail) || undefined,
    details: `Platform: ${stringValue(request.platform) || "N/A"}\nSocial Account: ${stringValue(request.socialAccount) || "N/A"}`,
    dashboardPath: "/dashboard/verification",
    docPath: `verificationRequests/${event.params.id}`,
  });
});

export const onContentRequestCreated = onDocumentCreated("contentRequests/{id}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const request = data as Record<string, unknown>;

  await notifyAdmin({
    requestId: event.params.id,
    type: "Content",
    userName: stringValue(request.userName) || stringValue(request.ownerName) || "Unknown User",
    userEmail: stringValue(request.email) || stringValue(request.ownerEmail) || undefined,
    details: `Title: ${stringValue(request.postTitle) || "N/A"}\nType: ${stringValue(request.type) || "N/A"}\nPlatform: ${stringValue(request.platform) || "N/A"}`,
    dashboardPath: `/dashboard/content/${event.params.id}`,
    docPath: `contentRequests/${event.params.id}`,
  });
});

export const onBmidBoxRequestCreated = onDocumentCreated("bmidBoxRequests/{id}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const request = data as Record<string, unknown>;

  await notifyAdmin({
    requestId: event.params.id,
    type: "BMID Box",
    userName:
      stringValue(request.userName) ||
      stringValue(request.ownerName) ||
      nestedStringValue(request, "ownerSnapshot", "name") ||
      "Unknown User",
    userEmail:
      stringValue(request.email) ||
      stringValue(request.ownerEmail) ||
      nestedStringValue(request, "ownerSnapshot", "email") ||
      undefined,
    details: `Platform: ${stringValue(request.platform) || stringValue(request.sourcePlatform) || "N/A"}\nStatus: ${stringValue(request.status) || stringValue(request.currentStatus) || "N/A"}`,
    dashboardPath: `/dashboard/bmid-box/requests/${event.params.id}`,
    docPath: `bmidBoxRequests/${event.params.id}`,
  });
});
