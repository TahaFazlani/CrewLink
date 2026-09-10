# Design — CrewLink Announcements and Callouts

## Part 0 — Requirements

### 1. What we're building

We will build a secure, multi-tenant announcement and callout system for CrewLink. Union leadership can create an announcement, optionally target members by work classification, and send it to eligible members within their own local. Each recipient has independently tracked sent, read, and acknowledgement state, and members can retrieve and acknowledge announcements through an API.

The system also supports AI-assisted drafting: leadership can turn an informal note into a title, body, and short notification preview, but AI-generated content must be explicitly reviewed and approved before it can be sent.

### 2. Assumptions

- **Audience:** Announcements go to all active members of the selected local by default, optionally narrowed by work classification. Retired and suspended members are excluded.
- **Immediately:** "Send" returns quickly after the announcement and recipient work have been durably recorded. Sending to the full audience happens asynchronously.
- **Acknowledgement:** Acknowledgement is optional per announcement and is separate from simply reading it.
- **Attendance:** An attendance response (`coming` / `not_coming`) is optional per announcement, distinct from acknowledgement, which just means "seen/confirmed."
- **Delivery:** A recipient is considered `sent` once the send operation has been durably recorded. Actual mobile push delivery is outside this build.
- **Offline members:** Being offline does not cause a member to permanently miss an announcement; it remains available through the API.
- **Done:** Leadership can send to a correctly scoped audience, see recipient status/counts, members can retrieve and acknowledge their announcements, duplicate sends are prevented, and cross-local and role boundaries are enforced.

### 3. Concerns

The reported exposure of apprentice contact information from one local to members outside that local is a significant security concern. It suggests the existing platform may already have a tenant-isolation/access-control gap, so cross-local access should be tested before assuming the boundary is working correctly — not just designed against going forward.

A second concern is duplicate delivery: retries, concurrent workers, or backend crashes could cause the same announcement to be sent twice unless idempotency is enforced using durable shared state rather than an in-memory check.

### 4. Questions for Denise

1. **Should attendance responses be separate from acknowledgement?**
   *Assumption: Yes. Acknowledgement means the member has seen the announcement; an optional RSVP separately records coming/not_coming.*
2. **What exactly does "delivered" mean?**
   *Assumption: The system only guarantees application-level `sent` state. Actual device delivery confirmation is outside scope.*
3. **How long should an announcement remain available?**
   *Assumption: It remains available to its intended recipients until leadership archives/removes it.*

---

## Part A — Design

The choice of NestJS is intentional because the application benefits from clear module boundaries, dependency injection, guards, and a structured approach to authorization. PostgreSQL is required for durable state and database-enforced uniqueness for the `(announcement_id, member_id)` idempotency invariant.

Actual mobile push infrastructure is outside the scope of this exercise. The notification worker can initially use a mock/logging delivery adapter so the sending lifecycle and retry behavior can be demonstrated without integrating a real push provider.


### 1. Data model

**`locals`**
| field | type | notes |
|---|---|---|
| id | uuid | |
| name | text | e.g. "Local 27" |

**`members`**
| field | type | notes |
|---|---|---|
| id | uuid | |
| local_id | uuid → locals | tenant boundary |
| full_name | text | |
| email | text | |
| classification | text | e.g. "Apprentice 3rd Year" |
| status | text | active \| retired \| suspended |
| role | text | `member` \| `leadership` — drives Rule 1's role check |
| user_id | uuid → auth user | separates login identity from roster identity |

**`announcements`**
| field | type | notes |
|---|---|---|
| id | uuid | |
| local_id | uuid → locals | tenant boundary |
| title | text | |
| body | text | |
| needs_ack | boolean | |
| requires_attendance | boolean | optional RSVP flag |
| status | text | `draft` \| `approved` \| `sent` |
| created_by | uuid → members | must be leadership |
| sent_at | timestamptz | null until sending begins |
| created_at | timestamptz | |

**`announcement_recipients`** *(new — this is where per-member status lives)*
| field | type | notes |
|---|---|---|
| id | uuid | |
| announcement_id | uuid → announcements | |
| member_id | uuid → members | |
| status | text | `queued` \| `sent` \| `failed` |
| read_at | timestamptz | null until opened |
| acknowledged_at | timestamptz | null until acknowledged |
| attendance_response | text | null \| `coming` \| `not_coming` |
| sent_at | timestamptz | |

