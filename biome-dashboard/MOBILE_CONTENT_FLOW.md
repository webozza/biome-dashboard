# BM 3.0 — Mobile App BMID Content Flow

Mobile app er **BMID Content flow** matra (in-app post → BMID transfer → admin approve → community vote → final state). Backend API + payload + response + state changes.

> Pre-req: User must be **verified** (`users.verified === true` + `bmidNumber` set). See `MOBILE_VERIFICATION_FLOW.md`.

---

## TL;DR

| Step | Actor | What they do | API call |
|---|---|---|---|
| 1 | Owner | Pick an in-app post to transfer | `GET /api/bmid/me/posts` |
| 2 | Owner | (Duality only) pick a user to tag | `GET /api/bmid/users/lookup` |
| 3 | Owner | Submit transfer (Own or Duality) | `POST /api/bmid/transfer` |
| 4 | Tagged user (duality only) | See pending requests where they're tagged | `GET /api/bmid/duality/pending` |
| 5 | Tagged user (duality only) | Accept or decline | `PATCH /api/duality/:id` |
| 6 | Admin | Approve → opens voting | (dashboard side) |
| 7 | Verified voter | Cast Accept / Ignore / Refuse | `POST /api/voting/:id/record` ⚠️ blocker |
| 8 | Owner | Watch status updates | `GET /api/bmid/requests` |

---

## 0. Auth

All requests:

```
Authorization: Bearer <firebaseIdToken>
```

Verified user check happens server-side. Unverified users get `403 not_verified` from the transfer endpoint.

---

## 1. Step 1 — List my in-app posts (pick a post to transfer)

User opens "Transfer to BMID" screen → app fetches the user's existing posts from `users/{uid}/posts` so they can pick which one becomes a BMID.

### Request

```http
GET /api/bmid/me/posts?limit=100
Authorization: Bearer <firebaseIdToken>
```

### Query params

| Param | Default | Max | Notes |
|---|---|---|---|
| `limit` | 100 | 200 | How many posts to return |

### Response (200)

```json
{
  "items": [
    {
      "id": "post-abc",
      "title": "Sunset run",
      "description": "5k around the lake at golden hour",
      "imageUrl": "https://storage.googleapis.com/.../sunset.jpg",
      "createdAt": "2026-04-20T10:00:00Z"
    },
    {
      "id": "post-def",
      "title": "Morning brew",
      "description": "First flat white of the week",
      "imageUrl": null,
      "createdAt": "2026-04-19T07:30:00Z"
    }
  ]
}
```

Sorted by `createdAt desc`. `imageUrl` is auto-derived from common post fields (`pickFirstImage` / `pickVideoThumbnail`); `null` if no media.

### Errors

| HTTP | Body | Reason |
|---|---|---|
| 401 | `{ "error": "unauthorized", "reason": "..." }` | Bad/expired Firebase token |
| 500 | `{ "error": "list_failed", "detail": "..." }` | Firestore read failed |

---

## 2. Step 2 — User lookup (Duality only)

If type is **Duality**, user picks who to tag. App fetches the user list and shows a searchable picker.

### Request

```http
GET /api/bmid/users/lookup?limit=100
Authorization: Bearer <firebaseIdToken>
```

### Response (200)

```json
{
  "items": [
    { "id": "u2", "email": "alex@example.com", "displayName": "Alex Chen" },
    { "id": "u5", "email": "riley@example.com", "displayName": "Riley Johnson" }
  ]
}
```

- The current signed-in user is **excluded**.
- Sorted by `displayName` ascending.
- Filter client-side as user types (no server-side search yet).

> ⚠️ **Spec rule (BM 3.0 §3.4):** Duality should only allow users who already have a BMID. This endpoint currently returns **all users** including unverified ones. The transfer endpoint does NOT block on tagged user being verified for content (the box endpoint does). If you want to enforce verified-only for content duality, do it client-side: filter out users without a BMID badge in the picker. Backend gap §6.1 below.

### Errors

| HTTP | Body | Reason |
|---|---|---|
| 401 | `{ "error": "unauthorized" }` | Bad token |
| 500 | `{ "error": "users_lookup_failed" }` | Firestore read failed |

---

