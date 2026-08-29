import type { NextRequest } from "next/server";
import { requireFirebaseUser } from "./auth";
import { error } from "./response";
import { auditInputForAdminAction, writeSecurityAuditEvent } from "./security-audit";

export type SecuritySuperadmin = {
  uid: string;
  email: string | null;
  role: "super_admin";
};

function requestIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function requireSecuritySuperadmin(req: NextRequest): Promise<
  | { ok: true; user: SecuritySuperadmin }
  | { ok: false; response: ReturnType<typeof error>; reason: string }
> {
  const check = await requireFirebaseUser(req);
  const ip = requestIp(req);
  const userAgent = req.headers.get("user-agent");

  if (!check.ok) {
    await writeSecurityAuditEvent(
      auditInputForAdminAction({
        eventType: "AUTHENTICATION_FAILURE",
        severity: "WARNING",
        action: "security_route_authentication",
        outcome: "failure",
        ip,
        userAgent,
        reasonCode: check.reason,
      })
    ).catch(() => undefined);
    return {
      ok: false,
      response: error("unauthorized", 401, { reason: check.reason }),
      reason: check.reason,
    };
  }

  if (!check.isAdmin) {
    await writeSecurityAuditEvent(
      auditInputForAdminAction({
        eventType: "ADMIN_ACCESS_DENIED",
        severity: "ERROR",
        action: "security_route_authorization",
        outcome: "denied",
        actorId: check.uid,
        ip,
        userAgent,
        reasonCode: "not_super_admin",
      })
    ).catch(() => undefined);
    return {
      ok: false,
      response: error("forbidden", 403, { reason: "super_admin_required" }),
      reason: "super_admin_required",
    };
  }

  return {
    ok: true,
    user: {
      uid: check.uid,
      email: check.email,
      role: "super_admin",
    },
  };
}

export async function logSecurityView(req: NextRequest, user: SecuritySuperadmin, action: string, recordCount?: number) {
  await writeSecurityAuditEvent(
    auditInputForAdminAction({
      eventType: "ADMIN_SESSION_CREATED",
      severity: "INFO",
      action,
      outcome: "success",
      actorId: user.uid,
      ip: requestIp(req),
      userAgent: req.headers.get("user-agent"),
      recordCount,
    })
  ).catch(() => undefined);
}
