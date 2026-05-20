import { google, type Auth } from "googleapis";
import { db } from "@/lib/server/firebase";

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
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const SCOPES = [
  GMAIL_SEND_SCOPE,
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export type GmailSendResult =
  | { ok: true }
  | { ok: false; code: "not_connected" | "missing_scope" | "api_disabled" | "send_failed"; error: string };

export function getOAuthConfig() {
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
    include_granted_scopes: false,
  });
}

function parseScopes(scope: string | string[] | null | undefined): string[] {
  if (Array.isArray(scope)) return scope;
  return String(scope || "")
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
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
    scopes: parseScopes(tokens.scope),
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
    scopes: Array.isArray(data.scopes) ? data.scopes : [],
    connectedAt: data.connectedAt,
    connectedBy: data.connectedBy ?? null,
  };
}

export async function clearConnection() {
  await db().doc(DOC_PATH).delete();
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
      const tokenInfo = await client.getTokenInfo(token);
      const scopes = parseScopes(tokenInfo.scopes);
      if (!scopes.includes(GMAIL_SEND_SCOPE)) {
        console.error("[gmail] access token is missing gmail.send scope", { scopes });
        return null;
      }
    } else {
      console.error("[gmail] getAccessToken returned empty token");
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
}): Promise<GmailSendResult> {
  const authed = await getAuthedClient();
  if (!authed) {
    console.error("[gmail] sendGmail failed: could not get authed client");
    return {
      ok: false,
      code: "not_connected",
      error: "Gmail is not connected or the stored token is missing the gmail.send scope. Disconnect and connect Gmail again.",
    };
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
    console.log("[gmail] Attempting to send message to", opts.to);
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    console.log("[gmail] Message sent successfully");
    return { ok: true };
  } catch (e) {
    console.error("[gmail] API call failed during send", e);
    const message = String((e as Error).message || "");
    const lowerMessage = message.toLowerCase();
    const responseData = (e as { response?: { data?: unknown } }).response?.data;
    const lowerResponse = JSON.stringify(responseData || "").toLowerCase();
    const scopeError =
      lowerMessage.includes("insufficient authentication scopes") ||
      lowerResponse.includes("insufficient authentication scopes");
    const apiDisabled =
      lowerMessage.includes("gmail api has not been used") ||
      (lowerMessage.includes("gmail api") && lowerMessage.includes("disabled")) ||
      lowerResponse.includes("service_disabled");
    return {
      ok: false,
      code: scopeError ? "missing_scope" : apiDisabled ? "api_disabled" : "send_failed",
      error: scopeError
        ? "Gmail token is missing the gmail.send scope. Disconnect and connect Gmail again."
        : apiDisabled
          ? "Gmail API is disabled for this Google Cloud project. Enable gmail.googleapis.com and retry."
        : message || "Gmail API send failed",
    };
  }
}

function encodeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}