## 3. Step 3 — Submit the transfer

User confirms the transfer. App posts to the transfer endpoint.

### Request

```http
POST /api/bmid/transfer
Authorization: Bearer <firebaseIdToken>
Content-Type: application/json
```

### Payload — Own request

```json
{
  "type": "own",
  "postId": "post-abc",
  "postTitle": "Sunset run",
  "postPreview": "5k around the lake at golden hour",
  "postImageUrl": "https://storage.googleapis.com/.../sunset.jpg"
}
```

### Payload — Duality request

```json
{
  "type": "duality",
  "postId": "post-abc",
  "postTitle": "Joint shoot with Alex",
  "postPreview": "We both styled this set on the weekend",
  "postImageUrl": "https://storage.googleapis.com/.../joint.jpg",
  "taggedUserId": "u2"
}
```

### Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `"own"` \| `"duality"` | ✅ | Anything else defaults to `"own"` server-side |
| `postId` | string | ✅ | Must exist at `users/{uid}/posts/{postId}` |
| `postTitle` | string | ✅ | Non-empty after trim |
| `postPreview` | string | ✅ | Non-empty after trim |
| `postImageUrl` | string \| null | optional | Defaults to `null`. Empty string = `null`. |
| `taggedUserId` | string | ✅ if `type === "duality"` | Must be a real user, ≠ self |

> Server **automatically** sets these — don't send them: `userId`, `userName`, `bmidNumber`, `taggedUserName`, `status`, `taggedUserAction`, `adminNotes`, `voteAccept`/`voteIgnore`/`voteRefuse`, `votingStatus`, `votingOutcome`, `createdAt`, `updatedAt`.

### Response (201)

```json
{ "id": "<contentRequestId>" }
```

This id is the same id used as the `dualityRequests` doc id (if duality) and the `votingItems` doc id (when voting opens). Save it client-side.

### Errors

| HTTP | Body | Reason |
|---|---|---|
| 400 | `{ "error": "invalid_json" }` | Body parse failed |
| 400 | `{ "error": "missing_fields" }` | One of `postId` / `postTitle` / `postPreview` empty |
| 400 | `{ "error": "invalid_tagged_user" }` | Duality with self or empty `taggedUserId` |
| 401 | `{ "error": "unauthorized" }` | Bad/expired Firebase token |
| 403 | `{ "error": "not_verified" }` | Owner not verified — block at UI level too |
| 404 | `{ "error": "user_not_found" }` | Owner's user doc missing |
| 404 | `{ "error": "post_not_found" }` | `postId` not in `users/{uid}/posts` |
| 404 | `{ "error": "tagged_user_not_found" }` | `taggedUserId` is not a real user |
| 500 | `{ "error": "transfer_failed", "detail": "..." }` | Firestore write failed |

### What the server does

1. Verify Firebase token → get `uid`.
2. Read `users/{uid}` → check `verified === true || bmidNumber set`. Reject otherwise.
3. Read `users/{uid}/posts/{postId}` → must exist.
4. If duality: read `users/{taggedUserId}` → must exist + ≠ owner.
5. Create `contentRequests/{auto-id}` with:
   - `status: "pending"` (own) OR `"waiting_tagged"` (duality)
   - `taggedUserAction: "accepted"` (own) OR `"pending"` (duality)
   - vote counters initialized to 0.
6. If duality: create `dualityRequests/{same-id}` with `source: "content"`, `status: "waiting_tagged"`.

---

## 4. Step 4 — Tagged user sees pending duality

Tagged user opens the "Respond" screen → app fetches duality requests waiting for their response.

### Request

```http
GET /api/bmid/duality/pending
Authorization: Bearer <firebaseIdToken>
```

### Response (200)

```json
{
  "items": [
    {
      "id": "content-3157",
      "ownerId": "u1",
      "ownerName": "Jane Doe",
      "taggedUserId": "u2",
      "taggedUserName": "Alex Chen",
      "taggedUserAction": "pending",
      "status": "waiting_tagged",
      "source": "content",
      "decisionHistory": [
        { "action": "Created", "by": "Jane Doe", "at": "2026-04-25" }
      ],
      "timeline": [
        { "event": "Request created", "at": "2026-04-25" },
        { "event": "Tagged user notified", "at": "2026-04-25" }
      ],
      "reviewedBy": null,
      "adminNote": null,
      "createdAt": "2026-04-25T08:14:00Z"
    }
  ]
}
```

