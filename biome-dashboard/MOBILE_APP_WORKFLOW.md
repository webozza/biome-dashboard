# BM 3.0 — Mobile App Workflow & Endpoint Reference

This doc is for the **mobile app side only** (`projectv` app, Firebase user). It lists every endpoint the mobile app will call, in the order the user hits them, with auth, request shape, response shape, and the state changes each call triggers.

For the admin dashboard side see `WORKFLOW.md`. For raw API spec see `API.md`.

---

## 0. Auth model

The mobile app and this dashboard share the **same Firebase project**. Users sign in to the mobile app with Firebase email/password; on every API call the app sends:

```
Authorization: Bearer <firebaseIdToken>
```

The token is verified server-side via `requireFirebaseUser` (`lib/server/auth.ts`). Refresh the ID token on the client when it expires.

### Optional: session exchange

If the mobile app wants to know whether the signed-in user is an admin (e.g. to show admin tools), call once after sign-in:

```
POST /api/auth/session
Authorization: Bearer <firebaseIdToken>

→ 200 { token: <ADMIN_API_TOKEN> | null, user: { uid, email, role, isAdmin } }
```

Non-admins get `token: null` — they're still authenticated, just can't call admin-only endpoints. **Mobile users should ignore `token`** and keep using their Firebase ID token.

### Verified vs unverified

A user is "verified" (BMID holder) when **both**:
- `users.verified === true`
- `users.bmidNumber` is set (e.g. `"BMID-007"`)

Several endpoints check this server-side and reject unverified users with `403 not_verified`. The app should pre-gate the UI using `GET /api/bmid/me`.

---

## 1. Module 1 — Verification

### Flow

1. App shows "Request BMID Verification" button on profile if `verified === false`.
2. User fills in social account info + reason.
3. App submits.
4. User waits for admin review. Email arrives on approve/reject.
5. On next app open, `GET /api/bmid/me` returns `verified: true` + `bmidNumber`.

### Endpoints

#### `GET /api/bmid/me`

Get current user's BMID status. Use this to gate the Verification / Content / Box / Voting screens.

```
Authorization: Bearer <firebaseIdToken>

→ 200
{
  "id": "<uid>",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "bmidNumber": "BMID-042" | null,
  "verified": true | false,
  "photoURL": "https://..." | null
}
```

#### `POST /api/verification`

Submit a verification request.

```
POST /api/verification
Authorization: Bearer <firebaseIdToken>
Content-Type: application/json

{
  "platform": "Instagram",            // or "TikTok", "Facebook", "YouTube"
  "socialAccount": "@janedoe",
  "reason": "I post fitness content daily for 2 years",
  "userName": "Jane Doe"              // optional override
}

→ 201 { "id": "<verificationRequestId>" }
```

Server sets `status: "pending"` automatically. `userId` and `email` are filled from the Firebase token.

> Spec rule (BM 3.0 §2.1): account must be Meta or TikTok with ≥1 year of post history. The mobile app should validate this client-side too (e.g. show a checklist before submit).

### What the user sees after submit

- Status: `pending` until admin acts.
- On approve: email arrives, `users.verified` flips to `true`, `bmidNumber` is assigned (`BMID-NNN` zero-padded).
- On reject: email arrives with `rejectionReason`. User can submit again later.

> ⚠️ The mobile app currently has **no endpoint to fetch its own pending verification status by id**. Workaround: poll `GET /api/bmid/me` — `verified === true` ⇒ approved. If not, treat it as still pending. (If you need rejection reason on the user portal, file as a backend gap.)

---

## 2. Module 2 — BMID Content (in-app posts)

### Flow

1. Verified user opens any of their in-app posts.
2. Taps "Transfer to BMID" → picks **Own** or **Duality** (if duality, picks a tagged user).
3. App submits → `contentRequests/{id}` created. If duality, `dualityRequests/{id}` is also created with `source: "content"`.
4. Tagged user (if duality) accepts/declines from their app.
5. Admin approves → voting opens.
6. Verified users vote.
7. Final state mirrors back onto the request.

