# Implementation plan for Part B
_Exported on 9/11/2026 at 18:40:44 GMT+5 from Cursor (3.14.7)_

---

**User**

Read Member-Callout-Exercise.pdf (the brief, especially Section 3 "Part B: build a slice" and Section 4 "Starting point") and DESIGN.md (my own Part A design — this is the spec, follow it exactly).

Do NOT write any code yet. Instead, produce a PLAN.md at the repo root: a concrete, ordered implementation checklist for building Part B, broken into phases I can check off as we go. It should cover:

1. Project scaffold — NestJS + TypeORM + PostgreSQL backend, Next.js frontend, docker-compose. List the actual packages/modules you'd add.
2. Entities & migrations — the four tables from DESIGN.md's data model (locals, members, announcements, announcement_recipients), including the unique(announcement_id, member_id) constraint and the denormalized counter fields.
3. Auth & Rule 1 enforcement — the guard/permission strategy for local_id + role scoping, applied globally so new endpoints inherit it automatically.
4. Core endpoints — list each one (method, path, who can call it, what it does), grouped by leadership vs member.
5. Async send + Rule 2 — the queued-recipient-rows + SELECT FOR UPDATE SKIP LOCKED worker approach, as a scheduled task.
6. AI draft feature — the draft/approved/sent state machine and where the AI call sits, isolated from the send path.
7. Seed script — what it creates, matching DESIGN.md's numbers (2 locals, ~2,000 + 200 members, pre-sent announcement in the larger local).
8. Frontend — the single leadership page, what it needs to call and display.
9. Tests / verification — the cross-local access test and the double-send test specifically, since these are explicitly required in the README.
10. README — final checklist of what it must contain, including the exact "## TEST ACCOUNTS" heading.

For each phase, list it as short checkable bullet items (- [ ] ...), not prose. Flag anywhere DESIGN.md is ambiguous or you had to make a judgment call, rather than silently deciding. Stop after producing PLAN.md — wait for me to review it before writing any code.

---

**Cursor**

I'll read the brief and your Part A design first, then write a concrete phased checklist in `PLAN.md`—no code.

The PDF may need a different read path. I'll pull Section 3 and Section 4 from the brief next.

I have the brief and DESIGN.md. Next I’ll write `PLAN.md` as a phased checklist, calling out any spec gaps instead of filling them in silently.

`PLAN.md` is at the repo root. It is a 10-phase checklist (scaffold → schema → Rule 1 → endpoints → async send → AI draft → seed → UI → tests → README). No application code was written.

A few places `DESIGN.md` does not specify a field or path — those are listed at the top of the plan as checkboxes, not buried in the phases. The ones that most affect the build:

- **JWT + `users` table** for `members.user_id` (design names the FK, not the login scheme).
- **`sent_count` / `read_count` / `acknowledged_count`** on `announcements` (required in §2, missing from the table spec).
- **`notification_preview`**, **retry columns**, and **when `status` becomes `sent`** (propose: on Send, same transaction as queued recipient insert).
- **Classification only on Send**, not a new column.
- **RSVP columns in the DB, no RSVP API** (brief: not required in the build).
- **UI shows the caller’s local**, no cross-local picker (Rule 1 vs the brief’s “pick a local”).
- **Two-API + nginx compose** left as an optional extra after the spine works.

Exact REST paths are proposed in Phase 4 (`/announcements/:id/approve|send`, `/me/announcements/...`). README Phase 10 includes the exact `## TEST ACCOUNTS` heading and the JSON block the brief asks for.

Review the judgment-call list first; say what to change, then we can start coding.

---

**User**

Plan approved with these adjustments:

Exclude leadership members from the recipient audience — only role = 'member' gets sent to.
Keep attempt_count/next_attempt_at but use a simple fixed retry delay, not real backoff tuning.
For Phase 9, skip the concurrent-worker-race test; instead write an automated test that calls /send twice and asserts no duplicate recipient rows, and explain the SKIP LOCKED safety in the README rather than testing it live.
Keep failed-authz logging to a single log line, no logging module.
All other judgment calls in the plan are approved as proposed.

Start Phase 1.

---

**Cursor**

Phase 1 is scaffold only: NestJS backend, Next.js frontend, docker-compose, and the modules/packages from the plan. I'll check the repo, then create that structure.

Backend packages are in. Next I’ll add stub modules, compose/env files, and a minimal Next.js page.

Phase 1 is in place. Modules are stubs only — no entities, auth guards, or send worker yet.

**Backend** (`backend/`): NestJS with TypeORM (`synchronize: false`), JWT/Passport, Schedule, Axios. Stub modules: Auth, Members, Locals, Announcements, Notifications, Ai. `GET /health` returns `{ status: "ok" }`. API in Docker is on **port 3001**.