A **unique constraint on `(announcement_id, member_id)`** is the core invariant: exactly one recipient row can exist per member per announcement, no matter how many times sending is attempted. `read_at` and `acknowledged_at` are separate nullable timestamps rather than a single status field, since a member can read without acknowledging, and we want independent, queryable facts rather than a single overwritable state.

### 2. The send path

Sending is asynchronous. When leadership presses Send at 14:02:

**Inside the first request (synchronous, fast):**
1. Validate the requester is leadership for the target local.
2. Persist the announcement (`status = approved`, not yet `sent`).
3. Resolve the audience (active members of the local, optionally filtered by classification) and bulk-insert one `announcement_recipients` row per member, `status = queued`, inside a single transaction.
4. Return to leadership immediately — this does not wait for any individual member to be notified.

Leadership receives a response without waiting for individual recipients to be processed. Audience creation is performed as a bulk database operation.

**Outside the request (asynchronous):**
5. Background workers pick up `queued` recipient rows in batches and attempt delivery for each. On success, the row moves to `sent` with a `sent_at` timestamp; on failure, it's retried with backoff and eventually marked `failed` for manual/automatic retry.
6. As members open and acknowledge the announcement, their own `read_at` / `acknowledged_at` fields are updated via the member-facing API — independent of the send workers.

**Live status screen (four leadership users watching counts update):**
The status screen does **not** run `COUNT(*) ... GROUP BY status` against `announcement_recipients` on every poll — at 22,400 rows that query run every second by four open tabs would be real load for no benefit, since the underlying counts change in bursts (worker batches), not continuously.

Instead:
- Recipient-status changes (send success, read, acknowledge) increment a small set of counters on the `announcements` row itself (`sent_count`, `read_count`, `acknowledged_count`) inside the same transaction as the status change — cheap, atomic, and always consistent with the detailed rows.
- The frontend polls the single `announcements` row (not the recipient table) on a modest interval (e.g. every 3–5 seconds), or the counters are pushed over a websocket/SSE channel to open status screens.
- Either way, the expensive table is never queried live by the UI; only the source-of-truth recipient rows update, and the cheap denormalized counters are what gets read repeatedly.

### 3. The two rules, by design

#### Rule 1 — tenant and role isolation

Enforcement happens **server-side, on every request**, never by filtering in the frontend. Every authenticated user resolves to exactly one `member` row, which carries both `local_id` and `role`. Authorization checks both before any data is returned or modified:

```
user.local_id == resource.local_id   # tenant boundary
user.role == "leadership"            # role boundary, for leadership-only actions
```

Client-supplied `local_id` values are never trusted to establish authorization — they're read from the authenticated user's own record, not from request parameters.

**Making this durable, not just disciplined:** rather than relying on every new endpoint remembering to add these two checks, they live in a shared base (a permission class / query manager / base viewset that every resource endpoint inherits from) so that a new endpoint has to opt out of the check to be wrong, not opt in to be right. Concretely: a shared `get_queryset()` base automatically scopes every query to `request.user.local_id`, and a shared permission class gates leadership-only actions — a new endpoint added next year inherits both by default unless someone deliberately bypasses the base class, which is a visible, reviewable choice rather than a silent omission.

I rejected frontend-only filtering (bypassable by calling the API directly) and rejected trusting a resource ID alone (`/announcements/123` implies no tenant ownership by itself).

