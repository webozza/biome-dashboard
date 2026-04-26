# BM 3.0 — App Workflow & Implementation Map

This document maps the BM 3.0 functional spec (Verification + BMID Content + BMID Box) to the actual endpoints, Firestore collections, and state machines in this repo. Use it as the bridge between the client-facing flow doc and the code.

For technical-only reference see `SYSTEM_NOTES.md`. For raw endpoint reference see `API.md`. For the simple admin user-guide see `USER_GUIDE.md`.

---

## 1. Actors and surfaces

| Actor | Surface | Auth |
|---|---|---|
| Mobile/web user (any) | `projectv` mobile app + `/bmid` portal | Firebase email/password |
| Verified user (BMID holder) | Same as above + Content/Box/Voting features unlocked | Firebase ID token; `users.verified === true` AND `users.bmidNumber` set |
| Tagged user | `/bmid/respond` | Firebase ID token |
| BM Admin | `/dashboard` (this app) | Firebase email in `ADMIN_EMAILS` env → server issues `ADMIN_API_TOKEN` |

Two auth modes coexist: **admin-token** for `/api/*` admin endpoints (`Authorization: Bearer <ADMIN_API_TOKEN>`) and **firebase-token** for `/api/bmid/*` user endpoints (`Authorization: Bearer <firebaseIdToken>`).

---

## 2. The three modules at a glance

| Module | Source of truth | Owner-side endpoint | Admin queue page | Final state lives in |
|---|---|---|---|---|
| Verification | `verificationRequests` | `POST /api/verification` | `/dashboard/verification` | `users.verified` + `users.bmidNumber` |
| BMID Content | `contentRequests` (+ `dualityRequests` if duality) | `POST /api/bmid/transfer` | `/dashboard/content`, `/dashboard/duality` | `contentRequests.status` + `votingItems` |
| BMID Box | `bmidBoxRequests` (+ `dualityRequests` if duality) | `POST /api/bmid-box/requests` | `/dashboard/bmid-box` | `bmidBoxRequests.currentStatus` (votes inline) |

> Content and Box are **parallel** systems. They both feed Duality (`dualityRequests` discriminated by `source: "content" | "box"`) and they both feed the unified `/api/voting` list, but their state and counters live in different collections. Don't merge them.

---

## 3. Verification flow

Spec rules (from BM 3.0 §2.1, §3.1): user must own ≥1 Meta/TikTok account, ≥1 year of post history, real identity. Admin can also remove a verified user later.

### State machine (`verificationRequests.status`)

```
[no doc] -- user submits --> pending
pending  -- admin approves --> approved   (assigns BMID-NNN, sets users.verified = true)
pending  -- admin rejects  --> rejected
approved -- admin DELETEs request --> [doc gone]   (also flips users.verified = false, users.bmidNumber = null)
```

### Endpoints

| Step | Method | Path | Auth | Notes |
|---|---|---|---|---|
| User submits | `POST` | `/api/verification` | Firebase user **OR** admin token | Body must include `email` (admin path) or is taken from session. Sets `status: "pending"` |
| List queue | `GET` | `/api/verification?status=pending` | Admin | Filters: `status`, `platform`, `userId` |
| Open one | `GET` | `/api/verification/:id` | Admin | |
| Approve | `PATCH` | `/api/verification/:id` body `{status:"approved", reviewedBy, adminNote}` | Admin | Triggers `ensureApprovedUserState(userId)` → assigns next sequential `BMID-NNN`, sets `users.verified=true`. Sends email via `sendVerificationEmail`. |
| Reject | `PATCH` | `/api/verification/:id` body `{status:"rejected", rejectionReason, reviewedBy}` | Admin | Sends rejection email |
| Remove (revoke BMID) | `DELETE` | `/api/verification/:id` | Admin | If was `approved`, also sets `users.verified=false` and clears `bmidNumber` |

### BMID number assignment

Implemented in `app/api/verification/[id]/route.ts::ensureApprovedUserState`:

1. Read user doc inside a Firestore transaction.
2. If `bmidNumber` already exists → reuse it.
3. Otherwise scan all users, find max `BMID-NNN` sequence, assign `max+1` zero-padded to 3 digits (e.g. `BMID-007`).
4. Mirror `bmidNumber` back onto the verification doc so the admin row shows the assigned number.

### Notifications

`sendVerificationEmail(email, "approved"|"rejected", {...})` — fires on approval/rejection if email is present (`lib/server/email/transport.ts`). Spec §5 lists in-app messages too — those are not yet wired and remain on the gap list.

---

## 4. BMID Content flow

Spec rules (§3.2): a verified user takes an existing in-app post and "transfers" it into BMID. Type is **own** or **duality**. Voting opens after admin approves; only verified users vote; outcome is the majority of accept/ignore/refuse.

### State machine (`contentRequests.status`)

```
own request:
  pending --(admin approve)--> in_review --(community vote finalized)--> approved | rejected | cancelled

duality request:
  waiting_tagged --(tagged accepts)--> pending --(admin approve)--> in_review --(vote finalized)--> approved|rejected|cancelled
  waiting_tagged --(tagged declines)--> rejected
```

`votingStatus` runs in parallel: `null → open → closed → finalized`. `votingOutcome`: `accepted | ignored | refused | null`.

`syncVotingToContent()` (in `lib/server/bmid.ts`) decides the final `status` from the outcome:
- `accepted` → `status: "approved"`
- `refused` → `status: "rejected"` with reason "Community voted to refuse"
- `ignored` → `status: "cancelled"` with reason "Community vote resulted in ignore"

### Endpoints

| Step | Method | Path | Auth | Notes |
|---|---|---|---|---|
| User transfers their own post → BMID | `POST` | `/api/bmid/transfer` | Firebase user (must be verified) | Reads post from `users/{uid}/posts/{postId}`. Creates `contentRequests/{auto-id}`. If duality, also creates `dualityRequests/{same-id}` with `source:"content"`. |
| Admin create (test/seed) | `POST` | `/api/content` | Admin | Same shape; explicit `userId`/`taggedUserId` |
| List user's own | `GET` | `/api/bmid/requests` | Firebase user | Returns posts where `userId == me` OR `taggedUserId == me` |
| Admin queue list | `GET` | `/api/content?status=pending` | Admin | Filters: `status`, `userId`, `type` |
| Tagged-user pending list | `GET` | `/api/bmid/duality/pending` | Firebase user | Returns `dualityRequests` where `taggedUserId == me` AND `status == "waiting_tagged"` |
| Tagged user responds | `POST` | `/api/duality/:id/respond` body `{decision:"accepted"\|"declined", actorUserId, actorName}` | Admin token (used by dashboard) | Calls `applyTaggedUserDecision`. Branches on `duality.source` — content side only here. |
| Tagged user responds (self-serve) | `PATCH` | `/api/duality/:id` body `{taggedUserAction:"accepted"\|"declined"}` | Firebase user (must match `taggedUserId`) OR admin | Same `applyTaggedUserDecision` |
| Admin approves (opens voting) | `PATCH` | `/api/duality/:id` body `{status:"approved", reviewedBy, adminNote}` | Admin | Requires `taggedUserAction === "accepted"`. Sets content `status:"in_review"`, `votingStatus:"open"`, calls `ensureVotingSession` which creates `votingItems/{id}`. |
| Admin approves (own request, no duality) | `PATCH` | `/api/content/:id` body `{status:"approved"}` | Admin | Same effect — creates voting session. Rejects with `tagged_user_pending` if duality not yet accepted. |
| Admin rejects | `PATCH` | `/api/duality/:id` or `/api/content/:id` body `{status:"rejected", adminNote, reviewedBy}` | Admin | Mirrors rejection across both docs |

### Voting (content-source)