### 2.1 Pick a post to transfer

#### `GET /api/bmid/me/posts`

List the signed-in user's in-app posts (these are the candidates for transfer).

```
GET /api/bmid/me/posts?limit=100
Authorization: Bearer <firebaseIdToken>

→ 200
{
  "items": [
    {
      "id": "<postId>",
      "title": "Sunset run",
      "description": "5k around the lake",
      "imageUrl": "https://..." | null,
      "createdAt": "2026-04-20T10:00:00Z"
    }
  ]
}
```

### 2.2 Look up users to tag (duality only)

#### `GET /api/bmid/users/lookup`

Used to populate the "tag a user" picker for Duality.

```
GET /api/bmid/users/lookup?limit=100
Authorization: Bearer <firebaseIdToken>

→ 200
{
  "items": [
    { "id": "u2", "email": "alex@example.com", "displayName": "Alex" }
  ]
}
```

Excludes the current user. Sort/filter client-side.

### 2.3 Submit the transfer

#### `POST /api/bmid/transfer`

```
POST /api/bmid/transfer
Authorization: Bearer <firebaseIdToken>
Content-Type: application/json

// Own request
{
  "postId": "<postId>",
  "postTitle": "Sunset run",
  "postPreview": "5k around the lake",
  "postImageUrl": "https://..." | null,
  "type": "own"
}

// Duality request
{
  "postId": "<postId>",
  "postTitle": "Joint shoot with Alex",
  "postPreview": "We both styled this set",
  "postImageUrl": "https://...",
  "type": "duality",
  "taggedUserId": "u2"
}

→ 201 { "id": "<contentRequestId>" }
```

**Errors:**
- `403 not_verified` — owner not verified
- `404 post_not_found` — `postId` not in `users/{uid}/posts`
- `400 invalid_tagged_user` — duality with self or missing tagged user
- `404 tagged_user_not_found`

### 2.4 List my BMID requests (created or tagged in)

#### `GET /api/bmid/requests`

```
GET /api/bmid/requests
Authorization: Bearer <firebaseIdToken>

→ 200
{
  "items": [
    {
      "id": "content-XXXX",
      "userId": "u1", "userName": "Jane Doe",
      "taggedUserId": "u2", "taggedUserName": "Alex",
      "type": "duality",
      "status": "waiting_tagged" | "pending" | "in_review" | "approved" | "rejected" | "cancelled",
      "taggedUserAction": "pending" | "accepted" | "declined",
      "votingStatus": null | "open" | "closed" | "finalized",
      "votingOutcome": null | "accepted" | "ignored" | "refused",
      "voteAccept": 0, "voteIgnore": 0, "voteRefuse": 0,
      "createdAt": "..."
    }
  ]
}
```

Returns posts where `userId == me` OR `taggedUserId == me`. Use this for the user's "My BMIDs" tab.

### 2.5 Tagged-user response (Duality)

#### `GET /api/bmid/duality/pending`

List duality requests waiting for the current user's response.

```
GET /api/bmid/duality/pending
Authorization: Bearer <firebaseIdToken>

→ 200
{
  "items": [
    {
      "id": "content-XXXX" | "box-XXXX",
      "ownerId": "u1", "ownerName": "Jane Doe",
      "taggedUserId": "<me>", "taggedUserName": "Alex",
      "taggedUserAction": "pending",
      "status": "waiting_tagged",
      "source": "content" | "box",
      "createdAt": "..."
    }
  ]
}
```

> Returns **both** content-source and box-source duality items. Render the `source` badge so the user knows what they're approving.

#### `PATCH /api/duality/:id`

Accept or decline as the tagged user.

```
PATCH /api/duality/<id>
Authorization: Bearer <firebaseIdToken>
Content-Type: application/json

{ "taggedUserAction": "accepted" }   // or "declined"

→ 200 (full duality doc)
```

The handler verifies `firebaseUser.uid === duality.taggedUserId`. On `accepted`:
- Content source → `contentRequests.status` flips to `pending` (ready for admin review).
- Box source → `bmidBoxRequests.currentStatus` flips to `pending_admin_review`.