**Frontend** (`frontend/`): Next.js App Router, placeholder leadership page.

**Run:** `docker compose up --build` — Postgres 16, api, web. Env templates: `backend/.env.example`, `.env.example`.

**Checks:** backend `nest build` and unit test passed; frontend production build passed; compose file validates.

Approved plan adjustments are recorded in `PLAN.md` (leadership excluded from audience, fixed retry delay, double-`/send` test only, one-line authz logs).

**Note:** `create-next-app` left a nested `frontend/.git`. Remove that before you init/commit the repo at the root so everything is one repository.

Say when to start Phase 2 (entities and migrations).

---

**User**

Note: create-next-app left a nested frontend/.git. Remove that

---

**Cursor**

Removed `frontend/.git`. That folder is no longer a nested git repo, so a repo at the CrewLink root can track the frontend files normally.

---

**User**

Start Phase 2 — entities and migrations. Follow PLAN.md's Phase 2 checklist exactly: locals, users, members, announcements, announcement_recipients, including the denormalized counters, notification_preview, the retry fields (attempt_count, next_attempt_at), and the UNIQUE(announcement_id, member_id) constraint. Write actual TypeORM migrations (not synchronize: true), run them against the compose Postgres, and confirm the unique constraint exists in the DB afterward. Stop after this phase — don't start Phase 3 auth guards yet.

---

**Cursor**

I'll follow Phase 2 in `PLAN.md` exactly: entities, real TypeORM migrations, then run them on compose Postgres and verify the unique constraint.

Writing entities and a TypeORM migration, then running it against compose Postgres.

Phase 2 is done. Schema is in compose Postgres; no Phase 3 auth work was started.

**Tables:** `locals`, `users`, `members`, `announcements`, `announcement_recipients` — plus TypeORM’s `migrations` table.

**Rule 2 constraint** is in the database as:

`UQ_announcement_recipients_announcement_member` → `UNIQUE (announcement_id, member_id)`

Also present: denormalized counters, `notification_preview`, `attempt_count` / `next_attempt_at`, audience indexes, and cascade delete from announcements to recipients.

**Host port:** compose Postgres is mapped to **5433** because **5432** on this machine is already another Postgres (login as `crewlink` failed there). API containers still talk to `db:5432` on the Docker network. Host migrate:

`DATABASE_URL=postgresql://crewlink:crewlink@localhost:5433/crewlink` then `npm run migration:run` in `backend/`.

Say when to start Phase 3.

---

**User**

<timestamp>Thursday, Sep 10, 2026, 7:11 PM (UTC+5)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: success
task_id: 181032
title: Wait until Docker engine is ready
tool_call_id: call-6e68e8f0-5a6d-4a00-8af5-8655934cf8c7-161
fc_6cf99821-faad-938f-a82a-4965a047eae2_0
output_path: C:\Users\tahaf\.cursor\projects\d-projects-CrewLink\terminals\181032.txt
</task>
</system_notification>

<timestamp>Thursday, Sep 10, 2026, 7:11 PM (UTC+5)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: error
task_id: 181034
title: Run TypeORM migrations against compose Postgres
tool_call_id: call-53eee018-060d-426c-936c-28e50f4e5f73-168
fc_11fc7213-99ba-9800-8653-b950d9aea3ba_0
detail: exit_code=1
output_path: C:\Users\tahaf\.cursor\projects\d-projects-CrewLink\terminals\181034.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed). If there's no follow-ups needed, don't explicitly say that.</user_query>

---

**Cursor**

Docker finished starting. The first migration run failed because **localhost:5432** is a different Postgres (not the compose `crewlink` user). After remapping compose to **5433**, the schema migration completed and the unique constraint is in place.

---

**User**

Remove all root .env references.
Use only:
frontend/.env for frontend
backend/.env for backend

Do not create or restore a root .env. Make no other changes.

---

**Cursor**

I'll delete the root `.env.example` only — env stays in `backend/` and `frontend/`.

Removed the repo-root `.env.example`. Env files are only `backend/.env` / `backend/.env.example` and `frontend/.env.example` (plus `frontend/.env` when you add one). No root `.env` was created.

---

**User**

Start Phase 3 — auth and Rule 1 enforcement, per PLAN.md exactly. Build:

POST /auth/login (public) issuing a JWT with sub, memberId, localId, role
Global JwtAuthGuard via APP_GUARD, with only /auth/login and /health marked @Public()
The guard must re-load the member row from the DB on each request (not trust the JWT payload for localId/role), so a stale token can't retain a changed role or local
A shared tenant-scoping mechanism (repository helper or query builder base) that every resource query goes through by default — this is what makes a future endpoint inherit the local_id filter automatically instead of needing to remember it
@Roles('leadership') decorator + RolesGuard for leadership-only actions
Cross-local resource access returns 404 (not 403), per the approved plan; role failures on your own local's resource return 403
One-line logging on any authz failure (member id, requested resource, path) — no logging module, just a log call

