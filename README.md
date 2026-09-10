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
```

Full run steps, test accounts, and curl examples land in Phase 10.
