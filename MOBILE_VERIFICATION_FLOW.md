# BM 3.0 — Mobile App Verification Flow

Mobile app er **Verification flow** matra. Backend API + payload + response + state changes — sob ek jaygai.

---

## TL;DR

| Step | What user does | API call |
|---|---|---|
| 0 | Sign in to app | Firebase email/password (client SDK) |
| 1 | Open profile, check status | `GET /api/bmid/me` |
| 2 | Tap "Request BMID Verification", fill form, submit | `POST /api/verification` |
| 3 | Wait for admin → poll status | `GET /api/bmid/me` again |
| 4 | (On approve) email arrives + `verified: true` + `bmidNumber` set | — |
| 5 | (On reject) email arrives with `rejectionReason`; user can resubmit | back to step 2 |

---

## 0. Auth

Mobile app sob request e Firebase ID token pathabe:

```
Authorization: Bearer <firebaseIdToken>
```

ID token Firebase Auth SDK theke ase (`getIdToken()`). Expire hole refresh kore notun token use korte hobe.

---

## 1. Step 1 — Check current status

Profile screen kholar somoy / app start e ekbar call koro. UI eta diye gate korbe — verified user ke "Request Verification" button dekhabe na, instead BMID number dekhabe.

### Request

```http
GET /api/bmid/me
Authorization: Bearer <firebaseIdToken>
```

### Response (200)

```json
{
  "id": "u1",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "bmidNumber": "BMID-042",
  "verified": true,
  "photoURL": "https://lh3.googleusercontent.com/..."
}
```

### State interpretation

| `verified` | `bmidNumber` | Mean | UI |
|---|---|---|---|
| `false` | `null` | Never requested OR pending OR rejected | Show "Request BMID Verification" button |
| `true` | `"BMID-NNN"` | Approved — has BMID | Show BMID badge + number |

### Errors

| HTTP | Body | Reason |
|---|---|---|
| 401 | `{ "error": "unauthorized", "reason": "missing_token" \| "invalid_token" \| "expired_token" }` | Firebase token bad — refresh and retry |
| 404 | `{ "error": "user_not_found" }` | Firebase uid has no `users/{uid}` doc — user record missing on backend |

> ⚠️ **`GET /api/bmid/me` cannot tell you if a request is "pending" vs "never submitted"**. Both look identical (`verified: false`, `bmidNumber: null`). To show "Pending review" UI, the backend needs a new endpoint (see §6 gap).

---

## 2. Step 2 — Submit verification request

User fills the form (platform, social handle, reason, etc.) and taps Submit.

### Request

```http
POST /api/verification
Authorization: Bearer <firebaseIdToken>
Content-Type: application/json
```

### Payload

**Minimum required:**

```json
{
  "platform": "Instagram",
  "socialAccount": "@janedoe",
  "userName": "Jane Doe"
}
```

**Full payload (recommended — uses all fields the dashboard already understands):**

```json
{
  "platform": "Instagram",
  "socialAccount": "@janedoe",
  "userName": "Jane Doe",
  "displayName": "Jane on IG",
  "profileUrl": "https://instagram.com/janedoe",
  "accountType": "personal",
  "verificationReason": "I post fitness content daily for over 2 years",
  "activeOneYear": true,
  "representsRealIdentity": true,
  "screenshotUrl": "https://storage.googleapis.com/.../proof.jpg",
  "documentUrl": "https://storage.googleapis.com/.../id.jpg",
  "agreementAccepted": true,
  "followerCount": 12400,
  "contentCategory": "fitness",
  "country": "BD",
  "contactEmail": "jane@example.com"
}
```

### Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `platform` | string | ✅ | `"Instagram"`, `"TikTok"`, `"Facebook"`, `"YouTube"`, `"Twitter"`, etc. |
| `socialAccount` | string | ✅ | Handle/username (e.g. `"@janedoe"`) |
| `userName` | string | recommended | Display name; falls back to user record name |
| `displayName` | string | optional | Name shown on the social account |
| `profileUrl` | string (URL) | optional | Direct link to the social profile (helps admin verify) |
| `accountType` | string | optional | `"personal"`, `"creator"`, `"business"`, etc. |
| `verificationReason` | string | optional | Why the user thinks they qualify |
| `activeOneYear` | boolean | optional | User's self-attestation (BM 3.0 §2.1 rule: ≥1 year history) |
| `representsRealIdentity` | boolean | optional | User's self-attestation (real identity, not fake) |
| `screenshotUrl` | string (URL) | optional | Proof screenshot (uploaded to your storage first) |
| `documentUrl` | string (URL) | optional | ID document (uploaded to your storage first) |
| `agreementAccepted` | boolean | optional | T&C checkbox state |
| `followerCount` | number | optional | Helps admin context |
| `contentCategory` | string | optional | e.g. `"fitness"`, `"tech"`, `"food"` |
| `country` | string | optional | ISO country code |
| `contactEmail` | string | optional | If user wants notifications on a different email than their auth email |