Stop after this phase. Don't build the announcement endpoints yet (Phase 4).

---

**Cursor**

I'll implement login, global JWT + Roles guards, DB-backed request user, and a default tenant query helper — no announcement endpoints.

Phase 3 is in place. There are still no announcement HTTP routes.

**Login:** `POST /auth/login` (public) takes `{ email, password }` and returns `{ accessToken, member: { id, localId, role, fullName } }`. Extra `local_id` / `role` on the body are stripped and never used for auth. JWT includes `sub`, `memberId`, `localId`, and `role`.

**Guards:** `JwtAuthGuard` and `RolesGuard` are registered as `APP_GUARD`. Only `/auth/login` and `/health` are `@Public()`. On each authenticated request the JWT strategy **reloads the member row** by `sub` (user id) and sets `request.user` from that row, not from the token’s `localId`/`role`.

**Leadership:** `@Roles('leadership')` — missing role on a resource in your local is **403** and one `Authz` log line.

**Tenant scope:** inject `TenantScope` and use `forEntity()` (default). It always filters `local_id` (or `locals.id`, or recipients via `announcements.local_id`). `getByIdOrNotFound()` returns **404** for another local’s id and logs one line (`reason=cross-local`). `unsafeUnscopedQuery()` is the explicit opt-out and is not used on HTTP handlers.

Phase 4 can hang leadership actions on `@Roles('leadership')` and all resource reads/writes on `TenantScope`.

---

**User**

<timestamp>Thursday, Sep 10, 2026, 8:09 PM (UTC+5)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: success
task_id: 181036
title: Run backend unit tests
tool_call_id: call-65b7c1cf-5470-42f1-a60d-740529b23117-235
fc_c89a1430-5d35-9c6d-b201-e4e40992ad0d_0
output_path: C:\Users\tahaf\.cursor\projects\d-projects-CrewLink\terminals\181036.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed). If there's no follow-ups needed, don't explicitly say that.</user_query>

---

**Cursor**

Backend unit tests passed (1 suite, 1 test). Phase 3 is unchanged from the previous summary.

---

**User**

Before Phase 4, add two small things:

Swagger/OpenAPI via @nestjs/swagger, mounted at /api/docs, with the Authorization: Bearer scheme configured so I can paste a token and call protected routes from the UI. Document /auth/login and /health now; new routes get documented as they're built in each phase.
A minimal dev seed script (npm run seed:dev, separate from the full Phase 7 seed) that creates exactly: 2 locals, 1 leadership + 1 member user per local (4 total), known emails/passwords. This is only to unblock manual Rule 1 testing — the full Phase 7 seed (2,000+200 members, pre-sent announcement) still happens later as planned.

After this, log in as each of the 4 seeded users via Swagger, and manually confirm: a Local A token against a Local B resource id returns 404, and a member-role token against a leadership-only route returns 403. Report the actual requests/responses, not just "it works."

---

**Cursor**

I'll add Swagger at `/api/docs`, a `seed:dev` script with four known logins, then exercise Rule 1 through the UI and report the real request/response pairs.

Swagger is at **http://localhost:3000/api/docs** (`Authorization: Bearer` under the Authorize button). `GET /api/docs` returned **200** with swagger-ui; the spec lists `/auth/login`, `/health`, `/locals/{id}`, `/leadership/check` and a `bearer` http scheme.

`npm run seed:dev` created Local 27 `0d653338-b845-4a64-8045-8db3564206c2` and Local 99 `e0f4e9ff-e3a4-4e62-b3be-0755f40319cb`. Password for all four: `password123`.

There is no announcement API yet, so Rule 1 was exercised on two documented probe routes: `GET /locals/:id` (tenant-scoped) and `GET /leadership/check` (`@Roles('leadership')`). I called those OpenAPI operations on the running API (same requests Swagger “Try it out” sends). There is no browser tool here to click Authorize in the UI.

**leadership.27** — `POST /auth/login` **200** `{ member: { id: 315c0df1-…, localId: 0d653338-…, role: "leadership", fullName: "Denise Okafor" } }`  
- `GET /locals/0d653338-…` **200** `{ id, name: "Local 27" }`  
- `GET /locals/e0f4e9ff-…` **404** `{ "message": "Not Found", "statusCode": 404 }`  
- `GET /leadership/check` **200** `{ ok: true, role: "leadership", … }`

**member.27** — login **200** `{ role: "member", fullName: "Alex Rivera" }`  
- own local **200** Local 27  
- other local **404** `{ "message": "Not Found", "statusCode": 404 }`  
- `GET /leadership/check` **403** `{ "message": "Forbidden", "statusCode": 403 }`

