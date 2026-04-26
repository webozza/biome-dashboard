# Biome Dashboard — System Notes

Working reference for the BMID feature surface. Read this before touching bmid / bmid-box / duality / voting code so you don't re-derive the same structure every session.

## Stack

- Next.js 16 App Router, React 19, TanStack Query on the client.
- Firebase Admin (Firestore) on the server, called from `app/api/*/route.ts` handlers.
- Zustand for client state (`lib/stores/*`).
- All route handlers are under `app/api/*/route.ts` with `export const dynamic = "force-dynamic"`.

## Auth & guard

- Sign-in is **pure Firebase email/password** (same Firebase project as the `projectv` mobile app — users are shared). There is no separate dashboard credential. Login UIs: `/login` (admin entry, redirects to `/dashboard` for admins or `/bmid` for non-admins) and `/bmid/login` (user portal).
- `POST /api/auth/session` exchanges a Firebase ID token for a session payload `{ token, user: { uid, email, role, isAdmin } }`. `token` is `ADMIN_API_TOKEN` **only when** the email is in `ADMIN_EMAILS` (env, comma-separated); otherwise `null`. Non-admins are still authenticated — they just can't call admin-token endpoints.
- Most admin endpoints require `Authorization: Bearer <ADMIN_API_TOKEN>` — enforced via `guard(req)` in `lib/server/guard.ts`.
- User-facing endpoints under `/api/bmid/*` call `requireFirebaseUser(req)` (from `lib/server/auth.ts`) and verify the Firebase ID token, returning `{ ok, uid, email, isAdmin, reason }`.
- `app/dashboard/layout.tsx` gates the admin area on `user.isAdmin` and bounces non-admins to `/bmid`.

## Firestore collections (key ones)

| Collection | Source of truth for | Created by |
|---|---|---|
| `contentRequests` | BMID Content requests (own + duality-tagged) | `POST /api/content` |
| `dualityRequests` | Duality-approval state (source: `"content"` or `"box"`) | `buildDualityRequestFromContent` / `buildDualityRequestFromBox` in `lib/server/bmid.ts` |
| `votingItems` | Content-source community voting | `ensureVotingSession` in `lib/server/bmid.ts` (called from `PATCH /api/duality/[id]` on approve, `PATCH /api/content/[id]`) |
| `bmidBoxRequests` | BMID Box requests (own + duality), vote counts stored inline | `POST /api/bmid-box/requests`, seed fixtures in `lib/data/bmid-box.ts` |
| `bmidBoxSettings/global` | Global BMID Box admin settings | `ensureBmidBoxSeeded` on first read |
| `users` | Profiles & verification state | Firebase Auth registration flow + admin verification |
| `verificationRequests` | ID-verification queue | `POST /api/verification/requests` |

### `dualityRequests` doc shape (relevant fields)

```ts
{
  id: string;                            // === contentRequests.id OR === bmidBoxRequests.id
  ownerId, ownerName, taggedUserId, taggedUserName,
  taggedUserAction: "pending" | "accepted" | "declined",
  status: "pending" | "approved" | "rejected" | "waiting_tagged" | "cancelled",
  source: "content" | "box",             // discriminator — determines which collection gets mirrored
  decisionHistory, timeline, reviewedBy, adminNote
}
```

### `bmidBoxRequests` doc shape (relevant fields)

```ts
{
  id: string;                            // e.g. "box-2402"
  type: "own" | "duality",
  currentStatus: "draft" | "submitted" | "pending_admin_review" | "pending_tagged_user"
                | "pending_voting" | "approved" | "refused" | "cancelled" | "removed",
  votingStatus: "open" | "closed" | "finalized" | null,
  acceptCount, ignoreCount, refuseCount,  // vote counts stored ON the request (no separate votingItem)
  taggedUserAction: "pending" | "accepted" | "ignored" | "refused" | null,
  ownerSnapshot, taggedSnapshot,          // user identity at submission time
  previewData: { title, caption, description, thumbnailUrl, embedEnabled, contentType },
  history: BmidBoxHistoryEntry[],         // append-only audit log
  votes?: BmidBoxVote[],                  // stored inline by castBmidBoxVote
  votingStartAt, votingEndAt, finalizedAt,
  rejectionReason, removalReason,
}
```

