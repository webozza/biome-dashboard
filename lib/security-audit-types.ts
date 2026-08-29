export type SecurityAuditCategory =
  | "authentication"
  | "access_control"
  | "platform_data_access"
  | "admin_activity"
  | "abuse_detection"
  | "security_test";

export type SecurityAuditSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type SecurityAuditProvider = "facebook" | "instagram" | "meta" | "internal";
export type SecurityAuditOutcome = "success" | "denied" | "failure" | "flagged";

export type SecurityAuditEventType =
  | "AUTHENTICATION_FAILURE"
  | "ADMIN_ACCESS_DENIED"
  | "ADMIN_SESSION_CREATED"
  | "ADMIN_SECURITY_EXPORT"
  | "META_OAUTH_CONNECTED"
  | "META_OAUTH_FAILED"
  | "META_OAUTH_DISCONNECTED"
  | "META_TOKEN_INVALID"
  | "META_GRAPH_READ"
  | "META_GRAPH_READ_FAILED"
  | "META_PLATFORM_DATA_BULK_READ"
  | "RATE_LIMIT_TRIGGERED"
  | "SUSPICIOUS_EXTRACTION_PATTERN"
  | "SECURITY_PIPELINE_TEST";

export type SecurityAuditEvent = {
  schema: "biome.security.v1";
  eventId: string;
  occurredAt: string;
  environment: "production" | "staging";
  backendSource: "firebase-functions" | "dashboard-vps";
  category: SecurityAuditCategory;
  eventType: SecurityAuditEventType;
  severity: SecurityAuditSeverity;
  provider: SecurityAuditProvider;
  action: string;
  outcome: SecurityAuditOutcome;
  platformData: boolean;
  actorIdHash?: string;
  actorRole?: "user" | "readonly" | "super_admin" | "system";
  requestId: string;
  statusCode?: number;
  recordCount?: number;
  ipHash?: string;
  userAgentFamily?: string;
  reasonCode?: string;
  synthetic: boolean;
};

export type SecurityIncidentStatus =
  | "open"
  | "investigating"
  | "benign"
  | "test_event"
  | "confirmed_incident"
  | "escalated"
  | "resolved";

export type SecurityReviewChecklist = {
  unauthorizedAuthReviewed: boolean;
  accessControlReviewed: boolean;
  exploitationReviewed: boolean;
  extractionReviewed: boolean;
};

export type SecurityReviewStatus = "pending" | "in_progress" | "completed" | "overdue";

export type SecurityIncident = {
  id: string;
  cloudIncidentId?: string | null;
  cloudIncidentUrl?: string | null;
  policyName: string;
  severity: SecurityAuditSeverity;
  status: SecurityIncidentStatus;
  relatedEventIds: string[];
  assignedReviewerUid?: string | null;
  assignedReviewerEmail?: string | null;
  reviewNotes?: string | null;
  openedAt: string;
  resolvedAt?: string | null;
  updatedAt: string;
};

export type SecurityReview = {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  status: SecurityReviewStatus;
  reviewerUid?: string | null;
  reviewerEmail?: string | null;
  checklist: SecurityReviewChecklist;
  eventCount: number;
  incidentCount: number;
  findings: string;
  linkedIncidentIds: string[];
  completedAt?: string | null;
  nextDueAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