**leadership.99** — login **200** `{ role: "leadership", fullName: "Sam Okonkwo" }`  
- own local **200** Local 99  
- `GET /locals/0d653338-…` **404** `{ "message": "Not Found", "statusCode": 404 }`  
- leadership check **200**

**member.99** — login **200** `{ role: "member", fullName: "Jordan Chen" }`  
- own local **200** Local 99  
- other local **404** `{ "message": "Not Found", "statusCode": 404 }`  
- `GET /leadership/check` **403** `{ "message": "Forbidden", "statusCode": 403 }`

Every Local A token against the Local B id was **404**, not 403. Every member token against the leadership route was **403**.

---

**User**

<timestamp>Thursday, Sep 10, 2026, 8:22 PM (UTC+5)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: error
task_id: 181037
title: Install NestJS Swagger package
tool_call_id: call-0174f5e1-c28f-487c-960e-19edd135c026-250
fc_73696b06-24bd-93d7-a28d-a9e34f055df0_0
detail: exit_code=1
output_path: C:\Users\tahaf\.cursor\projects\d-projects-CrewLink\terminals\181037.txt
</task>
</system_notification>

<timestamp>Thursday, Sep 10, 2026, 8:22 PM (UTC+5)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: success
task_id: 181038
title: Install Swagger compatible with Nest 11
tool_call_id: call-4af546ab-4d92-4b30-9a84-aa5cf4054670-253
fc_09a03346-a98a-9a40-93c5-e929013506f8_0
output_path: C:\Users\tahaf\.cursor\projects\d-projects-CrewLink\terminals\181038.txt
</task>
</system_notification>

<timestamp>Thursday, Sep 10, 2026, 8:22 PM (UTC+5)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: success
task_id: 181039
title: Build backend and run dev seed
tool_call_id: call-662c1fac-e379-4a5f-87c0-c02ceaa532b2-275
fc_f9487fbc-3408-9a6d-b0df-8c62eb7a2b43_0
output_path: C:\Users\tahaf\.cursor\projects\d-projects-CrewLink\terminals\181039.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed). If there's no follow-ups needed, don't explicitly say that.</user_query>

---

**Cursor**

The first Swagger install failed because v12 wants Nest 12. **@nestjs/swagger@11** installed cleanly. **`npm run seed:dev`** finished and wrote the four Local 27 / Local 99 logins. That is the setup that was already used for the Rule 1 checks.

---

**User**

Start Phase 4 — core announcement and member endpoints, per PLAN.md exactly. Build the leadership routes (POST /announcements, GET /announcements, GET /announcements/:id, PATCH /announcements/:id, POST /announcements/:id/approve) and the member routes (GET /me/announcements, GET /me/announcements/:id setting read_at once, POST /me/announcements/:id/acknowledge setting acknowledged_at once) — all through TenantScope and @Roles('leadership') where applicable, per the Phase 3 pattern already in place. Do not build /announcements/:id/send yet — that's Phase 5 with the async worker. Document each new route in Swagger as you go. Stop after this phase.

---

**Cursor**

I'll add the leadership and member announcement routes through `TenantScope` and existing guards, document them in Swagger, and leave send for Phase 5.

Phase 4 is in place. **Send is not implemented** (`POST /announcements/:id/send` is still Phase 5).

**Leadership** (`@Roles('leadership')`, `TenantScope`, Swagger tag `announcements`):

- `POST /announcements` — draft in the caller’s local (`title`, `body`, optional `notificationPreview`, `needsAck`). Classification is not stored; it goes on send later.
- `GET /announcements` — list (id, title, status, counters, sentAt)
- `GET /announcements/:id` — full row + counters; other local → **404**
- `PATCH /announcements/:id` — title/body/preview/needsAck only while `draft` (otherwise **409**)
- `POST /announcements/:id/approve` — `draft → approved` (otherwise **409**)

**Member** (JWT only, no leadership role; Swagger tag `me`):

- `GET /me/announcements` — this member’s recipient rows in their local
- `GET /me/announcements/:id` — first open sets `read_at` and increments `read_count` once
- `POST /me/announcements/:id/acknowledge` — sets `acknowledged_at` and increments `acknowledged_count` once (allowed even if `needsAck` is false)

Until Phase 5 creates recipient rows, the member inbox will be empty. Restart the API to pick up the new routes in Swagger.

---

**User**

<timestamp>Thursday, Sep 10, 2026, 8:30 PM (UTC+5)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: error
task_id: 181041
title: Compile backend after Phase 4 endpoints
tool_call_id: call-05f13b36-c094-4cbf-855d-13f7aca16f1a-303
fc_41c3bcb2-d572-9892-8117-06596f794d07_1
detail: exit_code=1
output_path: C:\Users\tahaf\.cursor\projects\d-projects-CrewLink\terminals\181041.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed). If there's no follow-ups needed, don't explicitly say that.</user_query>

