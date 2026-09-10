# CrewLink

Announcement and callout slice (Part B). Design: `DESIGN.md`. Implementation checklist: `PLAN.md`.

## Run

```bash
docker compose up --build
```

- API: http://localhost:3001/health
- Web: http://localhost:3000

Copy `backend/.env.example` to `backend/.env` for local (non-Docker) API runs. Postgres must be up (`DATABASE_URL`).

Full run steps, test accounts, and curl examples land in Phase 10.
