# Part B implementation plan

Follow `DESIGN.md` exactly. The brief prefers Django; this plan uses **NestJS + TypeORM + PostgreSQL + Next.js** because that is the stack in the design.

**How to use this file:** check items off in order. Do not start a later phase until the earlier one is done enough to build on.

---

## Ambiguities / judgment calls (review before coding)

Approved (2026-09-10), with overrides noted in **bold**.

- [x] **Auth:** JWT + email/password; `users` table; `Authorization: Bearer <token>`.
- [x] **Counters** on `announcements`: `sent_count`, `read_count`, `acknowledged_count`.
- [x] **`notification_preview`** on `announcements`.
- [x] **`status = sent` + `sent_at`** set in the Send transaction with recipient bulk-insert.
- [x] **draft → approve → send** state machine; AI writes drafts only.
- [x] **Retry fields** `attempt_count` / `next_attempt_at`. **Override:** fixed delay (`WORKER_RETRY_DELAY_MS`), not exponential backoff. After 5 failures → `failed`.
- [x] **RSVP columns only**; no RSVP API/UI.
- [x] **UI shows caller’s local** (read-only); classification filter is real.
- [x] **GET member announcement** sets `read_at` once; separate acknowledge POST.
- [x] **Poll GET /announcements/:id every 4s.** No websocket.
- [x] **Failed-authz:** **one log line** (no logging module). Skip reconciliation query.
- [x] **AI:** OpenAI-compatible HTTP via env; errors stay on the draft path.
- [x] **Compose Phase 1:** postgres + api + web. Optional LB profile later.
- [x] **REST paths** as in Phase 4.
- [x] **Seed password:** `password123` for all four accounts.
- [x] **Layout:** `backend/`, `frontend/`, root `docker-compose.yml`.
- [x] **Audience override:** Send only to `role = 'member'` (exclude leadership). Active + optional classification still apply.
- [x] **Phase 9 override:** automated double-`/send` test only; **do not** write a concurrent-worker race test; explain SKIP LOCKED in the README.

---

## Phase 1 — Project scaffold