---

**Cursor**

The first Phase 4 compile failed on a bad import in `announcement.views.ts`. That path was corrected and the next build succeeded; the endpoints from the last update are what’s in place.

---

**User**

<timestamp>Thursday, Sep 10, 2026, 8:47 PM (UTC+5)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: aborted
task_id: 181040
title: Start Nest API on port 3000
tool_call_id: call-9fcfd5fa-6240-445d-9194-ef89b0b82cff-279
fc_500a9c5a-e851-9f74-be25-db6c5883197b_0
output_path: C:\Users\tahaf\.cursor\projects\d-projects-CrewLink\terminals\181040.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed). If there's no follow-ups needed, don't explicitly say that.</user_query>

---

**Cursor**

The Nest API that was running on port 3000 was stopped. Start it again with `npm run start` in `backend/` when you want Swagger or the new announcement routes.

---

**User**

Start Phase 5 — async send and Rule 2, per PLAN.md exactly.

Synchronous part of POST /announcements/:id/send:

Leadership only, TenantScope, reject unless status === 'approved' (409 otherwise, consistent with Phase 4's convention)
In one transaction: lock the announcement row (SELECT ... FOR UPDATE), re-check status (if already sent, return success as a no-op — don't re-insert), resolve audience as active members with role = 'member' in the caller's local (excluding leadership, per the approved plan adjustment), optionally filtered by classification from the request body, bulk-insert announcement_recipients with status = 'queued', set announcement status = 'sent' and sent_at = now()
Catch unique-constraint violations on the bulk insert as a signal that rows already exist — treat as already-queued, not an error
Return 202 with the announcement id and current counters

Async worker in NotificationsModule:

@Cron scheduled task, ticks every few seconds (env-configurable)
Each tick, in one transaction: SELECT ... FROM announcement_recipients WHERE status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= now()) LIMIT :batch FOR UPDATE SKIP LOCKED, process the batch
Mock delivery adapter: log member id + announcement id, no real push
On success: status = 'sent', sent_at = now(), increment announcements.sent_count in the same transaction
On failure: increment attempt_count, set next_attempt_at using the fixed retry delay (not real backoff, per the approved adjustment), mark status = 'failed' after 3 attempts

Then write the automated test from the approved plan: call /send twice on the same announcement and assert exactly one recipient row per member, no duplicate sent_count jump. This replaces the concurrent-worker-race test we agreed to skip.

Stop after this phase. Don't touch the AI draft feature (Phase 6) yet.

---

**Cursor**

I'll implement send (lock + queued recipients + 202), the SKIP LOCKED worker with mock delivery, and the double-send test—no AI draft work.

Phase 5 is in place. No AI draft work.

**`POST /announcements/:id/send`** (leadership, Swagger): **202**. Locks the row `FOR UPDATE`. Draft → **409**. Already `sent` → 202 no-op. Otherwise queues **active `role = member`** in the caller’s local (optional `classification` in the body), sets `status = sent` / `sent_at = now()`, and treats unique-constraint errors as already-queued.

**Worker** (`@Cron`, default every 2s): `SELECT … FOR UPDATE SKIP LOCKED` on `queued` rows. Mock adapter logs `memberId` + `announcementId`. Success updates the row and increments `sent_count` in the same transaction. Failures use a fixed delay; **failed after 3 attempts**. Set `WORKER_ENABLED=false` to pause it.

**Rule 2 test** (`node test/send-idempotency.cjs`, also at the end of `npm run test:e2e`): send twice on the same announcement. It passed: two member rows, no duplicates, `sent_count` stayed `0` (worker off in the test), leadership not in the audience. Jest could not load Nest 11’s ESM packages, so this is a Node assert script instead of a `.e2e-spec.ts`.

---

**User**

<timestamp>Thursday, Sep 10, 2026, 9:59 PM (UTC+5)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: error
task_id: 181043
title: Compile backend with send worker
tool_call_id: call-56461158-2be9-4f3c-9a55-8ba0513a738d-366
fc_febbbaa8-6ed0-9bac-a32a-5bd57eb37eac_2
output_path: C:\Users\tahaf\.cursor\projects\d-projects-CrewLink\terminals\181043.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed). If there's no follow-ups needed, don't explicitly say that.</user_query>

---

**Cursor**

The first Phase 5 compile was cut off with no error output. A later `nest build` succeeded, and the double-send check passed.

---

**User**

Start Phase 6 — AI draft feature, per PLAN.md exactly.

