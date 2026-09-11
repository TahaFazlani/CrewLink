# CrewLink

 Announcement and callout slice. Design (including what was cut): `DESIGN.md`.

 ## Run Locally

 CrewLink can be run locally without Docker.

 You will need:

 - Node.js 20+
- npm
- PostgreSQL
- Git

 The project consists of:

 - **Backend:** NestJS API
- **Frontend:** Next.js web application
- **Database:** PostgreSQL

 ## 1\. Clone the Repository

```
git clone https://github.com/TahaFazlani/CrewLink.git
cd CrewLink
```

 ## 2\. Set Up PostgreSQL

 Make sure PostgreSQL is installed and running locally.

 Create a database for CrewLink:

```
CREATE DATABASE crewlink;
```

 The default PostgreSQL configuration is:

```
Host: localhost
Port: 5432
Database: crewlink
```

 Use the PostgreSQL username and password configured on your machine.

 ## 3\. Configure the Backend

 Go to the backend directory:

```
cd backend
```

 Copy the example environment file:

```
cp .env.example .env
```

 Update `backend/.env` with your local PostgreSQL configuration.

 For example:

```
DATABASE_URL=postgresql://crewlink:crewlink@localhost:5433/crewlink
```

 Use the exact variable names provided by `backend/.env.example` if they differ.

 ### AI Configuration

 AI drafting is optional.

 To enable AI drafting, add:

```
OPENAI_API_KEY=your_openai_api_key
```

 Optional configuration:

```
OPENAI_MODEL=your_model
AI_TIMEOUT_MS=30000
OPENAI_BASE_URL=https://api.openai.com/v1
```

 If `OPENAI_API_KEY` is missing or the AI provider is unavailable, `POST /announcements/ai-draft` returns `503` / `504`.

 Manual announcement creation, approval, and sending continue to work without AI.

 ## 4\. Install Backend Dependencies

 From the `backend` directory:

```
npm install
```

 ## 5\. Run Database Migrations

```
npm run migration:run
```

 ## 6\. Seed the Database

```
npm run seed
```

 The seed command creates the local test data and prints the generated IDs.

 If you re-run the seed, use the IDs printed by the latest seed operation.

 ## 7\. Start the Backend

 For local development:

```
npm run start:dev
```

 The NestJS API will be available at:

```
http://localhost:3001
```

 Useful endpoints:

 - Health: `http://localhost:3000/health`
- Swagger: `http://localhost:3000/api/docs`

 ### Production-style Local Start

 Build the backend:

```
npm run build
```

 Then start it:

```
npm run start:prod
```

 The production build runs:

```
node dist/main
```

 ## 8\. Set Up the Frontend

 Open a **new terminal** and return to the project root:

```
cd CrewLink
```

 If the frontend is located in `frontend/`:

```
cd frontend
```

 Install dependencies:

```
npm install
```

 If the frontend has an environment example file, copy it:

```
cp .env.example .env.local
```

 Set the backend API URL:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

 If `.env.example` does not exist, create `.env.local` manually with the variable above.

 ## 9\. Start the Frontend

 Run:

```
npm run dev
```

 The frontend will be available at:

```
http://localhost:3000
```

 The frontend communicates with the backend at:

```
http://localhost:3001
```

 ## Local Development Setup

 Once everything is running, the architecture is:

```
PostgreSQL
    │
    │ localhost:5432
    ▼
NestJS Backend
    │
    │ http://localhost:3001
    ▼
Next.js Frontend
    │
    │ http://localhost:3000
    ▼
Browser
```

 You will normally have three processes running:

 ### Terminal 1 — PostgreSQL

 Make sure your local PostgreSQL service is running.

 ### Terminal 2 — Backend

```
cd backend
npm run start:dev
```

 ### Terminal 3 — Frontend

```
cd frontend
npm run dev
```

 ## Test Accounts

 All test accounts use the password:

```
password123
```

 ### Local 27

 #### Leadership

```
Email: leadership.27@crewlink.local
Password: password123
Role: leadership
Local: Local 27
Local ID: 007712ff-2671-4217-a818-70b881951567
```

 #### Member

```
Email: member.27@crewlink.local
Password: password123
Role: member
Local: Local 27
Local ID: 007712ff-2671-4217-a818-70b881951567
```

 ### Local 99

 #### Leadership