| Step | Method | Path | Auth | Notes |
|---|---|---|---|---|
| List open sessions (user-side) | `GET` | `/api/bmid/voting` | Firebase user (must be verified) | Returns `votingItems` where `status == "open"` |
| List sessions (admin merged with box) | `GET` | `/api/voting?status=open` | Admin | Merges `votingItems` + box-source rows synthesized from `bmidBoxRequests.votingStatus` |
| Cast vote | `POST` | `/api/voting/:id/record` body `{decision:"accept"\|"ignore"\|"refuse", actorUserId, actorEmail}` | Admin token (proxied from dashboard) | Verifies the actor's `users.verified === true`. Increments counters atomically. One vote per `actorUserId` (tracked in `votingItems/{id}/votes/{actorUserId}` subcollection). |
| Close / finalize | `PATCH` | `/api/voting/:id` body `{status:"finalized", outcome, closedAt}` | Admin | `syncVotingToContent` mirrors final state onto `contentRequests` |

### Outcome rule (current implementation)

`computeVotingOutcome(accept, ignore, refuse)` returns the **strict winner** (single max). Ties → `null` (no outcome). Today there is no time-based auto-close and no quorum threshold — closure is admin-driven via `PATCH /api/voting/:id`. Both items appear on the spec gap list (§7).

---

## 5. BMID Box flow

Spec rules (§3.3): verified user pastes/shares external content from an allowed platform (Instagram, TikTok, YouTube, Facebook). Goes through the same Own/Duality split and the same Accept/Ignore/Refuse vote.

### State machine (`bmidBoxRequests.currentStatus`)

```
own request:
  pending_admin_review --(admin approve_request)--> pending_voting --(admin approve_request again)--> approved
                                                                  --(admin reject_request)----------> refused
                                                                  --(admin remove_request)----------> removed
                                                                  --(admin finalize_voting)---------> approved | refused | cancelled

duality request:
  pending_tagged_user --(tagged accepts)--> pending_admin_review --> ... (same as above)
  pending_tagged_user --(tagged declines)--> refused
```

`votingStatus` runs in parallel: `null → open → closed → finalized`. **Vote counts are stored inline** on the request (`acceptCount`, `ignoreCount`, `refuseCount`) and there is **no separate `votingItems` doc** for box.

### Endpoints

| Step | Method | Path | Auth | Notes |
|---|---|---|---|---|
| User submits box | `POST` | `/api/bmid-box/requests` | Admin token (today; portal proxies it) | Owner must be verified + have `bmidNumber`. Platform must be in `bmidBoxSettings/global.allowedPlatforms`. If duality, tagged user must also be verified and ≠ owner; creates `dualityRequests/{same-id}` with `source:"box"`. |
| Admin queue list + summary | `GET` | `/api/bmid-box/requests` | Admin | Returns `{items, summary}` |
| Open one | `GET` | `/api/bmid-box/requests/:id` | Admin | |
| Tagged user responds (box) | `POST` | `/api/duality/:id/respond` | Admin (proxy) | Same handler as content. `applyTaggedUserDecision` branches on `duality.source === "box"` and updates `bmidBoxRequests` (`pending_admin_review` on accept, `refused` on decline). |
| Admin: open voting | `POST` | `/api/bmid-box/requests/:id/approve` body `{actorName, note}` | Admin | First call moves `pending_admin_review → pending_voting` (sets `votingStatus:"open"`). Second call moves `pending_voting → approved` (sets `votingStatus:"finalized"`). |
| Admin: reject | `POST` | `/api/bmid-box/requests/:id/reject` body `{actorName, rejectionReason}` | Admin | `currentStatus → refused` |
| Admin: mark invalid | `POST` | `/api/bmid-box/requests/:id/invalid` | Admin | `currentStatus → cancelled` |
| Admin: remove (post-vote takedown) | `POST` | `/api/bmid-box/requests/:id/remove` | Admin | `currentStatus → removed` |
| Admin: stage shortcuts | `POST` | `/api/bmid-box/requests/:id/tagged-stage`, `.../voting-stage` | Admin | Skip directly to that stage |
| Admin: notes | `POST` | `/api/bmid-box/requests/:id/notes` | Admin | Append `adminNotes[]` |
| List voting rows | `GET` | `/api/bmid-box/voting` | Admin | Box-only voting view |
| Cast vote (admin direct) | `POST` | `/api/bmid-box/voting/:id/cast` body `{voterUserId, voterName, voteType}` | Admin | Direct call to `castBmidBoxVote` |
| Cast vote (unified) | `POST` | `/api/voting/:id/record` | Admin (proxy) | Handler looks up `bmidBoxRequests/:id` first; if found → `castBmidBoxVote` (inline counters). Else → existing `votingItems` transaction. **One unified entry point.** |
| Close voting | `POST` | `/api/bmid-box/voting/:id/close` | Admin | `votingStatus → closed` |
| Finalize voting | `POST` | `/api/bmid-box/voting/:id/finalize` body `{result:"approved"\|"refused"\|"cancelled"}` | Admin | `currentStatus → result`, `votingStatus → finalized` |

