import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { sendGmail, loadConnection } from "./gmail";

admin.initializeApp();

setGlobalOptions({ region: "asia-southeast1" });

const DASHBOARD_URL = (process.env.PUBLIC_BASE_URL || "https://dashboard.biome-aura.com").replace(/\/$/, "");

function stringValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function nestedStringValue(data: Record<string, unknown>, key: string, nestedKey: string): string {
  const nested = data[key];
  if (!nested || typeof nested !== "object") return "";
  return stringValue((nested as Record<string, unknown>)[nestedKey]);
}

/**
 * Common notification handler
 */
async function notifyAdmin(opts: {
  requestId: string;
  type: "Verification" | "Content" | "BMID Box";
  userName: string;
  userEmail?: string;
  details: string;
  dashboardPath: string;
  docPath: string;
}) {
  const db = admin.firestore();
  const docRef = db.doc(opts.docPath);
  const snap = await docRef.get();
  
  if (!snap.exists) return;
  const data = snap.data() || {};

  // Check if already notified
  if (data.adminNotificationStatus === "sent") {
    console.log(`[notify] skipping ${opts.requestId}, status is ${data.adminNotificationStatus}`);
    return;
  }

  // Fetch the connected "System Governance" email
  const conn = await loadConnection();
  const connectedEmail = conn?.email;

  const adminEmails = (process.env.ADMIN_NOTIFY_EMAILS || process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);
  
  // Add connected email if not already in the list
  if (connectedEmail && !adminEmails.includes(connectedEmail)) {
    adminEmails.push(connectedEmail);
  }

  if (adminEmails.length === 0) {
    console.warn("[notify] No admin emails found. Please connect a Gmail account in the dashboard or set ADMIN_NOTIFY_EMAILS.");
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

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #333;">New ${opts.type} Request</h2>
      <p>A new ${opts.type.toLowerCase()} request has been submitted and is awaiting review.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">User</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${opts.userName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Email</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${opts.userEmail || "Not provided"}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Request ID</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><code>${opts.requestId}</code></td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; vertical-align: top;">Details</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; white-space: pre-wrap;">${opts.details}</td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${dashboardLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Review Request
        </a>
      </div>
      
      <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
        Sent automatically from Biome Aura Cloud Functions.
      </p>
    </div>
  `;

  for (const to of adminEmails) {
    try {
      const result = await sendGmail({
        to,
        subject,
        html,
        text,
        fromName: "Biome Aura Notifications",
      });

      if (result.ok) {
        await docRef.update({
          adminNotificationStatus: "sent",
          adminNotificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await docRef.update({
          adminNotificationStatus: "failed",
          adminNotificationError: result.error,
        });
      }
    } catch (e) {
      console.error(`[notify] failed to send to ${to}`, e);
      await docRef.update({
        adminNotificationStatus: "failed",
        adminNotificationError: (e as Error).message,
      });
    }
  }
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