### Important

- This list returns **both** `source: "content"` and `source: "box"` items. Show a `source` badge in the UI so the user knows what they're approving.
- Filtered to `taggedUserId == me` AND `status == "waiting_tagged"`.
- Sorted by `createdAt desc`.
- Limited to top 100.

### Errors

| HTTP | Body | Reason |
|---|---|---|
| 401 | `{ "error": "unauthorized" }` | Bad token |
| 500 | `{ "error": "list_failed", "detail": "..." }` | Firestore read failed |

---

## 5. Step 5 — Tagged user accepts or declines

Tagged user taps Accept or Decline.

### Request

```http
PATCH /api/duality/<id>
Authorization: Bearer <firebaseIdToken>
Content-Type: application/json
```

### Payload — Accept

```json
{ "taggedUserAction": "accepted" }
```

### Payload — Decline

```json
{ "taggedUserAction": "declined" }
```

### Response (200)

The full updated duality doc:

```json
{
  "id": "content-3157",
  "ownerId": "u1",
  "ownerName": "Jane Doe",
  "taggedUserId": "u2",
  "taggedUserName": "Alex Chen",
  "taggedUserAction": "accepted",
  "status": "pending",
  "source": "content",
  "decisionHistory": [
    { "action": "Created", "by": "Jane Doe", "at": "2026-04-25" },
    { "action": "Tagged user accepted", "by": "alex@example.com", "at": "2026-04-25" }
  ],
  "timeline": [
    { "event": "Request created", "at": "2026-04-25" },
    { "event": "Tagged user notified", "at": "2026-04-25" },
    { "event": "Tagged user accepted", "at": "2026-04-25" }
  ],
  "reviewedBy": null,
  "adminNote": null
}
```

### What the server does

1. Verify Firebase token → get `uid`.
2. Read `dualityRequests/{id}`.
3. Reject `403 forbidden` if `firebaseUser.uid !== duality.taggedUserId` (and not admin).
4. Reject `400 not_waiting_tagged` if status is already past `waiting_tagged`.
5. Call `applyTaggedUserDecision(id, duality, actorName, decision)`:
   - **On accept** (content source): `dualityRequests.status = "pending"`, `contentRequests.status = "pending"` → ready for admin review.
   - **On decline** (content source): `dualityRequests.status = "rejected"`, `contentRequests.status = "rejected"`, `rejectionReason = "Tagged user declined"`. **Auto-rejected — no admin step.**
6. Append entries to `decisionHistory` and `timeline`.

### Errors

| HTTP | Body | Reason |
|---|---|---|
| 400 | `{ "error": "invalid_json" }` | Body parse failed |
| 401 | `{ "error": "unauthorized" }` | Bad token |
| 403 | `{ "error": "forbidden" }` | Not the tagged user (and not admin) |
| 404 | `{ "error": "not_found" }` | Duality doc doesn't exist |
| 500 | `{ "error": "update_failed", "detail": "..." }` | Firestore write failed |

> **Note:** `PATCH /api/duality/:id` also handles admin actions (`status: "approved" | "rejected"`). Mobile app should **only** send `{ taggedUserAction }`. Sending other status fields will require admin token.

---

## 6. Step 6 — Owner watches status

Owner opens "My BMIDs" screen → app fetches all content requests they're involved in (created OR tagged in).

### Request

```http
GET /api/bmid/requests
Authorization: Bearer <firebaseIdToken>
```

### Response (200)