## BMID flow (two parallel systems, NOT merged)

### BMID Content (text/link posts submitted inside the app)

1. `POST /api/content` creates `contentRequests/{id}` with `type: "duality"` → also creates a matching `dualityRequests/{id}` with `source: "content"` via `buildDualityRequestFromContent`.
2. Tagged user responds via `POST /api/duality/{id}/respond` → `applyTaggedUserDecision` updates `dualityRequests` AND `contentRequests` (since `source === "content"`).
3. Admin approves via `PATCH /api/duality/{id}` with `status: "approved"` → creates `votingItems/{id}` via `ensureVotingSession`, sets content to `in_review`.
4. Votes cast via `POST /api/voting/{id}/record` → increments `votingItems` counters, `syncVotingToContent` mirrors status back to `contentRequests`.

### BMID Box (external URLs submitted via Box)

1. `POST /api/bmid-box/requests` creates `bmidBoxRequests/{id}`. If `type: "duality"` with a `taggedUserId`, also creates `dualityRequests/{id}` with `source: "box"` and sets `currentStatus: "pending_tagged_user"`.
2. Tagged user responds via the same `POST /api/duality/{id}/respond` → `applyTaggedUserDecision` branches on `duality.source === "box"` and updates `bmidBoxRequests` (`currentStatus` → `pending_admin_review` on accept, `refused` on decline) instead of `contentRequests`.
3. Admin advances via `PATCH /api/bmid-box/requests/[id]` (or whichever action endpoint) → `applyBmidBoxAction` in `lib/server/bmid-box.ts` moves through `pending_admin_review` → `pending_voting` → `approved`/`refused`, setting `votingStatus: "open"` etc.
4. Votes cast via `POST /api/voting/{id}/record`: if the id matches a `bmidBoxRequests` doc the handler calls `castBmidBoxVote` which increments `acceptCount/ignoreCount/refuseCount` inline on the request and appends to `votes[]` and `history[]`. There is NO separate `votingItems` doc for box.

## `/api/voting` — merged list

`GET /api/voting` returns a unified voting list:
- `votingItems` docs (content-source, full schema).
- Synthesized rows from `bmidBoxRequests` where `votingStatus` is set (box-source, built from inline counts).

Filters (`status`, `requestType`, `outcome`) are applied in memory; there are no Firestore composite indexes.

`POST /api/voting/{id}/record` dispatches by looking up `bmidBoxRequests/{id}` first. If present → `castBmidBoxVote`. Else → existing `votingItems` transaction flow.

## Important quirks (easy to break)

1. **No Firestore composite indexes.** Any handler that does `where(...)` + `orderBy(differentField)` will fail with `list_failed`. The pattern in this repo is to do a plain collection read and filter/sort in memory. Examples: `app/api/duality/pending/route.ts`, `app/api/duality/route.ts`, `app/api/voting/route.ts`. Do NOT reintroduce `buildList` for these.
2. **`dualityRequests.id === parent request id`** (either `contentRequests.id` or `bmidBoxRequests.id`). Always create with `createDoc("dualityRequests", payload, parentId)` and keep them in sync.
3. **`ensureBmidBoxSeeded()` is idempotent and runs backfills.** It ensures settings seed, backfills owner/tagged snapshots on older box docs, and (since the box-duality wiring) backfills `dualityRequests` docs for any `bmidBoxRequests` in `pending_tagged_user` state. Endpoints that read `dualityRequests` should call it first so seeded-but-not-migrated data shows up: `/api/duality/pending`, `/api/bmid/duality/pending`, `/api/duality`, `/api/voting`.
4. **Box voting does not create `votingItems` docs.** Counts live on `bmidBoxRequests`. Don't add a `votingItems` mirror — the merge happens in the GET handler instead.
5. **`applyTaggedUserDecision(id, duality, actorName, decision)` branches on `duality.source`.** When adding new duality-consumer features, always pass the full `DualityRequestDoc` so the branch is correct.
6. **Seed data is in `lib/data/*.ts`, not in Firestore by default.** Admin must hit `POST /api/bmid-box/admin/seed` once to push the fixtures. Fresh Firestore = empty lists until seeded.
7. **`ADMIN_API_TOKEN`** must be passed by the dashboard client; it's read from the auth store (`useAuthStore((s) => s.apiToken)`). Missing token ⇒ queries disabled.