POST /announcements/ai-draft (leadership, TenantScope): takes { note: string }, calls the configured AI provider (OpenAI-compatible HTTP API via OPENAI_API_KEY/OPENAI_MODEL env vars) with a prompt that turns an informal note into { title, body, notificationPreview } (preview ≤120 chars). Persist the result immediately as a new announcements row with status = 'draft' in the caller's local — same as a manually-created draft, so it goes through the existing PATCH → approve → send flow unchanged.

Timeout handling: use AI_TIMEOUT_MS from env. On timeout or provider error, return a clear error response (503/504) — do not create a partial or broken announcement row, and do not touch status, recipients, or the worker in any way. The AI call must be fully isolated from the send path; a slow or down provider should never be able to block or corrupt sending.

Document the new route in Swagger. Stop after this phase — Phase 7 (full seed data) is next.

---

**Cursor**

I'll add `POST /announcements/ai-draft` as an isolated OpenAI-compatible call that only persists a draft after a successful response.

Phase 6 is in place. No Phase 7 seed work.

**`POST /announcements/ai-draft`** (leadership, Swagger): `{ note }` → OpenAI-compatible `POST /chat/completions` using `OPENAI_API_KEY`, `OPENAI_MODEL`, and `AI_TIMEOUT_MS`. On success it saves a normal **draft** in the caller’s local (title, body, preview ≤ 120 chars) and returns that row. Approve → send is unchanged.

**Failures:** missing key / provider / bad JSON → **503**; timeout → **504**. The announcement is written only after a valid draft, so a down or slow provider never creates a row, never touches recipients, and is not on the send/worker path. Manual `POST /announcements` still works without AI.

---

**User**

Start Phase 7 — seed data, per PLAN.md exactly. Write a re-runnable seed script (npm run seed, separate from the existing seed:dev):

2 locals: one with ~2,000 members, one with 200, across 3–4 classifications, mixed active/retired/suspended status so an unfiltered query is visibly wrong if it includes non-active members
1 leadership + 1 member login per local (reuse the same accounts/passwords as seed:dev if that's simpler, or document if they differ)
One already-sent announcement in the larger local: status = 'sent', sent_at set, recipient rows created for the active member audience, with some read_at/acknowledged_at populated so the counters aren't all zero
Idempotent: running it twice must not duplicate locals, members, or the seeded announcement

---

**Cursor**

I'll add `npm run seed` as a re-runnable full roster (Local 27 ~2,000 / Local 99 200), reusing the `seed:dev` logins and a pre-sent announcement that won't duplicate on a second run.

Phase 7 is in place: `npm run seed` in `backend/`. Logins match `seed:dev` (`password123`).

**Roster:** Local 27 **2,000** members, Local 99 **200**. Four classifications; ~10% retired/suspended so an unfiltered audience would be larger than the real send set.

**Pre-sent announcement** in Local 27: `b626bc32-066e-4659-b536-e2056305f946` — `sent`, **1,800** recipient rows (active members only, leadership excluded), **200** read, **80** acknowledged.

**Idempotent:** a second run kept the same local IDs, member counts, and announcement id.

`otherLocalMemberId` (Local 99 member): `7ce64430-962f-4cd2-8a68-5ff6824204b5`. These IDs belong in the Phase 10 `## TEST ACCOUNTS` JSON.

---

**User**

Start Phase 8 — frontend leadership page, per PLAN.md exactly. Build:

A login form (email/password) that stores the JWT for subsequent API calls
A single page: title/body fields, optional "messy note" input with a "Draft with AI" button calling /announcements/ai-draft, an "Approve" button, a "Send" button, an optional classification select, a needsAck checkbox
Send is disabled until the announcement is approved; after AI drafting or manual creation, the draft is editable and must go through Approve before Send is enabled
Display the caller's own local (read-only, no picker of other locals) — add one line of UI copy explaining this is intentional (never trust client-supplied local), so it doesn't read as a missing feature
After sending (or when loading the seeded announcement by id), poll GET /announcements/:id every 3–5 seconds and display sent/read/acknowledged counts
Add a small input to load an existing announcement by id, so the seeded announcement (b626bc32-066e-4659-b536-e2056305f946) can be viewed without sending again
Show a clear error state if the AI call fails (503/504), without blocking manual Send

Unstyled is fine. No member-facing UI needed. Stop after this phase — Phase 9 (tests) is next.

---

**Cursor**

Phase 8 is in place: a single unstyled leadership page, no member UI. Phase 9 is untouched.

**What you get**
- Login (email/password) stores the JWT in `localStorage` and uses it on later API calls.
- After login: title/body, optional messy note + **Draft with AI**, **Approve**, **Send**, classification select, **needs ack**.
- **Send** stays disabled until status is `approved`. AI or a manual create stays a draft you can edit; Approve is required before Send.
- Local is read-only (name + id) with copy that this is intentional: the API never trusts a client-supplied `local_id`.
- Load-by-id (pre-filled with `b626bc32-066e-4659-b536-e2056305f946`).
- While status is `sent`, the page polls `GET /announcements/:id` every 4s and shows sent/read/acknowledged.
- AI 503/504 shows an error and does not block typing, Approve, or Send.

**Files:** `frontend/app/page.tsx`, `frontend/lib/api.ts`. `PLAN.md` Phase 8 boxes are checked.

**How to run it:** `frontend/.env` is `NEXT_PUBLIC_API_URL=http://localhost:3001` (Compose). Your API is currently on **3000**. Point that env at `http://localhost:3000` for local Nest, and run Next on another port (`npx next dev -p 3002`) because 3000 is taken. Compose already sets `NEXT_PUBLIC_API_URL` to `http://localhost:3001`.

Login that matches the seed: `leadership.27@crewlink.local` / `password123`. I confirmed that account can load the seeded announcement (sent 1800 / read 200 / ack 80). I could not click through the UI here (no browser tools). Next production build succeeded.

---

**User**

Console Error

A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:

- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

See more info here: https://nextjs.org/docs/messages/react-hydration-error


  ...
    <HotReload assetPrefix="" globalError={[...]}>
      <AppDevOverlayErrorBoundary globalError={[...]}>
        <ReplaySsrOnlyErrors>
        <DevRootHTTPAccessFallbackBoundary>
          <HTTPAccessFallbackBoundary notFound={<NotAllowedRootHTTPFallbackError>}>
            <HTTPAccessFallbackErrorBoundary pathname="/" notFound={<NotAllowedRootHTTPFallbackError>} ...>
              <RedirectBoundary>
                <RedirectErrorBoundary router={{...}}>
                  <Head>
                  <__next_root_layout_boundary__>
                    <SegmentViewNode type="layout" pagePath="layout.tsx">
                      <SegmentTrieNode>
                      <link>
                      <RootLayout>
                        <html lang="en">
                          <body
-                           cz-shortcut-listen="true"
                          >
                  ...
app\layout.tsx (16:7) @ RootLayout


  14 |   return (
  15 |     <html lang="en">
> 16 |       <body>{children}</body>
     |       ^
  17 |     </html>
  18 |   );
  19 | }