```json
{
  "items": [
    {
      "id": "content-3157",
      "userId": "u1",
      "userName": "Jane Doe",
      "bmidNumber": "BMID-042",
      "postId": "post-abc",
      "postTitle": "Joint shoot with Alex",
      "postPreview": "We both styled this set on the weekend",
      "postImageUrl": "https://storage.googleapis.com/.../joint.jpg",
      "type": "duality",
      "status": "in_review",
      "taggedUserId": "u2",
      "taggedUserName": "Alex Chen",
      "taggedUserAction": "accepted",
      "voteAccept": 4,
      "voteIgnore": 1,
      "voteRefuse": 0,
      "votingStatus": "open",
      "votingOutcome": null,
      "adminNotes": [
        { "note": "Tagged user accepted", "by": "Alex Chen", "at": "2026-04-25" }
      ],
      "rejectionReason": null,
      "reviewedBy": null,
      "createdAt": "2026-04-25T08:14:00Z",
      "updatedAt": "2026-04-25T11:02:00Z"
    }
  ]
}
```

Returns posts where `userId == me` OR `taggedUserId == me`. Limited to 100 each side, deduped by id.

### Status values to render

| `status` | Meaning | UI hint |
|---|---|---|
| `pending` | Awaiting admin review (own request, or duality after tagged accepted) | Yellow "Pending review" |
| `waiting_tagged` | Duality, tagged user hasn't responded yet | Yellow "Waiting for @taggedUser" |
| `in_review` | Voting is open | Purple "Community voting" + show counters |
| `approved` | Final — voting accepted | Green "BMID Approved" badge |
| `rejected` | Final — admin rejected, tagged declined, or community refused | Red "Rejected" + show `rejectionReason` |
| `cancelled` | Final — community ignored | Gray "Cancelled" |

### Errors

| HTTP | Body | Reason |
|---|---|---|
| 401 | `{ "error": "unauthorized" }` | Bad token |
| 500 | `{ "error": "list_failed" }` | Firestore read failed |

---

## 7. State machine

### Own request

```
   [no doc]
      │
      │ POST /api/bmid/transfer { type: "own", ... }
      ▼
    pending  ──── admin approves ───▶  in_review (voting opens)
      │                                    │
      │ admin rejects                      │ vote finalized:
      ▼                                    │   accept majority → approved
    rejected                               │   refuse majority → rejected
                                           │   ignore majority → cancelled
                                           │   tie            → admin manual
                                           ▼
                                  approved | rejected | cancelled
```

### Duality request

```
   [no doc]
      │
      │ POST /api/bmid/transfer { type: "duality", taggedUserId, ... }
      ▼
   waiting_tagged
      │
      ├── tagged accepts (PATCH /api/duality/:id)
      │     ▼
      │   pending  ──── admin approves ───▶  in_review (voting)
      │     │                                    │
      │     │ admin rejects                      ▼
      │     ▼                            approved | rejected | cancelled
      │   rejected
      │
      └── tagged declines (PATCH /api/duality/:id)
            ▼
          rejected (auto, with reason "Tagged user declined")
```

---

## 8. Voting (read-only context)

When admin approves, voting opens and counters are visible on `contentRequests`:

- `voteAccept`, `voteIgnore`, `voteRefuse` — running counts.
- `votingStatus` — `"open" | "closed" | "finalized" | null`.
- `votingOutcome` — `"accepted" | "ignored" | "refused" | null`.

The mobile app can:

- ✅ **List open voting sessions:** `GET /api/bmid/voting` (verified users only). Returns content-source `votingItems` rows.
- ⚠️ **Cast a vote:** `POST /api/voting/:id/record` is **admin-token only today**. See backend gap §6.2 below.

> Detailed voting flow doc → request alada doc kore debo if needed (`MOBILE_VOTING_FLOW.md`).

---

## 9. Backend gaps for content flow

### 6.1 ⚠️ Duality should restrict to verified users

**Spec rule (BM 3.0 §3.4):** "Duality should only allow users that already exist in the BM database with a BMID/verified identity."

**Today:** `POST /api/bmid/transfer` for content does NOT check if `taggedUserId` is verified. The box endpoint does.

**Fix:** in `app/api/bmid/transfer/route.ts`, after fetching `taggedSnap`, also check:

```ts
const verified = tagged.verified === true || typeof tagged.bmidNumber === "string";
if (!verified) return error("tagged_user_not_verified", 403);
```

Mirror the box-side rule for consistency.

### 6.2 ⚠️ Mobile cannot cast a vote

`POST /api/voting/:id/record` is admin-token only (`guard(req)`). Mobile app uses Firebase token. Block.

