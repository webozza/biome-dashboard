import { google, type Auth } from "googleapis";
import { db } from "@/lib/server/firebase";

export type GmailConnection = {
  email: string;
  refreshToken: string;
  accessToken?: string | null;
  tokenExpiresAt?: string | null;
  connectedAt?: string;
  connectedBy?: string | null;
};

const DOC_PATH = "adminSettings/gmail";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export function getOAuthConfig() {
  const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
  const redirectUri = (process.env.GOOGLE_OAUTH_REDIRECT_URI || "").trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function createOAuthClient(): Auth.OAuth2Client | null {
  const cfg = getOAuthConfig();
  if (!cfg) return null;
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

export function buildAuthUrl(state: string): string | null {
  const client = createOAuthClient();
  if (!client) return null;
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCode(code: string): Promise<GmailConnection | null> {
  const client = createOAuthClient();
  if (!client) return null;
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Disconnect the previous consent from your Google Account and try again with prompt=consent."
    );
  }
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const userinfo = await oauth2.userinfo.get();
  const email = userinfo.data.email || "";
  if (!email) throw new Error("Could not read email from Google userinfo response.");

  return {
    email,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? null,
    tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
  };
}

export async function saveConnection(conn: GmailConnection, actorUid: string | null) {
  await db()
    .doc(DOC_PATH)
    .set(
      {
        ...conn,
        connectedAt: new Date().toISOString(),
        connectedBy: actorUid ?? null,
      },
      { merge: true }
    );
}

export async function loadConnection(): Promise<GmailConnection | null> {
  const snap = await db().doc(DOC_PATH).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<GmailConnection> | undefined;
  if (!data?.refreshToken || !data.email) return null;
  return {
    email: data.email,
    refreshToken: data.refreshToken,
    accessToken: data.accessToken ?? null,
    tokenExpiresAt: data.tokenExpiresAt ?? null,
    connectedAt: data.connectedAt,
    connectedBy: data.connectedBy ?? null,
  };
}

export async function clearConnection() {
  await db().doc(DOC_PATH).delete();
}

export async function getAuthedClient(): Promise<{ client: Auth.OAuth2Client; email: string } | null> {
  const conn = await loadConnection();
  if (!conn) return null;
  const client = createOAuthClient();
  if (!client) return null;
  client.setCredentials({ refresh_token: conn.refreshToken });

  try {
    const { token } = await client.getAccessToken();
    if (token) {
      client.setCredentials({ refresh_token: conn.refreshToken, access_token: token });
    }
  } catch {
    return null;
  }

  return { client, email: conn.email };
}

export async function sendGmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  replyTo?: string;
}): Promise<boolean> {
  const authed = await getAuthedClient();
  if (!authed) return false;

  const boundary = "biome_" + Math.random().toString(36).slice(2);
  const headers = [
    `From: "${opts.fromName}" <${authed.email}>`,
    `To: ${opts.to}`,
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
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return true;
}

function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}