Call Stack
18

Show 16 ignore-listed frame(s)
body
<anonymous>
RootLayout
app\layout.tsx (16:7)

---

**Cursor**

This one isn't your code — it's a browser extension. The mismatched attribute is `cz-shortcut-listen="true"`, which ColorZilla injects onto `<body>` after the server HTML arrives but before React hydrates. Nothing in `layout.tsx` or the leadership page renders it.

The standard fix is to tell React not to warn about attribute drift on that one element:

`suppressHydrationWarning` is shallow: it only silences attribute and text mismatches on `<body>` itself, so any genuine hydration bug inside the leadership page will still be reported.

If you'd rather not add the attribute at all, the alternative is to reproduce in an incognito window with extensions disabled and confirm the warning disappears — it's dev-only noise and doesn't affect the production build or the app's behavior either way.

---

**User**

as i am using nest on backend, so can i use react on frontend instead of next ?

---

**Cursor**

Yes. NestJS and Next.js are independent. Nest is just HTTP/JSON; any frontend that can `fetch` with a Bearer token works — Create React App, Vite + React, Remix, even a static HTML page.

This repo uses Next.js because `DESIGN.md` / `PLAN.md` specified it, not because Nest requires it. The API already has CORS enabled, so a Vite React app on another origin (for example `localhost:5173` talking to `localhost:3000` or `3001`) is fine.

What you’d keep vs change:

- **Keep:** all of `backend/`, the same endpoints (`POST /auth/login`, announcements, AI draft, send, poll `GET /announcements/:id`).
- **Replace:** `frontend/` (App Router, `app/page.tsx`, `NEXT_PUBLIC_API_URL`) with a Vite React SPA. Store the JWT the same way (`localStorage` is still fine for this exercise). Use `import.meta.env.VITE_API_URL` instead of `NEXT_PUBLIC_API_URL`.
- **Compose:** the `web` service would build/serve the Vite app instead of Next. Docker and README would need to match.

Tradeoffs for *this* exercise:

- Next’s SSR isn’t buying you much here — the leadership page is a client form with `localStorage` and polling. A Vite SPA is simpler and avoids hydration nits (including the extension warning on `<body>`).
- If the brief or reviewer expects Next.js because it’s in the design, switching might look like you ignored the stack. If you’re free to choose, React + Vite is a reasonable fit.

So: technically yes; for the Avialdo slice, only switch if you’re allowed to diverge from the written Next.js choice. I’m in Ask mode, so I can’t migrate the frontend — switch to Agent mode if you want that done.