### Allowed platforms

Read from `bmidBoxSettings/global.allowedPlatforms` (Firestore-backed; admin-editable via `/api/bmid-box/settings`). Default seed in `lib/data/bmid-box.ts`.

### Idempotent seed

`ensureBmidBoxSeeded()` runs on every read endpoint. It (a) seeds `bmidBoxSettings/global` if missing, (b) backfills `ownerSnapshot`/`taggedSnapshot` on older box docs, (c) backfills missing `dualityRequests/{id}` for any box doc currently in `pending_tagged_user`. Don't bypass it on read paths.

---

## 6. Duality (cross-cutting)

Duality is **not a third module**. It's a state machine that lives alongside Content or Box, discriminated by `dualityRequests.source`. The doc id is always `=== contentRequests.id` OR `=== bmidBoxRequests.id`.

### State machine (`dualityRequests.status`)

```
waiting_tagged --(tagged accepts)--> pending --(admin approves)--> approved
waiting_tagged --(tagged declines)--> rejected
pending        --(admin approves)--> approved
pending        --(admin rejects)---> rejected
```

`taggedUserAction`: `pending → accepted | declined`.

### Branching: `applyTaggedUserDecision(id, duality, actorName, decision)`

In `lib/server/bmid.ts`. After updating `dualityRequests`, it branches on `duality.source`:

- `source === "content"` → updates `contentRequests/{id}` (`status: pending|rejected`, appends `adminNotes`).
- `source === "box"` → updates `bmidBoxRequests/{id}` (`currentStatus: pending_admin_review|refused`, appends `history[]`).

Always pass the full `DualityRequestDoc` so the branch is correct.

---

## 7. Audit log

`auditLogs` collection — read-only via `GET /api/audit?requestType=duality&source=box&status=approved`. Currently populated incrementally by handler-side appends (history arrays on `bmidBoxRequests` and `decisionHistory`/`timeline` on `dualityRequests`). The `/dashboard/audit` page consumes a merged view.

---

## 8. End-to-end happy-path examples

### Example A — Own BMID Content post

1. Verified user `u1` calls `POST /api/bmid/transfer` with `{postId, postTitle, postPreview, type:"own"}`.
2. Server creates `contentRequests/{auto-id}` with `status:"pending"`, `taggedUserAction:"accepted"`. No duality doc.
3. Admin opens `/dashboard/content`, picks the row, clicks Approve → `PATCH /api/content/:id {status:"approved"}`.
4. Server flips content to `status:"in_review"`, `votingStatus:"open"`, and creates `votingItems/{id}` via `ensureVotingSession`.
5. Verified voters call `POST /api/voting/:id/record` with `{decision, actorUserId}`. Counters increment on `votingItems`.
6. Admin closes via `PATCH /api/voting/:id {status:"finalized", outcome}` (or `outcome` is computed from majority).
7. `syncVotingToContent` mirrors final state onto `contentRequests`. Done.

### Example B — Duality BMID Box submission

