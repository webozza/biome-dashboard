import * as admin from "firebase-admin";
import { google, Auth } from "googleapis";

export type GmailConnection = {
  email: string;
  refreshToken: string;
  accessToken?: string | null;
  tokenExpiresAt?: string | null;
  scopes?: string[];
  connectedAt?: string;
  connectedBy?: string | null;
};

const DOC_PATH = "adminSettings/gmail";

export async function loadConnection(): Promise<GmailConnection | null> {
  const snap = await admin.firestore().doc(DOC_PATH).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<GmailConnection> | undefined;
  if (!data?.refreshToken || !data.email) return null;
  return {
    email: data.email,
    refreshToken: data.refreshToken,
    accessToken: data.accessToken ?? null,
    tokenExpiresAt: data.tokenExpiresAt ?? null,
    scopes: Array.isArray(data.scopes) ? data.scopes : [],
    connectedAt: data.connectedAt,
    connectedBy: data.connectedBy ?? null,
  };
}

export function createOAuthClient(): Auth.OAuth2Client | null {
  const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
  const redirectUri = (process.env.GOOGLE_OAUTH_REDIRECT_URI || "").trim();
  
  if (!clientId || !clientSecret || !redirectUri) {
    console.error("[gmail] Missing OAuth environment variables", { 
      hasClientId: !!clientId, 
      hasClientSecret: !!clientSecret, 
      hasRedirectUri: !!redirectUri 
    });
    return null;
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getAuthedClient(): Promise<{ client: Auth.OAuth2Client; email: string } | null> {
  const conn = await loadConnection();
  if (!conn) {
    console.error("[gmail] loadConnection failed - no stored credentials found");
    return null;
  }
  
  const client = createOAuthClient();
  if (!client) {
    console.error("[gmail] createOAuthClient failed - check environment variables");
    return null;
  }
  
  client.setCredentials({ refresh_token: conn.refreshToken });

  try {
    const { token } = await client.getAccessToken();
    if (token) {
      client.setCredentials({ refresh_token: conn.refreshToken, access_token: token });
    } else {
      console.error("[gmail] getAccessToken returned empty token");
      return null;
    }
  } catch (e) {
    console.error("[gmail] getAccessToken failed", (e as Error).message);
    return null;
  }

  return { client, email: conn.email };
}

export async function sendGmail(opts: {
  to: string;
  cc?: string | string[];
  subject: string;
  html: string;
  text: string;
  fromName: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const authed = await getAuthedClient();
  if (!authed) {
    return { ok: false, error: "Gmail not connected or auth failed" };
  }

  const boundary = "biome_" + Math.random().toString(36).slice(2);
  const headers = [
    `From: "${opts.fromName}" <${authed.email}>`,
    `To: ${opts.to}`,
    opts.cc
      ? `Cc: ${Array.isArray(opts.cc) ? opts.cc.filter(Boolean).join(", ") : opts.cc}`
      : null,
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : null,
    `Subject: ${encodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
    .filter(Boolean)
    .join("\r\n");

  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    opts.html,
    `--${boundary}--`,
  ].join("\r\n");

  const raw = Buffer.from(headers + "\r\n\r\n" + body, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const gmail = google.gmail({ version: "v1", auth: authed.client });
  try {
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    return { ok: true };
  } catch (e) {
    console.error("[gmail] send failed", e);
    return { ok: false, error: (e as Error).message };
  }
}

function encodeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}