**Fix:** swap `guard(req)` for `requireFirebaseUser(req)` in `app/api/voting/[id]/record/route.ts`. Use `firebaseUser.uid` as `actorUserId`. Keep the verified-user check that's already there.

### 6.3 ⚠️ User cannot cancel a pending content request

**Need:** Owner submitted by mistake → wants to cancel before admin reviews.

**Suggested:**

```http
DELETE /api/bmid/requests/:id
Authorization: Bearer <firebaseIdToken>
```

**Implementation:** require `firebaseUser.uid === contentRequests.userId` AND `status` ∈ `["pending", "waiting_tagged"]`. Cascade delete `dualityRequests/{id}` if exists.

### 6.4 ⚠️ Push notifications

Spec §5 lists in-app messages: "Tagged in Duality request", "Request sent to voting", "Final result approved/refused". None implemented today (only verification email).

**Fix:** FCM integration. Out of current scope.

### 6.5 ⚠️ Owner cannot fetch a single request by id

**Today:** `GET /api/content/:id` is admin-token only.

**Fix:** add `GET /api/bmid/requests/:id` with Firebase auth, requiring `firebaseUser.uid === userId || firebaseUser.uid === taggedUserId`.

---

## 10. End-to-end happy path (Duality)

```
1. Jane (verified, BMID-042) opens app → "Transfer to BMID" screen
   → GET /api/bmid/me/posts
   → picks "Joint shoot with Alex" (post-abc)

2. Selects type = Duality
   → GET /api/bmid/users/lookup
   → picks Alex (u2)

3. Submits
   → POST /api/bmid/transfer
     body: {
       type: "duality",
       postId: "post-abc",
       postTitle: "Joint shoot with Alex",
       postPreview: "...",
       postImageUrl: "...",
       taggedUserId: "u2"
     }
   → 201 { id: "content-3157" }
   → server creates contentRequests/content-3157 (status: waiting_tagged)
              + dualityRequests/content-3157 (source: content, status: waiting_tagged)
   → Jane sees "Waiting for Alex to respond"

4. Alex opens app → Respond tab
   → GET /api/bmid/duality/pending
   → sees content-3157 (source: content)

5. Alex taps Accept
   → PATCH /api/duality/content-3157 { taggedUserAction: "accepted" }
   → server: dualityRequests.status = "pending"
              contentRequests.status = "pending"
   → Jane's next refresh shows "Pending admin review"

6. Admin opens dashboard → /dashboard/duality → clicks Approve
   → server: contentRequests.status = "in_review"
              votingStatus = "open"
              votingItems/content-3157 created

7. Verified voters open Vote tab
   → GET /api/bmid/voting → see content-3157 row
   → tap Accept/Ignore/Refuse
   → POST /api/voting/content-3157/record { decision: "accept", actorUserId: "<uid>" }
       (gap §6.2 — currently blocked for mobile)
   → counters increment

8. Admin closes voting → finalize with majority outcome
   → contentRequests.status flips:
       accepted → "approved"
       refused  → "rejected"
       ignored  → "cancelled"

9. Jane opens "My BMIDs"
   → GET /api/bmid/requests
   → sees status "approved" + final vote counts
   → BMID stamp appears on the in-app post
```

---

## 11. cURL test snippets

Replace `$TOKEN` with a Firebase ID token (`firebase.auth().currentUser.getIdToken()`).

**List my posts:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/bmid/me/posts
```

**Lookup users:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/bmid/users/lookup
```

**Transfer (Own):**
```bash
curl -X POST http://localhost:3000/api/bmid/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "own",
    "postId": "post-abc",
    "postTitle": "Sunset run",
    "postPreview": "5k around the lake"
  }'
```

**Transfer (Duality):**
```bash
curl -X POST http://localhost:3000/api/bmid/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "duality",
    "postId": "post-abc",
    "postTitle": "Joint shoot",
    "postPreview": "Styled together",
    "taggedUserId": "u2"
  }'
```

**Pending duality (as tagged user):**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/bmid/duality/pending
```

**Accept duality:**
```bash
curl -X PATCH http://localhost:3000/api/duality/content-3157 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "taggedUserAction": "accepted" }'
```

**My requests:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/bmid/requests
```