1. Verified user `u1` calls `POST /api/bmid-box/requests` with `{type:"duality", taggedUserId:"u2", sourceUrl, sourcePlatform:"instagram"}`.
2. Server validates: u1 verified, u2 verified, u1 ≠ u2, platform allowed.
3. Creates `bmidBoxRequests/{box-NNNN}` with `currentStatus:"pending_tagged_user"`. Creates `dualityRequests/{box-NNNN}` with `source:"box"`, `status:"waiting_tagged"`.
4. u2 sees it at `GET /api/bmid/duality/pending` → accepts via `PATCH /api/duality/:id {taggedUserAction:"accepted"}`.
5. `applyTaggedUserDecision` updates the duality doc AND moves `bmidBoxRequests.currentStatus` to `pending_admin_review`.
6. Admin clicks Approve once → `POST /api/bmid-box/requests/:id/approve` → `currentStatus:"pending_voting"`, `votingStatus:"open"`.
7. Verified voters cast via `POST /api/voting/:id/record`. Handler dispatches to `castBmidBoxVote` because the id matches a box doc — counters live inline.
8. Admin clicks Approve again (or Finalize) → `currentStatus:"approved"`, `votingStatus:"finalized"`.

---

## 9. Where the spec is still open (gap list)

Mapped from BM 3.0 §7 to where decisions would land in code.

| Spec gap | Where it would be implemented |
|---|---|
| In-app vs email notifications? | `lib/server/email/transport.ts` (already wired for verification approve/reject); in-app channel does not exist yet |
| Exact wording of approval message + BMID running number format | `formatBmidNumber()` in `app/api/verification/[id]/route.ts` (currently `BMID-NNN` zero-padded) |
| Tagged user: before, after, or parallel to admin? | Today: tagged user **before** admin. Enforced in `app/api/duality/[id]/route.ts` (`tagged_user_pending` rejection on admin approve) |
| Voting closure rule (majority vs threshold vs time vs admin) | `computeVotingOutcome` (strict majority today). No quorum, no auto-timer. Closure is admin-driven (`PATCH /api/voting/:id`). |
| Vote change after submission | Currently disallowed: `votingItems/{id}/votes/{actorUserId}` enforces one-vote-per-user (`already_voted` 409). For box: `votes[]` array check. |
| Tie / too few votes | `computeVotingOutcome` returns `null` on tie. Admin must manually finalize with explicit `outcome`. |
| Reason visible to rejected user | `verificationRequests.rejectionReason` is set and email transport includes it; UI does not yet expose it on the user portal |
| What happens to existing items when verification is removed? | Today: `DELETE /api/verification/:id` flips `users.verified=false` and clears `bmidNumber`, but **does not cascade** into `contentRequests` / `bmidBoxRequests`. Open question. |
| User cancels pending request | Status `cancelled` exists in both schemas; no user-facing endpoint yet. Box has `mark_invalid` (admin-only). |
| Allowed platforms day-1 | `bmidBoxSettings/global.allowedPlatforms` — Firestore-driven, admin can edit. Default seed in `lib/data/bmid-box.ts`. |

---

## 10. Quick reference: collections ↔ endpoints

| Collection | Created by | Read by | Mutated by |
|---|---|---|---|
| `users` | Firebase Auth | most handlers | `ensureApprovedUserState` (verification), admin user CRUD |
| `verificationRequests` | `POST /api/verification` | `GET /api/verification[/:id]` | `PATCH /api/verification/:id`, `DELETE` same |
| `contentRequests` | `POST /api/bmid/transfer`, `POST /api/content` | `GET /api/content[/:id]`, `GET /api/bmid/requests` | `PATCH /api/content/:id`, `applyTaggedUserDecision`, `syncVotingToContent` |
| `dualityRequests` | `buildDualityRequestFromContent`, `buildDualityRequestFromBox` | `GET /api/duality[/:id]`, `GET /api/duality/pending`, `GET /api/bmid/duality/pending` | `PATCH /api/duality/:id`, `POST /api/duality/:id/respond`, `applyTaggedUserDecision` |
| `votingItems` | `ensureVotingSession` (content-only) | `GET /api/voting`, `GET /api/voting/:id`, `GET /api/bmid/voting` | `POST /api/voting/:id/record`, `PATCH /api/voting/:id` |
| `bmidBoxRequests` | `POST /api/bmid-box/requests`, seed | `GET /api/bmid-box/requests[/:id]`, `GET /api/voting` (merged), `GET /api/bmid-box/voting` | `applyBmidBoxAction` (approve/reject/invalid/remove/stage moves), `castBmidBoxVote`, tagged-user branch in `applyTaggedUserDecision` |
| `bmidBoxSettings/global` | `ensureBmidBoxSeeded` | `GET /api/bmid-box/settings` | `PATCH /api/bmid-box/settings` |
| `auditLogs` | (incremental, handler-driven) | `GET /api/audit` | — |

