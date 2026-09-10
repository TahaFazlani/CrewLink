# CrewLink

Announcement and callout slice (Part B). Design: `DESIGN.md`. Implementation checklist: `PLAN.md`.

## Run

```bash
docker compose up --build
```

- API: http://localhost:3001/health
- Web: http://localhost:3000

Copy `backend/.env.example` to `backend/.env` for local (non-Docker) API runs. Postgres is published at **localhost:5433** (container 5432) so it does not collide with a local Postgres on 5432. Use `DATABASE_URL=postgresql://crewlink:crewlink@localhost:5433/crewlink`.

After Postgres is up, apply schema from `backend/`:

```bash
npm run migration:run
npm run seed
```

`npm run seed:dev` is a 4-login shortcut only. Full seed: Local 27 (~2,000 members) and Local 99 (200), same logins as below, plus a pre-sent announcement in Local 27. Re-runnable (no duplicate locals/members/announcement).

Swagger: http://localhost:3001/api/docs (compose) or http://localhost:3000/api/docs (local API). Authorize with `Bearer` + `accessToken` from `POST /auth/login`.

Logins (password `password123`): `leadership.27@crewlink.local`, `member.27@crewlink.local`, `leadership.99@crewlink.local`, `member.99@crewlink.local`.

Announcement id and other-local member id are printed when the seed finishes. Full Test Accounts JSON lands in Phase 10.