```
Email: leadership.99@crewlink.local
Password: password123
Role: leadership
Local: Local 99
Local ID: 87b8757a-f614-42ec-8921-bcf8974d5600
```

 #### Member

```
Email: member.99@crewlink.local
Password: password123
Role: member
Local: Local 99
Local ID: 87b8757a-f614-42ec-8921-bcf8974d5600
```

 ## Authentication

 Authentication is performed through:

```
POST /auth/login
```

 Request:

```
{
  "email": "member.27@crewlink.local",
  "password": "password123"
}
```

 The response contains an access token.

 Use the token for authenticated requests:

```
Authorization: Bearer <accessToken>
```

 ## API Endpoints

 ### Authentication

```
POST /auth/login
```

 ### Leadership

```
POST /announcements
POST /announcements/ai-draft
POST /announcements/:id/approve
POST /announcements/:id/send
GET  /announcements/:id
```

 ### Members

```
GET  /me/announcements
GET  /me/announcements/:id
POST /me/announcements/:id/acknowledge
```

 ## Member Read + Acknowledge

 The following examples assume the backend is running on port `3001`.

 ### Login

```
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"member.27@crewlink.local","password":"password123"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
```

 ### Read an Announcement

```
curl -s http://localhost:3001/me/announcements/b626bc32-066e-4659-b536-e2056305f946 \
  -H "Authorization: Bearer $TOKEN"
```

 ### Acknowledge an Announcement

```
curl -s -X POST http://localhost:3001/me/announcements/b626bc32-066e-4659-b536-e2056305f946/acknowledge \
  -H "Authorization: Bearer $TOKEN"
```

 ## Cross-Local Access

 Local 27 must not be able to access Local 99 announcements or members.

 For example, log in as Local 27 leadership:

```
L27=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"leadership.27@crewlink.local","password":"password123"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
```

 Attempt to access the other-local member:

```
curl -i http://localhost:3001/announcements/7ce64430-962f-4cd2-8a68-5ff6824204b5 \
  -H "Authorization: Bearer $L27"
```

 Expected response:

```
404
```

 The API must not expose data belonging to another local.

 ## Existing Seed IDs

 The current seed data includes:

```
{
  "existingAnnouncementId": "b626bc32-066e-4659-b536-e2056305f946",
  "otherLocalMemberId": "7ce64430-962f-4cd2-8a68-5ff6824204b5"
}
```

 These IDs are associated with the seed data. If the seed command generates different IDs, use the values printed by the latest seed operation.

 ## Automated Tests

 Run the end-to-end tests from the backend directory:

```
cd backend
npm run test:e2e
```

 The automated tests cover:

 - API health
- Authentication
- Seed logins
- Announcement creation
- Double-send protection
- Cross-local access returning `404`
- Member access restrictions
- Retired members being excluded from sends
- Suspended members being excluded from sends

 Workers claim queued rows using:

```
SELECT ... FOR UPDATE SKIP LOCKED
```

 This prevents two workers from processing the same recipient simultaneously.

 ## Development Commands

 ### Backend

 From `backend/`:

```
npm install
```

 Start development server:

```
npm run start:dev
```

 Run migrations:

```
npm run migration:run
```

 Seed database:

```
npm run seed
```

 Build:

```
npm run build
```

 Start production build:

```
npm run start:prod
```

 Run E2E tests:

```
npm run test:e2e
```

 ### Frontend

 From `frontend/`:

```
npm install
```

 Start development server:

```
npm run dev
```

 ## Quick Start

 After PostgreSQL is installed, running, and the `crewlink` database has been created:

 ### Terminal 1 — Backend

```
cd backend

cp .env.example .env

npm install

npm run migration:run

npm run seed

npm run start:dev
```

 ### Terminal 2 — Frontend

```
cd frontend

npm install

npm run dev
```

 Then open the application:

```
http://localhost:3001
```

 Backend:

```
http://localhost:3000
```

 Swagger:

```
http://localhost:3000/api/docs
```

 ## Important

 Docker is **not required** for local development.

 The local setup requires PostgreSQL to be running separately, with the backend configured to connect to:

```
localhost:5432
```

 The frontend connects to the NestJS backend through:

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```