---

## 11. UI pages (where the workflow shows up)

### User portal (`/bmid/*`, Firebase user auth)

| Page | What it shows | Backed by |
|---|---|---|
| `/bmid` | "My BMID" landing — BMID number, status | `GET /api/bmid/me` |
| `/bmid/transfer` | Pick an in-app post, choose Own/Duality, submit | `GET /api/bmid/me/posts`, `POST /api/bmid/transfer`, `GET /api/bmid/users/lookup` |
| `/bmid/requests` | All my requests (created or tagged in) | `GET /api/bmid/requests` |
| `/bmid/respond` | Accept/decline duality where I'm tagged | `GET /api/bmid/duality/pending`, `PATCH /api/duality/:id` |
| `/bmid/voting` | Open voting sessions I can vote on | `GET /api/bmid/voting`, `POST /api/voting/:id/record` |

### Admin dashboard (`/dashboard/*`, admin token)

| Page | What it does | Backed by |
|---|---|---|
| `/dashboard` | Aggregate stats + summary | `GET /api/dashboard/stats`, `GET /api/dashboard/summary` |
| `/dashboard/verification` | Approve/reject/remove verification | `/api/verification` family |
| `/dashboard/content` | Approve/reject content requests | `/api/content` family |
| `/dashboard/bmid-box` | Box requests + voting + audit (tabs) | `/api/bmid-box/*` |
| `/dashboard/duality` | All duality requests, source badge, approve drawer | `/api/duality` family |
| `/dashboard/voting` | Live merged voting list, record vote, finalize | `/api/voting` family |
| `/dashboard/bmid/respond` | Tagged-user response (admin proxy) | `/api/duality/pending`, `/api/duality/:id/respond` |
| `/dashboard/bmid/transfer` | Admin-initiated content transfer (testing) | `/api/content` |
| `/dashboard/audit` | Filterable audit log + CSV | `/api/audit` |
| `/dashboard/moderation` | Reports/flags/blocked | `/api/moderation/*` |
| `/dashboard/users`, `/dashboard/posts`, `/dashboard/settings` | CRUD on users/posts/settings | `/api/users`, `/api/posts`, `/api/settings` |

---

## 12. Easy-to-break invariants (read this before editing)

1. **`dualityRequests.id === parent request id`** (either `contentRequests.id` or `bmidBoxRequests.id`). Always pass the parent id as the doc id when creating.
2. **No Firestore composite indexes**. Handlers that filter on multiple fields must read-then-filter in memory. Don't reintroduce `buildList` for these (`/api/duality/pending`, `/api/duality`, `/api/voting`).
3. **Box voting does NOT create a `votingItems` doc.** Counts live on `bmidBoxRequests`. The `/api/voting` GET merges the two; the `/api/voting/:id/record` POST dispatches by id lookup.
4. **`applyTaggedUserDecision` branches on `duality.source`.** Always pass the full `DualityRequestDoc`.
5. **`ensureBmidBoxSeeded()` is idempotent and runs backfills.** Call it on any handler that reads `dualityRequests` or `bmidBoxRequests`.
6. **Voting eligibility** is checked server-side (`users.verified === true || typeof users.bmidNumber === "string"`). Don't rely on client gating.
7. **Outcome ties** return `null`. Admin must finalize manually with an explicit `outcome` field.
