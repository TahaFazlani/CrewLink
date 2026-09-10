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
npm run seed:dev
```

Swagger: http://localhost:3001/api/docs (compose) or http://localhost:3000/api/docs (local API). Authorize with `Bearer` + `accessToken` from `POST /auth/login`.

Dev logins (password `password123`): `leadership.27@crewlink.local`, `member.27@crewlink.local`, `leadership.99@crewlink.local`, `member.99@crewlink.local`.

Full Phase 7 seed (~2,000 members) is later. Full run steps and Test Accounts land in Phase 10.