- [x] Create `backend/` NestJS app (TypeScript, `src/` modules).
- [x] Backend packages: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/typeorm`, `typeorm`, `pg`, `class-validator`, `class-transformer`, `uuid`, `bcrypt`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/schedule`, `@nestjs/axios` (or `fetch`) for the AI provider.
- [x] Backend Nest modules to add: `AppModule`, `ConfigModule` (global), `TypeOrmModule.forRootAsync`, `AuthModule`, `MembersModule`, `LocalsModule` (minimal), `AnnouncementsModule`, `NotificationsModule` (mock delivery adapter + scheduled worker), `AiModule` (draft only).
- [x] Enable `ScheduleModule.forRoot()` for the send worker.
- [x] TypeORM `synchronize: false`; migrations as source of schema truth.
- [x] Create `frontend/` Next.js app (App Router unless you override). Packages: `next`, `react`, `react-dom`. No UI kit required (unstyled is in scope).
- [x] Root `docker-compose.yml`: services `db` (Postgres 16), `api` (backend), `web` (frontend). Shared Docker network. `api` waits on `db` healthcheck.
- [x] Env files / compose env: `DATABASE_URL` (or host/port/user/pass/db), `JWT_SECRET`, `JWT_EXPIRES_IN`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_TIMEOUT_MS` (propose 15000), `WORKER_BATCH_SIZE` (propose 100), `WORKER_INTERVAL_MS` / cron expression, `API_PORT`.
- [x] `.gitignore` for `node_modules`, `.env`, build output. Do not commit secrets.
- [x] Root README stub with `docker compose up --build` (fill fully in Phase 10).

---

## Phase 2 — Entities & migrations

Four tables from DESIGN.md, plus the denormalized counters and the extra columns the design already named.

- [x] Migration: `locals` (`id uuid PK`, `name text not null`).
- [x] Migration: `users` (login identity) — **judgment, see above** (`id uuid PK`, `email text unique not null`, `password_hash text not null`).
- [x] Migration: `members`:
  - [x] `id uuid PK`
  - [x] `local_id uuid not null → locals`
  - [x] `full_name text not null`
  - [x] `email text not null`
  - [x] `classification text not null`
  - [x] `status text not null` check/in-app: `active | retired | suspended`
  - [x] `role text not null` check/in-app: `member | leadership`
  - [x] `user_id uuid not null unique → users`
  - [x] index on `(local_id, status)` for audience queries
  - [x] index on `(local_id, classification, status)`
- [x] Migration: `announcements`:
  - [x] Starting-point fields: `id`, `local_id → locals`, `title`, `body`, `needs_ack boolean not null default false`, `sent_at timestamptz null`, `created_at timestamptz not null default now()`
  - [x] Design extras: `requires_attendance boolean not null default false`, `status text not null` (`draft | approved | sent`), `created_by uuid not null → members`
  - [x] Denormalized counters: `sent_count int not null default 0`, `read_count int not null default 0`, `acknowledged_count int not null default 0`
  - [x] **Judgment:** `notification_preview text null`
- [x] Migration: `announcement_recipients`:
  - [x] `id uuid PK`
  - [x] `announcement_id uuid not null → announcements` (cascade delete OK for this slice)
  - [x] `member_id uuid not null → members`
  - [x] `status text not null` (`queued | sent | failed`)
  - [x] `read_at timestamptz null`
  - [x] `acknowledged_at timestamptz null`
  - [x] `attendance_response text null` (`coming | not_coming`) — column only, no API this slice
  - [x] `sent_at timestamptz null`
  - [x] **UNIQUE (`announcement_id`, `member_id`)** — Rule 2 invariant
  - [x] **Judgment:** `attempt_count int not null default 0`, `next_attempt_at timestamptz null`
  - [x] index on `(status, next_attempt_at)` for the worker
- [x] TypeORM entities matching the migrations 1:1. No extra tables beyond `users` unless this plan is revised.
- [x] Run migrations against compose Postgres; confirm unique constraint exists in the DB.

---

## Phase 3 — Auth & Rule 1 (global, opt-out to be wrong)

Enforcement is server-side on every request. Client `local_id` is never an authorization input.

- [ ] `POST /auth/login` `{ email, password }` → `{ accessToken, member: { id, localId, role, fullName } }`. Resolve the single `members` row for that user.
- [ ] JWT payload: `sub` = user id, plus `memberId`, `localId`, `role` (convenience; **re-load member from DB in the guard** so a stale token cannot keep a changed role/local).
- [ ] Global `JwtAuthGuard` via `APP_GUARD`. Mark only `POST /auth/login` (and health) with `@Public()`.
- [ ] Request user shape after auth: `{ userId, memberId, localId, role }` from the **member row**, not from the request body.
- [ ] Shared **query scope**: every entity with `local_id` is queried through a tenant-scoped helper/repository/QueryBuilder that **always** adds `WHERE local_id = :requestLocalId`. New services use this by default.
- [ ] `announcement_recipients` have no `local_id`: join/filter via parent `announcements.local_id` (or member’s `local_id`) inside that same helper so they cannot be fetched cross-tenant by id alone.
- [ ] Shared **leadership gate**: `@Roles('leadership')` + global or module `RolesGuard`. Member-only routes omit it. A new leadership endpoint that forgets nothing still has JWT + tenant scope; leadership actions require the role decorator (document this: role is opt-in for write/leadership, tenant scope is default).
- [ ] **Judgment on “opt-out to be wrong” vs Nest defaults:** tenant `local_id` filter is the default for all resource queries. Bypass only via an explicitly named method (e.g. `unsafeUnscopedQuery`) that we do not use in HTTP handlers.
- [ ] Reject / ignore `local_id` (and `role`) if present in body or query for authorization. Audience local is always `request.user.localId`.
- [ ] On authorization **failure** (authenticated user, wrong local or wrong role): one `Logger` line (local ids, member id, path, resource id); no dedicated logging module. Return 404 for cross-local resource ids, 403 for role failures on a resource in the caller’s local.
- [ ] Health endpoint `GET /health` unauthenticated (compose/README).

---

## Phase 4 — Core endpoints

All routes below inherit Phase 3 guards. Paths are proposals (see ambiguities).

### Auth

- [ ] `POST /auth/login` — public — issue JWT.

### Leadership (role = `leadership`; scoped to caller’s `local_id`)

- [ ] `POST /announcements` — create `draft` with `title`, `body`, optional `notificationPreview`, `needsAck`, optional `classification` (stored for send-time audience; **proposal:** `target_classification text null` on `announcements` — **this column is not in DESIGN.md**; alternative is to pass classification only on send. **Prefer: pass `classification` on send only**, do not add a column unless you want drafts to remember the filter.)
- [ ] **Judgment — where classification lives:** DESIGN.md does not store it. **Proposal:** `POST /announcements/:id/send` body `{ classification?: string }`. If omitted, all **active** members of the caller’s local. If set, active + that classification. Retired/suspended never included.
- [ ] `GET /announcements` — list announcements for caller’s local (id, title, status, counters, sentAt). Enough for the one UI to reopen the seeded sent item.
- [ ] `GET /announcements/:id` — one announcement + counters (`sentCount`, `readCount`, `acknowledgedCount`). 404 if other local.
- [ ] `PATCH /announcements/:id` — edit `title`/`body`/`notificationPreview`/`needsAck` only while `status = draft`.
- [ ] `POST /announcements/:id/approve` — `draft → approved`. Reject if not draft.
- [ ] `POST /announcements/:id/send` — see Phase 5. Reject if not `approved`. Idempotent if already `sent` (no second recipient insert; unique constraint is the backstop).
- [ ] Do **not** expose member PII list endpoints for other locals. No “list all members” required for the leadership screen (counts only).

### Members (inbox for `role = member`; leadership uses leadership routes)

**Approved:** leadership accounts are **not** in the send audience (`role = 'member'` only).

- [ ] `GET /me/announcements` — recipient rows for `member_id = me`, join announcement; only if announcement.local_id == me.local_id (redundant if recipient insert was scoped). Return title, body, needsAck, recipient status, readAt, acknowledgedAt.
- [ ] `GET /me/announcements/:id` — one; set `read_at` if null and bump `read_count` in the same transaction.
- [ ] `POST /me/announcements/:id/acknowledge` — set `acknowledged_at` if null; bump `acknowledged_count` once. If `needs_ack` is false, still allow ack (**or** 400 — **proposal: allow**, idempotent).
- [ ] No RSVP endpoint this slice.

### Out of slice (do not build unless plan changes)

- [ ] Attendance coming/not_coming API
- [ ] Archive/delete announcements
- [ ] Real push provider
- [ ] Member UI
- [ ] Websocket/SSE

---

## Phase 5 — Async send + Rule 2

Synchronous Send (fast):

- [ ] Guard: caller is leadership; `announcement.local_id == caller.local_id`; `status == approved`.
- [ ] In **one DB transaction**:
  - [ ] Lock the announcement row (`SELECT … FOR UPDATE`) so a retried/concurrent Send cannot double-insert.
  - [ ] Re-read status; if already `sent`, return success with existing id/counters (no-op).
  - [ ] Resolve audience: `members` where `local_id = announcement.local_id` AND `role = 'member'` AND `status = 'active'` AND optional `classification`. Leadership is excluded.
  - [ ] Bulk-insert `announcement_recipients` (`status = queued`). Unique `(announcement_id, member_id)` makes a second insert a hard failure — catch unique violation and treat as already queued/sent.
  - [ ] Set announcement `status = sent`, `sent_at = now()` (per judgment above). Do **not** wait for workers.
- [ ] Return 202 or 200 with announcement id + counters (queued not yet in `sent_count`). **Proposal:** 202 Accepted.

Asynchronous worker (scheduled task, not in-request):

- [ ] `@Cron` / interval job in `NotificationsModule` (all API instances may run it — **this is why SKIP LOCKED matters**).
- [ ] Each tick: `BEGIN`; `SELECT … FROM announcement_recipients WHERE status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= now()) ORDER BY id LIMIT :batch FOR UPDATE SKIP LOCKED`; process batch; `COMMIT`.
- [ ] Delivery adapter: **mock** — log member id + announcement id (no FCM). Success → `status = sent`, `sent_at = now()`, increment `announcements.sent_count` **in the same transaction**.
- [ ] On adapter throw: increment `attempt_count`, set `next_attempt_at = now() + WORKER_RETRY_DELAY_MS` (fixed delay), or `status = failed` after max attempts. Never insert a second recipient row.
- [ ] Worker **skips** rows already `sent` (they will not match the queued predicate).
- [ ] Document the honest limitation from DESIGN.md: mock adapter is in-process; a crash after “provider” success and before commit could theoretically duplicate at a real provider. Out of scope.

Optional devops bonus (only if spine is solid):

- [ ] Compose profile: `nginx` round-robin to `api-1` and `api-2`; both share Postgres; same worker + SKIP LOCKED. Rule 2 still holds.

---

## Phase 6 — AI draft feature

Isolated from send. Slow/down AI must not block or corrupt Send.

- [ ] `POST /announcements/ai-draft` (leadership) body `{ note: string }` → `{ title, body, notificationPreview }` from the model. **Does not** insert recipient rows. **Proposal:** also persist a new `announcements` row as `status = draft` with those fields so the UI can approve/send by id. Alternative: return text only and let `POST /announcements` save — pick one. **Prefer persist-as-draft** so the state machine is in the DB.
- [ ] Prompt: informal note → clear title, body, preview ≤ 120 chars.
- [ ] Timeout + error mapping: provider down/slow → 503/504 with message; no status change to `approved`/`sent`; no worker involvement.
- [ ] `POST /announcements/:id/approve` is the only path `draft → approved`.
- [ ] `POST /announcements/:id/send` **rejects** unless `status === 'approved'` (not `draft`). After send, `sent` as in Phase 5.
- [ ] Manual compose (no AI): `POST /announcements` still creates `draft`; same approve → send. AI is optional on the screen.
- [ ] Do not call the AI provider from the worker or from Send.

---

## Phase 7 — Seed script

Re-runnable (wipe-or-upsert documented). Match DESIGN.md / brief numbers.

- [ ] 2 locals: e.g. **Local 27** (larger) and **Local 99** (smaller).
- [ ] Larger local: **~2,000** members; smaller: **200**.
- [ ] **3–4 classifications** across both (e.g. Journeyman Wireman, Apprentice 3rd Year, plus 1–2 more). Mix statuses: mostly `active`, some `retired` / `suspended` so a careless unfiltered query is visible.
- [ ] Per local: **one leadership login** and **one member login** (4 users total) with known emails/passwords.
- [ ] One **already-sent** announcement in the **larger** local: `status = sent`, `sent_at` set, recipient rows for **active `role = member`** audience (leadership excluded), some `read_at` / `acknowledged_at` so counters are non-zero. Capture this announcement **id** for README.
- [ ] Capture **one member id from the other local** for the cross-local README curl.
- [ ] Idempotent: second run does not duplicate locals/members/the seeded announcement (delete-and-reseed or upsert by email).
- [ ] Wire as `npm run seed` in backend, also runnable after compose is up.

---

## Phase 8 — Frontend (one leadership page)

Unstyled is acceptable. No member UI.

- [ ] Single page (e.g. `/`) after login: title + body fields, optional “messy note” + **Draft with AI**, **Approve**, **Send**, classification optional select, **needs ack** checkbox.
- [ ] Local: display caller’s local name/id; not a picker of all locals.
- [ ] After send (or when viewing the seeded announcement): show **sent / read / acknowledged** from `GET /announcements/:id`.
- [ ] Poll that GET every **3–5 seconds** (design: 3–5s) while the announcement is `sent` and the page is open. Do not query recipient rows from the UI.
- [ ] Login form (email/password) storing JWT for API calls (`NEXT_PUBLIC_API_URL`).
- [ ] AI: paste note → call ai-draft → fill title/body/preview; user can edit; cannot Send until Approve succeeded (disable Send while `draft`; enable after `approved`).
- [ ] Error display if AI fails; Send still works for a manual approved draft.
- [ ] Optional: load seeded announcement id from env or a tiny “open existing id” input so reviewers can watch counters without sending again.

---

## Phase 9 — Tests / verification

Brief README requires evidence for Rule 1 (cross-local) and Rule 2 (no double send). Automate both.

- [ ] **Cross-local access test:** login as Local 27 leadership (or member); `GET /announcements/:id` (and member GET) for an announcement that belongs to Local 99 → not 200 with that local’s data. Same for a Local 99 member id used against Local 27-only routes. Assert no other-local member PII in the body.
- [ ] **Member cannot use leadership actions:** member JWT on `POST /announcements/:id/send` (and approve/ai-draft) → 403.
- [ ] **Double-send test:** create/approve/send; call `POST /announcements/:id/send` a second time; assert no duplicate `announcement_recipients` rows. **Do not** add a concurrent-worker race test; document SKIP LOCKED safety in the README instead.
- [ ] Seed + compose smoke: login four accounts; member `GET` + `acknowledge` on a sent item in their local; counters increment once (idempotent ack).
- [ ] Retired/suspended members are not in a new send’s recipient set.

Run these via Nest e2e (`supertest`) against a test DB, and keep equivalent `curl` snippets for the README.

---

## Phase 10 — README

Short (brief: ~15–20 lines plus the Test Accounts block). Must include:

- [ ] How to run: `docker compose up --build` (migrations + seed command, in order).
- [ ] How to apply migrations and run the seed if not automatic on boot.
- [ ] Two logins called out in prose **and** the exact heading below.
- [ ] Exact heading: `## TEST ACCOUNTS`
- [ ] Under that heading, a **fenced JSON block** containing:
  - [ ] both logins for each local (email, password, role, local name/id)
  - [ ] `existingAnnouncementId` of the pre-sent announcement in the **larger** local
  - [ ] `otherLocalMemberId` — a member id in the **other** local
  - [ ] `auth`: method + header style (`POST /auth/login`, then `Authorization: Bearer`)
  - [ ] `endpoints`: method + path for the handful built (login, create, ai-draft, approve, send, get announcement, me list, me get, acknowledge)
- [ ] `curl` example: member read + ack flow.
- [ ] `curl` example: Local 27 login **cannot** read the other local’s announcement / member data.
- [ ] How Rule 2 was verified: double-send test (and/or curl retry-send). Explain `SELECT FOR UPDATE SKIP LOCKED` (workers cannot claim the same queued row) — not a live race test.
- [ ] AI: env var for the key; what happens if the provider is down.
- [ ] Pointer to `DESIGN.md` (what was cut lives at the bottom of that file already).
- [ ] Export AI chat sessions to repo root when submitting (brief §5 / §6) — not code, but a submission checklist item.

---

## Suggested build order (same as phase numbers)

1. Scaffold → 2. Schema → 3. Auth/Rule 1 → 4. Endpoints (create/get/approve/member read-ack) → 5. Send + worker → 6. AI draft → 7. Seed → 8. Leadership page → 9. Tests → 10. README.

Stop here until this plan is reviewed. No application code until you say go.
