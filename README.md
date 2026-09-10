# CrewLink

Announcement and callout slice. Design (including what was cut): `DESIGN.md`.

## Run

```bash
docker compose up --build
```

Compose does **not** migrate or seed on boot. After `db` is healthy:

```bash
docker compose exec api npm run migration:run
docker compose exec api npm run seed
```

- API: http://localhost:3001 (`GET /health`, Swagger `/api/docs`)
- Web: http://localhost:3000 (leadership page; set `NEXT_PUBLIC_API_URL` to this API)

Without Docker, copy `backend/.env.example` → `backend/.env` (compose Postgres is **localhost:5433**), then from `backend/`: `npm run migration:run` and `npm run seed`.

Logins (password `password123`): **Local 27 leadership** `leadership.27@crewlink.local` and **Local 27 member** `member.27@crewlink.local`. Local 99 mirrors those addresses with `.99`. IDs below are from `npm run seed`; re-run seed reprints them.

AI drafting uses `OPENAI_API_KEY` (optional `OPENAI_MODEL`, `AI_TIMEOUT_MS`, `OPENAI_BASE_URL`). If the key is missing or the provider is down, `POST /announcements/ai-draft` returns **503** / **504**, no row is created, and approve/send still work for a manual draft.

**Rule 2:** `npm run test:e2e` in `backend/` double-`POST /announcements/:id/send` and asserts one `announcement_recipients` row per member (unique `(announcement_id, member_id)`). Workers are **not** raced in CI; they claim queued rows with `SELECT … FOR UPDATE SKIP LOCKED`, so two workers cannot process the same recipient.

On submit, export AI chat sessions to the repo root (brief §5 / §6).

## TEST ACCOUNTS

```json
{
  "auth": {
    "method": "POST /auth/login",
    "body": { "email": "string", "password": "string" },
    "header": "Authorization: Bearer <accessToken>"
  },
  "accounts": [
    {
      "email": "leadership.27@crewlink.local",
      "password": "password123",
      "role": "leadership",
      "localName": "Local 27",
      "localId": "007712ff-2671-4217-a818-70b881951567"
    },
    {
      "email": "member.27@crewlink.local",
      "password": "password123",
      "role": "member",
      "localName": "Local 27",
      "localId": "007712ff-2671-4217-a818-70b881951567"
    },
    {
      "email": "leadership.99@crewlink.local",
      "password": "password123",
      "role": "leadership",
      "localName": "Local 99",
      "localId": "87b8757a-f614-42ec-8921-bcf8974d5600"
    },
    {
      "email": "member.99@crewlink.local",
      "password": "password123",
      "role": "member",
      "localName": "Local 99",
      "localId": "87b8757a-f614-42ec-8921-bcf8974d5600"
    }
  ],
  "existingAnnouncementId": "b626bc32-066e-4659-b536-e2056305f946",
  "otherLocalMemberId": "7ce64430-962f-4cd2-8a68-5ff6824204b5",
  "endpoints": [
    { "method": "POST", "path": "/auth/login" },
    { "method": "POST", "path": "/announcements" },
    { "method": "POST", "path": "/announcements/ai-draft" },
    { "method": "POST", "path": "/announcements/:id/approve" },
    { "method": "POST", "path": "/announcements/:id/send" },
    { "method": "GET", "path": "/announcements/:id" },
    { "method": "GET", "path": "/me/announcements" },
    { "method": "GET", "path": "/me/announcements/:id" },
    { "method": "POST", "path": "/me/announcements/:id/acknowledge" }
  ]
}
```

Member read + ack (compose API port **3001**):

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"member.27@crewlink.local","password":"password123"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

curl -s http://localhost:3001/me/announcements/b626bc32-066e-4659-b536-e2056305f946 \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST http://localhost:3001/me/announcements/b626bc32-066e-4659-b536-e2056305f946/acknowledge \
  -H "Authorization: Bearer $TOKEN"
```

Local 27 cannot read Local 99 (Rule 1 — expect **404**, not the other local’s data):

```bash
L27=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"leadership.27@crewlink.local","password":"password123"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# other-local member id is not an announcement in Local 27
curl -i http://localhost:3001/announcements/7ce64430-962f-4cd2-8a68-5ff6824204b5 \
  -H "Authorization: Bearer $L27"
```

Automated checks: `cd backend && npm run test:e2e` (health, double-send, cross-local 404, member 403 on leadership routes, seed logins, retired/suspended excluded from send).
