/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relative) => {
  const fullPath = path.join(root, relative);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
};

const serverLogger = read("lib/server/security-audit.ts");
const sharedTypes = read("lib/security-audit-types.ts");
const guard = read("lib/server/security-guard.ts");
const sidebar = read("components/layout/sidebar.tsx");
const page = read("app/dashboard/security/platform-data/page.tsx");
const testEventRoute = read("app/api/security/platform-data/test-event/route.ts");
const incidentsPatchRoute = read("app/api/security/platform-data/incidents/[id]/route.ts");
const reviewsRoute = read("app/api/security/platform-data/reviews/route.ts");
const evidenceRoute = read("app/api/security/platform-data/evidence/[reviewId]/route.ts");

const checks = [
  {
    name: "Dashboard defines shared security audit types",
    pass:
      sharedTypes.includes('schema: "biome.security.v1"') &&
      sharedTypes.includes("SecurityAuditEvent") &&
      sharedTypes.includes("SecurityReviewChecklist"),
  },
  {
    name: "Dashboard logger emits structured Cloud Logging payloads and Firestore review index records",
    pass:
      serverLogger.includes("jsonPayload.schema") &&
      serverLogger.includes("securityAuditEvents") &&
      serverLogger.includes("writeSecurityAuditEvent"),
  },
  {
    name: "Security routes use Firebase identity and superadmin authorization without ADMIN_API_TOKEN",
    pass:
      guard.includes("requireSecuritySuperadmin") &&
      guard.includes("requireFirebaseUser") &&
      guard.includes("403") &&
      !guard.includes("ADMIN_API_TOKEN"),
  },
  {
    name: "Sidebar links to Platform Data Monitoring",
    pass:
      sidebar.includes("/dashboard/security/platform-data") &&
      sidebar.includes("Platform Data Monitoring"),
  },
  {
    name: "Platform Data Monitoring page has events, incidents, reviews, and evidence tabs",
    pass:
      page.includes("Security Events") &&
      page.includes("Incidents") &&
      page.includes("Weekly Reviews") &&
      page.includes("Evidence Export"),
  },
  {
    name: "Safe test event endpoint requires confirmation and emits SECURITY_PIPELINE_TEST",
    pass:
      testEventRoute.includes("GENERATE SECURITY TEST EVENT") &&
      testEventRoute.includes("SECURITY_PIPELINE_TEST") &&
      testEventRoute.includes("cooldown"),
  },
  {
    name: "Incident and weekly review APIs append immutable activity and server timestamps",
    pass:
      incidentsPatchRoute.includes("appendSecurityActivity") &&
      incidentsPatchRoute.includes("serverTimestamp") &&
      reviewsRoute.includes("SECURITY_COLLECTIONS.reviews") &&
      reviewsRoute.includes("allFourMetaCategoriesReviewed"),
  },
  {
    name: "Evidence export route is print-ready and redaction-oriented",
    pass:
      evidenceRoute.includes("window.print") &&
      evidenceRoute.includes("Redaction check") &&
      evidenceRoute.includes("actual alert output"),
  },
];

let failed = false;
for (const check of checks) {
  const status = check.pass ? "PASS" : "FAIL";
  console.log(`${status} ${check.name}`);
  if (!check.pass) failed = true;
}

if (failed) process.exit(1);