**Detecting a break in production:** log every authorization check that *fails* (a Local A user's request touching a Local B resource) with enough context to see whether it's a bug or an attack, and alert on any nonzero rate — a legitimate client should never produce these. Periodically run a reconciliation query across a sample of resources confirming `local_id` consistency between a resource and its parent, to catch a bug that silently returns cross-tenant data without ever hitting the denial path.

#### Rule 2 — no double delivery

The invariant is the unique constraint `(announcement_id, member_id)` on `announcement_recipients`, enforced by the database, not by application logic. Recipient rows are created once, up front, in the same transaction as the announcement (Section 2, step 3) — so "has this member already been sent to" is answered by reading persisted state, never by an in-memory set.

A retry or crash is therefore safe by construction:

```
announcement + member
        |
        v
existing recipient row?  (unique constraint guarantees at most one)
        |
   yes, status = sent
        |
        v
       no-op — worker skips it
```

Concurrent workers use atomic transactions (`SELECT ... FOR UPDATE` or an atomic status transition) when claiming a `queued` row, so two workers can never both treat the same recipient as unsent and both deliver to them.

I rejected an in-memory "already sent" cache because it doesn't survive a process restart and can't coordinate across multiple backend instances — exactly the failure mode the brief's devops bonus is designed to expose. I also rejected relying on the client to avoid retries, since networks and load balancers legitimately repeat requests regardless of client behavior.

One honest limitation: if an external push provider is itself non-idempotent, there's a narrow window between calling it and durably recording the result where a crash could produce a provider-level duplicate our own database wouldn't show. Real push infrastructure is outside this exercise, so that gap is documented rather than papered over.

**Detecting a break in production:** the unique constraint makes a true duplicate row impossible, so the meaningful check is whether the same member was sent to twice *at the provider level* despite one row — this is only detectable if the provider returns a delivery ID we log per send attempt; duplicate provider-side delivery IDs for a single recipient row would be the signal, worth building once real push is added.

### 4. Diagram

```
                         ┌──────────────────────┐
                         │      Leadership      │
                         │       Local A        │
                         └──────────┬───────────┘
                                    │
                         Create / Edit / Approve
                                    │
                                    v
                         ┌──────────────────────┐
                         │     Announcement     │
                         │      local_id=A      │
                         │  status: draft →     │
                         │  approved → sent     │
                         └──────────┬───────────┘
                                    │
                                  Send
                                    │
                                    v
                    ┌───────────────────────────────┐
                    │  announcement_recipients       │
                    │  unique(announcement, member)  │
                    │  bulk-inserted, status=queued  │
                    └───────────────┬─────────────────┘
                                    │
                          asynchronous workers
                                    │
              ┌─────────────────────┼─────────────────────┐
              v                     v                     v
        ┌───────────┐         ┌───────────┐         ┌───────────┐
        │ Member A  │         │ Member B  │         │ Member C  │
        │ Local A   │         │ Local A   │         │ Local A   │
        └─────┬─────┘         └─────┬─────┘         └─────┬─────┘
              │                     │                     │
              v                     v                     v
        sent → read →         sent → read            sent → failed
        acknowledged                                  → retry

   Local B data is never returned: every protected operation checks
   the authenticated user's local_id + role against the requested
   resource, via a shared base class every endpoint inherits.

   Live status screens read denormalized counters on the
   announcement row (sent_count/read_count/acknowledged_count),
   never a live COUNT() over announcement_recipients.
```

---

## Part B notes — AI-generated content and approval

*(Implemented as part of the build's AI feature, not a Part A design prompt — see README for the running feature.)*

AI assistance produces a **draft**, not an immediately sendable announcement:

```
Leadership note → AI-generated title/body/preview → Leadership reviews/edits
→ Explicit approval → Send
```

The announcement's `status` field (`draft` → `approved` → `sent`) is the mechanism: the send endpoint rejects any announcement not in `approved` status, so AI-generated text can never reach members without an explicit human approval step in between. Generating a draft does not create recipient rows or trigger delivery — the AI call is isolated from the send path entirely, so a slow or down AI provider degrades the drafting experience but never blocks or corrupts sending.

I rejected automatic AI-to-send because generated wording can be wrong, misleading, or tonally off for a message going to thousands of people's phones — explicit leadership approval is the required human control before anything becomes an official communication.

---

## What I Cut / Next Steps

For this exercise, I did not build full mobile push infrastructure, device-level delivery confirmation, production UI styling, real notification-provider integrations, advanced analytics, websocket-based live updates (polling is used instead), or a complete attendance-management workflow.

If this moved toward production, I would next:

- Verify and remediate the reported cross-local contact-information exposure.
- Add comprehensive authorization and cross-tenant integration tests, including negative tests per endpoint.
- Add the failed-authorization-attempt logging and cross-tenant reconciliation query described in Rule 1's detection section.
- Add a real notification provider, define its delivery/idempotency guarantees, and log provider-side delivery IDs to close Rule 2's provider-level gap.
- Replace polling with websocket/SSE push for the live status screen at higher scale.
- Add retry/backoff tuning and worker observability (queue depth, failure rate, retry age).
- Define announcement retention/archive rules.
- Add audit logging for leadership actions and AI-draft approval events.
- Finalize whether acknowledgement and RSVP should be modeled as fully separate entities as the product matures.
