# Biome Dashboard — Backend API

Next.js App Router route handlers under `app/api/*`, backed by Firebase Admin (Firestore).

## Setup

1. Copy `.env.example` → `.env.local` and fill in values:
   ```bash
   cp .env.example .env.local
   ```

2. Put the Firebase service-account JSON at the path referenced by `FIREBASE_SERVICE_ACCOUNT_PATH` (never commit it — `*.json` is already gitignored via `!package.json`/`!package-lock.json`).

3. Install deps (already done if you ran setup):
   ```bash
   npm install
   ```

4. Run:
   ```bash
   npm run dev
   ```

   API base: `http://localhost:3000/api`

## Auth

Two auth modes coexist:

1. **Admin-token endpoints** (`/api/verification`, `/api/content`, `/api/voting`, `/api/duality`, `/api/bmid-box/admin/*`, …) require `Authorization: Bearer <ADMIN_API_TOKEN>` (or header `X-Admin-Token: <token>`).
2. **User endpoints** under `/api/bmid/*` require `Authorization: Bearer <firebaseIdToken>` — verified via `requireFirebaseUser`.

The admin token is **not a shared secret** handed out at login — it's issued server-side at `POST /api/auth/session` **only when** the signed-in Firebase user's email is in the `ADMIN_EMAILS` env var. Everyone else signs in successfully but gets `token: null` (non-admin session).

## Pagination

List endpoints accept:

| Query | Default | Max | Description |
|-------|---------|-----|-------------|
| `limit` | `25` (env `DEFAULT_PAGE_SIZE`) | `100` | Page size |
| `cursor` | — | — | Doc id to start after (use `nextCursor` from prior response) |

Response shape:
```json
{
  "items": [ /* docs */ ],
  "nextCursor": "doc-id-or-null"
}
```

---

## Endpoints

### Health
`GET /api/health` — no auth. Returns `{ ok, service, time }`.

### Auth
`POST /api/auth/session` — requires `Authorization: Bearer <firebaseIdToken>`.

→ `{ "token": "<ADMIN_API_TOKEN>" | null, "user": { "uid", "email", "role": "super_admin"|"readonly", "isAdmin": boolean } }`

`token` is non-null only when the email is listed in `ADMIN_EMAILS`. Use it as the `Authorization: Bearer` value for admin-token endpoints.

### Dashboard
`GET /api/dashboard/stats` — aggregate counts for the overview page.

### Verification Requests
Firestore collection: `verificationRequests`
- `GET /api/verification?status=pending&platform=Instagram&limit=25&cursor=<id>`
- `POST /api/verification` — create
- `GET /api/verification/:id`
- `PATCH /api/verification/:id` — partial update (status, adminNote, rejectionReason, reviewedBy)
- `DELETE /api/verification/:id`

**PATCH payload example — approve:**
```json
{ "status": "approved", "reviewedBy": "admin@biome.io", "adminNote": "Identity confirmed" }
```
**PATCH payload — reject:**
```json
{ "status": "rejected", "reviewedBy": "admin@biome.io", "rejectionReason": "Document unclear" }
```

### BMID Content
Firestore: `contentRequests`
- `GET /api/content?status=pending&userId=u1`
- `POST /api/content`
- `GET|PATCH|DELETE /api/content/:id`

**PATCH payload — approve with note:**
```json
{
  "status": "approved",
  "adminNotes": [{ "note": "Clean post", "by": "admin@biome.io", "at": "2026-04-15T09:00:00Z" }]
}
```

### BMID Box
Firestore: `boxRequests`
- `GET /api/box?status=pending&platform=instagram`
- `POST /api/box`
- `GET|PATCH|DELETE /api/box/:id`

### Duality
Firestore: `dualityRequests`
- `GET /api/duality?status=pending&source=content&taggedUserAction=pending`
- `POST /api/duality`
- `GET|PATCH|DELETE /api/duality/:id`

### Voting
Firestore: `votingItems` — orderBy `openedAt` desc
- `GET /api/voting?status=open&outcome=accepted`
- `POST /api/voting`
- `GET|PATCH|DELETE /api/voting/:id`

**PATCH — finalize:**
```json
{ "status": "finalized", "outcome": "accepted", "closedAt": "2026-04-15T10:00:00Z" }
```

### Moderation
- `GET|POST /api/moderation/flags` — Firestore `flaggedItems` (filters: `status`, `type`, `severity`)
- `GET|POST /api/moderation/reports` — Firestore `postReports` (filters: `status`, `reason`, `postId`)
- `GET|POST /api/moderation/blocked` — Firestore `blockedUsers`

### Users
Firestore: `users`
- `GET /api/users?role=user&verified=true`
- `POST /api/users`
- `GET|PATCH|DELETE /api/users/:id`

### Audit Logs
Firestore: `auditLogs` (read-only)
- `GET /api/audit?requestType=duality&source=box&status=approved`

### Reports
`GET /api/reports` — aggregated approval/rejection counts across verification, content, box, duality, voting.

### Settings
Firestore: single doc `adminSettings/global`
- `GET /api/settings`
- `PATCH /api/settings` — merge arbitrary key/value

---

## Postman

### Environment
```
baseUrl      = http://localhost:3000
adminToken   = <paste-ADMIN_API_TOKEN>
```

### Collection-level auth
Type: **Bearer Token**, token: `{{adminToken}}`

### Sample requests

**Login**
```
POST {{baseUrl}}/api/auth/login
Content-Type: application/json

{ "email": "root@biome.io", "password": "change-me" }
```

**Pending verification list**
```
GET  {{baseUrl}}/api/verification?status=pending&limit=25
Authorization: Bearer {{adminToken}}
```

**Approve a verification**
```
PATCH {{baseUrl}}/api/verification/vr1
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "status": "approved",
  "reviewedBy": "admin@biome.io",
  "adminNote": "Document verified"
}
```

**Create a flag**
```
POST  {{baseUrl}}/api/moderation/flags
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "type": "user",
  "description": "Repeated spam from account",
  "severity": "high",
  "status": "open",
  "flaggedAt": "2026-04-15T10:00:00Z",
  "relatedId": "u123"
}
```

**Dashboard stats**
```
GET  {{baseUrl}}/api/dashboard/stats
Authorization: Bearer {{adminToken}}
```

---

## Error shape

All errors return:
```json
{ "error": "<code>", "reason": "...", "detail": "..." }
```

Common codes: `unauthorized` (401), `not_found` (404), `invalid_json` (400), `list_failed` / `update_failed` / `create_failed` / `delete_failed` (500).

## Firestore collections used

| Route | Collection |
|-------|------------|
| `/api/verification` | `verificationRequests` |
| `/api/content` | `contentRequests` |
| `/api/box` | `boxRequests` |
| `/api/duality` | `dualityRequests` |
| `/api/voting` | `votingItems` |
| `/api/moderation/flags` | `flaggedItems` |
| `/api/moderation/reports` | `postReports` |
| `/api/moderation/blocked` | `blockedUsers` |
| `/api/users` | `users` |
| `/api/audit` | `auditLogs` |
| `/api/settings` | `adminSettings/global` (single doc) |

All documents expect `createdAt` + `updatedAt` ISO strings; these are set automatically on `POST`/`PATCH`.