> Server **automatically** sets these — don't send them: `userId`, `email` (from Firebase token), `status: "pending"`, `reviewedBy: null`, `adminNote: null`, `rejectionReason: null`, `createdAt`, `updatedAt`.

### Response (201)

```json
{
  "id": "<verificationRequestId>"
}
```

Save this id locally if you want to track this specific submission.

### Errors

| HTTP | Body | Reason |
|---|---|---|
| 400 | `{ "error": "invalid_json" }` | Body parse failed |
| 401 | `{ "error": "unauthorized", "reason": "..." }` | Firebase token invalid/expired |
| 500 | `{ "error": "create_failed", "detail": "..." }` | Firestore write failed |

### File uploads

The `screenshotUrl` / `documentUrl` fields expect **already-uploaded URLs**. The mobile app should:

1. Pick the image from camera/gallery.
2. Upload to Firebase Storage / S3 / your bucket.
3. Get the public (or signed) URL back.
4. Send that URL inside the JSON payload.

This API does **not** accept multipart uploads.

---

## 3. Step 3 — Poll for status updates

After submission, the user should see a "Pending review" state until admin acts. Two ways:

### Option A — Pull-to-refresh (simple)

On profile screen pull-to-refresh, just call `GET /api/bmid/me` again:

- `verified: true` + `bmidNumber: "BMID-NNN"` → ✅ approved → show success state.
- `verified: false` → still pending OR rejected. Show "Pending review".

### Option B — Background poll on app open

```
App foreground → call GET /api/bmid/me once
                 → compare with cached state
                 → if changed to verified, show "🎉 Your BMID is BMID-042"
```

> ⚠️ There is **no push notification** for verification approve/reject yet (only email is wired server-side via `sendVerificationEmail`). For real-time status, FCM needs to be added — see backend gap list.

---

## 4. Step 4 — Approved state

When admin approves, server-side these things happen automatically:

1. `verificationRequests/{id}.status = "approved"`.
2. Inside a Firestore transaction (`ensureApprovedUserState`):
   - Scan all users for max `BMID-NNN` sequence.
   - Assign `BMID-(max+1)` zero-padded to 3 digits.
   - Set `users/{uid}.verified = true` + `users/{uid}.bmidNumber = "BMID-NNN"`.
3. Mirror `bmidNumber` back onto the verification doc.
4. Email sent to `users/{uid}.email` via `sendVerificationEmail(email, "approved", ...)`.

Mobile app's next `GET /api/bmid/me` will show:

```json
{
  "verified": true,
  "bmidNumber": "BMID-042",
  ...
}
```

UI now unlocks BMID Content + BMID Box + Voting screens (gated on `verified === true`).

---

## 5. Step 5 — Rejected state

If admin rejects:

1. `verificationRequests/{id}.status = "rejected"`.
2. `verificationRequests/{id}.rejectionReason = "<admin's reason>"`.
3. Email sent with rejection reason via `sendVerificationEmail(email, "rejected", { rejectionReason })`.
4. `users/{uid}.verified` stays `false`. `bmidNumber` stays `null`.

Mobile app's `GET /api/bmid/me` still returns `verified: false`. **The user cannot see the rejection reason from `/api/bmid/me`** — that's only in the email today.

User can submit again — there is no cooldown / lockout enforced server-side.

> ⚠️ See gap §6.1 — to show rejection reason in the app, backend needs a new endpoint.

---

## 6. Backend gaps for verification

If the mobile app needs richer UX than email alerts, backend needs these:

### 6.1 ⚠️ Endpoint to fetch the user's own latest verification request

**Need:** Show "Pending review" / "Rejected — reason: X" / "Submit appeal" states in the app.

**Suggested:**