On `declined`:
- Content source → `contentRequests.status` = `rejected`, reason "Tagged user declined".
- Box source → `bmidBoxRequests.currentStatus` = `refused`.

---

## 3. Module 3 — BMID Box (external posts)

### Flow

1. Verified user opens an external link (Instagram / TikTok / YouTube / Facebook share).
2. Pastes/shares the URL into the app.
3. Picks Own or Duality.
4. App submits to `bmidBoxRequests`. If duality, a `dualityRequests/{id}` is also created with `source: "box"`.
5. Tagged user accepts (same `/api/bmid/duality/pending` + `PATCH /api/duality/:id`).
6. Admin reviews → opens voting.
7. Verified users vote.
8. Admin finalizes → `currentStatus = approved | refused | cancelled | removed`.

### 3.1 ⚠️ Backend gap: no user-side Box submit endpoint yet

`POST /api/bmid-box/requests` today is **admin-token only** (`guard(req)` at the top of `app/api/bmid-box/requests/route.ts`). The mobile app cannot call it directly with a Firebase ID token.

**To unblock mobile box submission, the backend needs one of:**

A. **New endpoint** `POST /api/bmid/box` that calls `requireFirebaseUser` + reuses the body-validation logic from `/api/bmid-box/requests`. Recommended — matches the `/api/bmid/*` user-namespace convention.

B. **Modify** `/api/bmid-box/requests` POST to accept Firebase user auth (similar to how `/api/verification` accepts both).