## Useful files at a glance

| File | What |
|---|---|
| `lib/server/bmid.ts` | Content-side types, `buildDualityRequestFromContent`, `buildDualityRequestFromBox`, `applyTaggedUserDecision`, `ensureVotingSession`, `syncVotingToContent`, `computeVotingOutcome` |
| `lib/server/bmid-box.ts` | Box-side CRUD, seeding, snapshot/duality backfills, `applyBmidBoxAction`, `castBmidBoxVote` |
| `lib/server/firestore.ts` | `getDoc`, `updateDoc`, `createDoc`, `listCollection`, `deleteManyDocs`, `countCollection` |
| `lib/server/guard.ts` / `auth.ts` | Admin-token guard and Firebase user auth |
| `lib/data/bmid-box.ts` | Box seed fixtures + TypeScript types (`BmidBoxRequest`, `BmidBoxRequestStatus`, etc.) |
| `lib/data/mock-data.ts` | Users, verification requests, content requests fixtures |
| `app/dashboard/bmid/respond/page.tsx` | Tagged-user response UI (pulls `/api/duality/pending`) |
| `app/dashboard/bmid/vote/page.tsx` | Voting UI (pulls `/api/voting?status=open`) |
| `app/dashboard/duality/page.tsx` | Admin duality list + approve/reject drawer |
| `app/dashboard/bmid-box/_components/*` | Box admin tabs (requests / voting / audit) |

## Theming

- Theme is `light` | `dark`, stored in `lib/stores/theme-store.ts`. `components/theme-sync.tsx` toggles the `.dark` class on `<html>`.
- Tokens live in `app/globals.css` as CSS variables (`--background`, `--surface`, `--border`, `--text-main`, `--card-shadow`, etc.).
- Many components use dark-theme utilities like `border-white/10` and `bg-white/[0.03]`. These are invisible on white. `globals.css` remaps them in light mode (`html:not(.dark) [class*="border-white/"] { border-color: var(--border); }` etc.) and softens Tailwind `.shadow-*` utilities to the subtle `--card-shadow`. If you need a colored glow in light mode, hard-code the specific box-shadow on the element instead of relying on `shadow-lg shadow-emerald-500/20`, because the generic shadow size is flattened in light.

## Changelog of non-obvious fixes

- **Box-source duality wired into `/dashboard/bmid/respond`**: previously only content duality showed up. Added `buildDualityRequestFromBox`, source-branched `applyTaggedUserDecision`, backfill for seeded data, and a source badge in the UI.
- **`/dashboard/duality` `list_failed` on `source=box` filter**: replaced `buildList` with in-memory filtering in `app/api/duality/route.ts`.
- **`/dashboard/bmid/vote` empty "Open Sessions"**: `/api/voting` now merges `votingItems` with `bmidBoxRequests` where `votingStatus` is set; `/api/voting/[id]/record` dispatches to `castBmidBoxVote` when the id is a box request.
- **Light-mode legibility**: added `html:not(.dark)` overrides in `globals.css` to remap `border-white/*` → `var(--border)`, `bg-white/*` → `var(--overlay-weak)`, and completely remove box-shadows (Tailwind `.shadow-*` utilities including arbitrary `shadow-[...]` values, `.card`, `.table-container`, `.detail-pane`, and `--card-shadow`/`--accent-shadow` tokens) in light mode. `components/ui/status-badge.tsx` gates its `shadow-[...]` + `blur-md` halo on `dark:` so badges stay flat in light mode.
