import crypto from "node:crypto";
import { google } from "googleapis";
import { admin, db } from "./firebase";
import type {
  SecurityAuditCategory,
  SecurityAuditEvent,
  SecurityAuditEventType,
  SecurityAuditOutcome,
  SecurityAuditProvider,
  SecurityAuditSeverity,
} from "@/lib/security-audit-types";

type SecurityAuditInput = Omit<
  SecurityAuditEvent,
  "schema" | "eventId" | "occurredAt" | "environment" | "backendSource" | "requestId"
> & {
  actorId?: string | null;
  ip?: string | null;
  requestId?: string | null;
  eventId?: string | null;
  unsafeContext?: Record<string, unknown>;
};

export const PROHIBITED_FIELD_PATTERN =
  /(token|secret|authorization|cookie|oauth|code|firebase.?id|service.?account|email|caption|media.?url|profile|name|raw|body|payload)/i;

export const TOKEN_VALUE_PATTERN =
  /(Bearer\s+[A-Za-z0-9._-]+|EA[A-Za-z0-9]{20,}|ya29\.[A-Za-z0-9._-]+|AIza[0-9A-Za-z_-]{20,})/;

function environment(): "production" | "staging" {
  if (process.env.SECURITY_AUDIT_ENVIRONMENT === "production") return "production";
  if (process.env.SECURITY_AUDIT_ENVIRONMENT === "staging") return "staging";
  return process.env.NODE_ENV === "production" ? "production" : "staging";
}

function auditHashKey(): string {
  return process.env.SECURITY_AUDIT_HASH_KEY || process.env.GOOGLE_CLOUD_PROJECT || "local-security-audit-key";
}

function googleCloudProjectId(): string {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "project-v-f2d15"
  );
}

export function hashAuditIdentifier(value: string | null | undefined): string | undefined {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHmac("sha256", auditHashKey()).update(normalized).digest("hex").slice(0, 32);
}

export function userAgentFamily(userAgent: string | null | undefined): string | undefined {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return undefined;
  if (ua.includes("chrome")) return "chrome";
  if (ua.includes("safari")) return "safari";
  if (ua.includes("firefox")) return "firefox";
  if (ua.includes("okhttp")) return "okhttp";
  if (ua.includes("curl")) return "curl";
  return "other";
}

function assertNoUnsafeContext(unsafeContext?: Record<string, unknown>) {
  if (!unsafeContext) return;
  const serialized = JSON.stringify(unsafeContext);
  if (TOKEN_VALUE_PATTERN.test(serialized)) {
    throw new Error("Security audit event rejected token-like value.");
  }
  for (const key of Object.keys(unsafeContext)) {
    if (PROHIBITED_FIELD_PATTERN.test(key)) {
      throw new Error(`Security audit event rejected prohibited field: ${key}`);
    }
  }
}

export function createSecurityAuditEvent(input: SecurityAuditInput): SecurityAuditEvent {
  assertNoUnsafeContext(input.unsafeContext);
  const event: SecurityAuditEvent = {
    schema: "biome.security.v1",
    eventId: input.eventId || crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    environment: environment(),
    backendSource: "dashboard-vps",
    category: input.category,
    eventType: input.eventType,
    severity: input.severity,
    provider: input.provider,
    action: input.action,
    outcome: input.outcome,
    platformData: input.platformData,
    actorRole: input.actorRole || "super_admin",
    requestId: input.requestId || crypto.randomUUID(),
    synthetic: input.synthetic,
  };
  const actorIdHash = input.actorIdHash || hashAuditIdentifier(input.actorId);
  const ipHash = input.ipHash || hashAuditIdentifier(input.ip);
  if (actorIdHash) event.actorIdHash = actorIdHash;
  if (ipHash) event.ipHash = ipHash;
  if (input.userAgentFamily) event.userAgentFamily = input.userAgentFamily;
  if (typeof input.statusCode === "number") event.statusCode = input.statusCode;
  if (typeof input.recordCount === "number") event.recordCount = input.recordCount;
  if (input.reasonCode) event.reasonCode = input.reasonCode;
  return event;
}

export async function writeSecurityAuditEvent(input: SecurityAuditInput): Promise<SecurityAuditEvent> {
  const event = createSecurityAuditEvent(input);
  const logEntry = {
    message: "biome_security_audit_event",
    ...event,
    "jsonPayload.schema": event.schema,
  };
  console.log(JSON.stringify(logEntry));
  await writeGoogleCloudLogEntry(event).catch((error) => {
    console.error("[security-audit] failed to write Google Cloud Logging entry", {
      eventId: event.eventId,
      message: error instanceof Error ? error.message : String(error),
    });
  });
  await db()
    .collection("securityAuditEvents")
    .doc(event.eventId)
    .set({
      ...event,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      retentionDays: 400,
      note: "Sanitized review index for Meta auditlog-22.e.iii. No tokens, secrets, raw Platform Data, emails, names, captions, or media URLs are stored.",
    });
  return event;
}

async function writeGoogleCloudLogEntry(event: SecurityAuditEvent) {
  const projectId = googleCloudProjectId();
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/logging.write"],
  });
  const logging = google.logging({ version: "v2", auth });
  await logging.entries.write({
    requestBody: {
      logName: `projects/${projectId}/logs/biome_security_audit`,
      resource: {
        type: "global",
        labels: {
          project_id: projectId,
        },
      },
      entries: [
        {
          severity: event.severity,
          timestamp: event.occurredAt,
          jsonPayload: {
            message: "biome_security_audit_event",
            ...event,
          },
        },
      ],
    },
  });
}

export function categoryForEventType(eventType: SecurityAuditEventType): SecurityAuditCategory {
  if (eventType === "AUTHENTICATION_FAILURE") return "authentication";
  if (eventType === "ADMIN_ACCESS_DENIED") return "access_control";
  if (eventType === "SECURITY_PIPELINE_TEST") return "security_test";
  if (eventType.startsWith("ADMIN_")) return "admin_activity";
  return "platform_data_access";
}

export function auditInputForAdminAction(opts: {
  eventType: SecurityAuditEventType;
  severity: SecurityAuditSeverity;
  provider?: SecurityAuditProvider;
  action: string;
  outcome: SecurityAuditOutcome;
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  reasonCode?: string;
  recordCount?: number;
  synthetic?: boolean;
}) {
  return {
    category: categoryForEventType(opts.eventType),
    eventType: opts.eventType,
    severity: opts.severity,
    provider: opts.provider || "meta",
    action: opts.action,
    outcome: opts.outcome,
    platformData: true,
    actorId: opts.actorId,
    actorRole: "super_admin" as const,
    ip: opts.ip,
    userAgentFamily: userAgentFamily(opts.userAgent),
    reasonCode: opts.reasonCode,
    recordCount: opts.recordCount,
    synthetic: opts.synthetic ?? false,
  };
}