---

**User**

make UI better

---

**Cursor**

I'll style the leadership page. Let me look at the current markup and stylesheet first.

Now I'll write a real stylesheet and restructure the markup around it. Behavior stays identical — same endpoints, same Approve-before-Send gate, same polling.

---

**User**

use tailwind css

---

**Cursor**

Switching to Tailwind. Let me check what's already configured.

No Tailwind yet. Installing it (v4, the PostCSS plugin route Next 15 uses).

Tailwind v4.3.3 installed. Now the PostCSS config, stylesheet, and markup.

Build is clean. Let me make sure the Docker build still works, since Tailwind landed in `devDependencies`.

No Docker change needed — it runs `npm ci` (dev deps included) before `npm run build`. Let me spin up the dev server and confirm the page actually renders with generated Tailwind CSS.

Tailwind is wired up and the page is rebuilt around it. Behavior is unchanged — same endpoints, same Approve-before-Send gate, same 4-second polling.

**Setup**
- Installed `tailwindcss` + `@tailwindcss/postcss` (v4.3.3) and added `frontend/postcss.config.mjs`.
- `app/globals.css` is now just `@import "tailwindcss";` — the hand-written CSS I'd started is gone.
- `app/layout.tsx` moved the page background onto `<body>` (`bg-slate-50 text-slate-900 antialiased`), keeping `suppressHydrationWarning` for the extension attribute.

**What the page looks like now**
- Centered login card instead of stacked `<p>` inputs.
- A top bar with the CrewLink mark, your name/role, and Log out.
- Two-column layout on wide screens: compose on the left (AI draft card, then the announcement card), context on the right.
- Right column: a **Workflow** card with a Draft → Approve → Send stepper that ticks off as the status moves, a **Delivery** card with sent/read/acked stat tiles plus a pulsing "live" dot while polling, **Open by id** pre-filled with the seeded id, and a **Local** card holding the read-only local and the note about why there's no picker.
- Status badge on the announcement card, colored per state (draft amber, approved blue, sent emerald).
- Buttons now show progress text (`Drafting…`, `Approving…`, `Sending…`) and only the triggered action is labeled, since I replaced the boolean `busy` with a `pending` action state.
- Added a live `preview.length`/120 counter, a line explaining approved drafts are locked, and a hint next to Send saying it unlocks after approval.

**Verified:** `npm run build` passes with no lint warnings, and against a dev server the generated stylesheet is ~21KB with Tailwind preflight and the oklch palette present. The initial server HTML is the "Loading…" shell — that's deliberate, since the session is read from `localStorage` on the client and rendering the real UI on the server would reintroduce a hydration mismatch.

Two things to know: the dev server is still running on http://localhost:3002 (3000 is your API), and `frontend/.env` still points `NEXT_PUBLIC_API_URL` at `http://localhost:3001`, so login will fail there until you point it at `http://localhost:3000` for the local API. Docker is unaffected — its Dockerfile runs `npm ci` before the build, so the new dev dependencies are present.

---

**User**

complete phase 9 and phase 10

---

**Cursor**

I'll follow PLAN.md for Phase 9 (tests) then Phase 10 (README). First I'm reading the plan, existing tests, and seed/auth details.

I'll add Phase 9 as Nest e2e scripts (same CJS pattern as the double-send test), then write the README with live seed IDs.

Phase 9 and Phase 10 are done. `cd backend && npm run test:e2e` passed (health, double-send, and the new Phase 9 script).

**Phase 9** (`backend/test/phase9.cjs`, wired into `npm run test:e2e`; Jest still cannot load Nest 11 as ESM, so this follows the existing CJS/`dist` pattern):

- Local A leadership/member **GET** a Local B announcement → **404**, body has no Local B member names/emails/ids
- Local 99 member id used as a Local 27 announcement id → **404**, no PII
- Member JWT on **send / approve / ai-draft** → **403**
- Send audience is **active members only** (retired, suspended, and leadership omitted)
- Member **GET** increments `readCount` once; **acknowledge** increments `acknowledgedCount` once
- All four seed logins work; Local 27 can load the seeded announcement, Local 99 cannot

**Phase 10** — root `README.md`: compose up, then `migration:run` + `seed` (not automatic on boot), Local 27 leadership/member called out in prose, `## TEST ACCOUNTS` JSON, member read/ack curls, Rule 1 404 curl, Rule 2 + `FOR UPDATE SKIP LOCKED` (no worker race test), AI 503/504, pointer to `DESIGN.md`, reminder to export chat sessions.

The UUID block matches the last seed from this project (`existingAnnouncementId` `b626bc32-…`, `otherLocalMemberId` `7ce64430-…`). If you re-seed on a fresh database, copy the JSON `npm run seed` prints over that block.