```http
GET /api/bmid/verification/mine
Authorization: Bearer <firebaseIdToken>

→ 200
{
  "latest": {
    "id": "vr-abc",
    "status": "pending" | "approved" | "rejected" | "removed",
    "platform": "Instagram",
    "socialAccount": "@janedoe",
    "rejectionReason": null | "<reason>",
    "adminNote": null | "<note>",
    "bmidNumber": null | "BMID-042",
    "createdAt": "...",
    "updatedAt": "..."
  } | null,
  "history": [ /* older requests */ ]
}
```

**Implementation:** new file `app/api/bmid/verification/mine/route.ts`. Query `verificationRequests` where `userId == firebaseUser.uid`, order by `createdAt desc`, return latest + history.

### 6.2 ⚠️ Cancel a pending verification

**Need:** User submitted by mistake — wants to cancel before admin reviews.

**Suggested:**

```http
DELETE /api/bmid/verification/:id
Authorization: Bearer <firebaseIdToken>

→ 200 { "id": "vr-abc", "deleted": true }
```

**Implementation:** require `firebaseUser.uid === verificationRequests.userId` AND `status === "pending"`. New route file.

### 6.3 ⚠️ Push notification on approve/reject

**Need:** Real-time UX without polling.

**Implementation:** Add FCM token registration endpoint + send push from `app/api/verification/[id]/route.ts` PATCH handler alongside the existing email send. Out of current scope but flagged here.

### 6.4 ⚠️ Cascade when admin removes verification

**Today:** `DELETE /api/verification/:id` flips `users.verified = false` and clears `bmidNumber`, but **does not touch** existing `contentRequests` / `bmidBoxRequests`. If a user gets de-verified, their already-approved BMID posts stay live.

**Decision needed:** should existing items be marked `removed` / `cancelled`? Currently undefined.

---

## 7. End-to-end happy path (mobile)

```
User signs in via Firebase Auth SDK
  → app gets idToken

App opens profile screen
  → GET /api/bmid/me
  → { verified: false, bmidNumber: null }
  → UI shows "Request BMID Verification" button

User taps button → form opens → fills it → uploads screenshot to Firebase Storage
  → app gets storage URL

App calls POST /api/verification
  body: {
    platform: "Instagram",
    socialAccount: "@janedoe",
    userName: "Jane Doe",
    verificationReason: "...",
    activeOneYear: true,
    representsRealIdentity: true,
    screenshotUrl: "<storage url>",
    agreementAccepted: true
  }
  → 201 { id: "vr-abc" }
  → app shows "Submitted ✓ — under review"

(... admin reviews on /dashboard/verification ...)

Admin clicks Approve in dashboard
  → server: verificationRequests/vr-abc.status = "approved"
  → server: assigns BMID-042, users/u1.verified = true, users/u1.bmidNumber = "BMID-042"
  → server: sends approval email

User opens app next morning → app pulls GET /api/bmid/me
  → { verified: true, bmidNumber: "BMID-042" }
  → app unlocks BMID Content / Box / Voting tabs
  → shows "🎉 Your BMID is BMID-042"
```

---

## 8. State machine reference

```
verificationRequests.status:

  [no doc]
    │
    │  POST /api/verification
    ▼
  pending
    │
    ├── PATCH /api/verification/:id { status: "approved" }   [admin only]
    │     ├─ ensureApprovedUserState() → assign BMID-NNN
    │     ├─ users.verified = true
    │     └─ send approval email
    ▼
  approved
    │
    │  DELETE /api/verification/:id   [admin only]
    │     ├─ users.verified = false
    │     └─ users.bmidNumber = null
    ▼
  [doc gone, user unverified again]


  pending
    │
    │  PATCH /api/verification/:id { status: "rejected", rejectionReason }
    ▼
  rejected   ── send rejection email
    │
    │  (user submits again → new pending doc)
```

---

## 9. cURL test snippets

Replace `$TOKEN` with a Firebase ID token from the app SDK (`firebase.auth().currentUser.getIdToken()`).

**Check status:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/bmid/me
```

**Submit verification:**
```bash
curl -X POST http://localhost:3000/api/verification \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "Instagram",
    "socialAccount": "@testuser",
    "userName": "Test User",
    "verificationReason": "1 year of fitness content",
    "activeOneYear": true,
    "representsRealIdentity": true,
    "agreementAccepted": true
  }'
```