Until then, the mobile app must either (a) wait for the backend change, or (b) proxy through a server-side function that holds the admin token (not recommended — admin token shouldn't ship to mobile).

### 3.2 What the body would look like (proposed)

```
POST /api/bmid/box
Authorization: Bearer <firebaseIdToken>
Content-Type: application/json

{
  "type": "own" | "duality",
  "sourceUrl": "https://www.instagram.com/p/XXXX/",
  "sourcePlatform": "instagram",        // must be in bmidBoxSettings.allowedPlatforms
  "taggedUserId": "u2",                 // duality only
  "previewData": {
    "title": "...",
    "caption": "...",
    "description": "...",
    "thumbnailUrl": "...",
    "embedEnabled": true,
    "contentType": "post"               // "post" | "reel" | "video" | ...
  }
}

→ 201 { "id": "box-NNNN" }
```

Server-side validations (already in the admin endpoint, must be preserved):
- Owner verified + has `bmidNumber`
- For duality: tagged user verified, has `bmidNumber`, ≠ owner
- `sourcePlatform` ∈ `bmidBoxSettings.allowedPlatforms`

### 3.3 Reading box requests on mobile

There is **no user-side `GET /api/bmid/box`** today. For the user to see their own box submissions, the backend needs a list endpoint scoped to `ownerUserId == me`. Track this as a gap alongside §3.1.

Workaround for now: include box items in `GET /api/bmid/requests` (current implementation only reads `contentRequests`). Either (a) extend that handler to also union `bmidBoxRequests` where `ownerUserId == me OR taggedUserId == me`, or (b) add `GET /api/bmid/box/mine`.

---

## 4. Module 4 — Voting

### Flow

1. Verified user opens "Vote" tab.
2. App lists all open voting sessions (content + box merged on the admin side; user side currently lists content-only — see §4.3).
3. User taps a row → sees Accept / Ignore / Refuse.
4. App posts the vote.
5. Counters update; one vote per user per session.

### 4.1 List open sessions

#### `GET /api/bmid/voting`

```
GET /api/bmid/voting
Authorization: Bearer <firebaseIdToken>

→ 200
{
  "items": [
    {
      "id": "content-XXXX",
      "requestId": "content-XXXX",
      "requestType": "content",
      "title": "Sunset run - Jane Doe",
      "accept": 4, "ignore": 1, "refuse": 0,
      "status": "open",
      "openedAt": "...",
      "closedAt": null,
      "outcome": null
    }
  ]
}
```

**403 `not_verified`** if the caller is not verified.

> ⚠️ This endpoint reads `votingItems` only — **does not include box-source voting**. Today only the admin endpoint (`GET /api/voting`) merges both. To let mobile users vote on Box too, the backend should either (a) update `GET /api/bmid/voting` to merge box rows the same way `GET /api/voting` does, or (b) add a separate `GET /api/bmid/voting/box`. Track as gap §4.3 below.

### 4.2 Cast a vote

#### `POST /api/voting/:id/record`

```
POST /api/voting/<sessionId>/record
Authorization: ???
Content-Type: application/json

{
  "decision": "accept" | "ignore" | "refuse",
  "actorUserId": "<my uid>",
  "actorEmail": "me@example.com"
}

→ 200 (updated voting row)
```

> ✅ **Dual-auth as of BM 3.0 §6.2 fix.** The endpoint accepts either:
>
> - **Admin token** (existing dashboard flow) — `actorUserId` / `actorEmail` come from the request body, so the dashboard can record votes on behalf of any user.
> - **Firebase ID token** (mobile flow) — `actorUserId` is taken from the verified token (`firebaseUser.uid`), `actorEmail` from `firebaseUser.email`. Body cannot impersonate.
>
> The verified-user check (`users.verified === true || typeof users.bmidNumber === "string"`) still runs in both paths against the resolved `actorUserId`.

### 4.3 Box voting in `GET /api/bmid/voting`

Currently missing. When fixed, the dispatch logic in `POST /api/voting/:id/record` already handles box ids correctly (it looks up `bmidBoxRequests/:id` first and calls `castBmidBoxVote` if found). So once the GET endpoint includes box rows, casting works automatically.

### 4.4 Outcome rules (current behaviour)

- One vote per `actorUserId` per session (enforced for both content and box).
- Counters increment atomically.
- **Closure is admin-driven** — there is no time-based auto-close and no quorum threshold. The user just sees `status: "open"` until an admin finalizes.
- Outcome = strict majority of `accept`/`ignore`/`refuse`. **Ties return `null`** — the admin must finalize manually with an explicit outcome.

When voting finalizes:
- `accepted` → `contentRequests.status = "approved"` (or `bmidBoxRequests.currentStatus = "approved"`).
- `refused` → `status = "rejected"` / `currentStatus = "refused"`.
- `ignored` → `status = "cancelled"` (content) / explicit admin choice for box.

---

## 5. Notifications

The backend currently sends **email** on verification approve/reject (`lib/server/email/transport.ts`). All other in-app notifications listed in BM 3.0 §5 — tagged-in-Duality, sent-to-voting, final result, verification removed — are **not yet implemented**.

For the mobile app, two options:

A. **Poll** the relevant endpoints on app open / pull-to-refresh:
- `GET /api/bmid/me` for verification status changes.
- `GET /api/bmid/duality/pending` for new duality tags.
- `GET /api/bmid/requests` for status changes on user's own requests.
- `GET /api/bmid/voting` for open sessions.

B. **Push notifications** — needs FCM wiring on both backend and app. Not in current scope.

---

## 6. Endpoint cheat sheet (mobile-only)

| Purpose | Method | Path | Auth | Status |
|---|---|---|---|---|
| Session bootstrap (optional) | POST | `/api/auth/session` | Firebase | ✅ ready |
| Get my BMID status | GET | `/api/bmid/me` | Firebase | ✅ ready |
| Submit verification | POST | `/api/verification` | Firebase | ✅ ready |
| List my in-app posts | GET | `/api/bmid/me/posts` | Firebase | ✅ ready |
| Look up users to tag | GET | `/api/bmid/users/lookup` | Firebase | ✅ ready |
| Transfer post → BMID Content | POST | `/api/bmid/transfer` | Firebase | ✅ ready |
| List my BMID requests | GET | `/api/bmid/requests` | Firebase | ✅ ready (content only — extend for box) |
| Pending duality (where I'm tagged) | GET | `/api/bmid/duality/pending` | Firebase | ✅ ready (covers both content & box) |
| Accept/decline as tagged user | PATCH | `/api/duality/:id` | Firebase | ✅ ready |
| List open voting sessions | GET | `/api/bmid/voting` | Firebase (verified) | ⚠️ content only — extend for box |
| Cast a vote | POST | `/api/voting/:id/record` | Firebase or Admin | ✅ dual-auth — mobile votes as self via Firebase token; dashboard records on behalf via admin token |
| Submit a Box request | POST | `/api/bmid-box/requests` | **Admin token** | ⚠️ blocker — needs `/api/bmid/box` |
| List my Box requests | — | — | — | ⚠️ missing — needs `/api/bmid/box/mine` or extend `/api/bmid/requests` |

---

## 7. Backend gap list (must-fix before mobile ships)

| # | Gap | Suggested fix | File |
|---|---|---|---|
| 1 | Mobile cannot submit Box request | Add `POST /api/bmid/box` (Firebase auth, reuses validation from `/api/bmid-box/requests`) | new `app/api/bmid/box/route.ts` |
| ~~2~~ | ~~Mobile cannot cast a vote~~ | ✅ **DONE** — endpoint now accepts Firebase token (uses `firebaseUser.uid` as `actorUserId`) or admin token (body `actorUserId` for dashboard). | `app/api/voting/[id]/record/route.ts` |
| 3 | `GET /api/bmid/voting` doesn't include box rows | Mirror the merge logic from `app/api/voting/route.ts` (read `bmidBoxRequests` where `votingStatus` is set, synthesize rows) | `app/api/bmid/voting/route.ts` |
| 4 | `GET /api/bmid/requests` doesn't include box | Union `bmidBoxRequests` where `ownerUserId == me OR taggedUserId == me` | `app/api/bmid/requests/route.ts` |
| 5 | No way for user to see their own pending verification with reason | Add `GET /api/bmid/verification/mine` returning latest pending/rejected request | new |
| 6 | No user-side cancel for pending content/box request | Add `DELETE /api/bmid/requests/:id` (Firebase, must own the request, only when status `pending`/`waiting_tagged`/`pending_admin_review`) | new |
| 7 | In-app push notifications not wired | FCM integration — out of current scope | — |
| 8 | When admin removes verified status, existing content/box items don't cascade | Decide policy + add cascade in `DELETE /api/verification/:id` | `app/api/verification/[id]/route.ts` |

---

## 8. End-to-end mobile happy path (Duality Box example)

This is what a full Duality Box submission looks like from the mobile app once gaps §1–4 are fixed.

```
1. App opens → GET /api/bmid/me
   → { verified: true, bmidNumber: "BMID-007" }                 // user is eligible

2. User pastes IG link → app pre-validates the platform locally.

3. App calls GET /api/bmid/users/lookup → user picks Alex (u2).

4. App calls POST /api/bmid/box                                  // (gap §1 — proposed)
   body: { type: "duality", taggedUserId: "u2", sourceUrl, sourcePlatform: "instagram", previewData }
   → 201 { id: "box-2402" }

5. Alex's app polls GET /api/bmid/duality/pending
   → sees the request with source: "box"

6. Alex calls PATCH /api/duality/box-2402 { taggedUserAction: "accepted" }
   → server flips dualityRequests + bmidBoxRequests.currentStatus → pending_admin_review

7. (Admin side) admin clicks Approve in dashboard
   → bmidBoxRequests.currentStatus → pending_voting, votingStatus → "open"

8. Alex/Jane/other verified users open Vote tab
   → GET /api/bmid/voting (gap §3 — must include box rows)
   → see "box-2402" row

9. They each call POST /api/voting/box-2402/record { decision: "accept" }   // (gap §2)
   → handler dispatches to castBmidBoxVote → counters increment inline on bmidBoxRequests

10. Admin clicks Approve again (or Finalize)
    → bmidBoxRequests.currentStatus → "approved", votingStatus → "finalized"

11. Both users' apps see status "approved" on next pull of GET /api/bmid/requests
    (after gap §4 fix to include box).
```

Without the gap fixes, steps 4, 8, 9, and 11 all fail or return incomplete data.
