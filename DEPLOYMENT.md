# Render backend deployment

This Git checkout has `package.json` at its root. Do not use `cd backend`
or try to build a sibling frontend folder from this repository.

Create a Render Node Web Service connected to the backend source:

| Setting | Value |
| --- | --- |
| Root Directory | Leave empty |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/v1/health` |

Set `NODE_ENV=production`, a PostgreSQL `DATABASE_URL`, strong distinct
`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, and `FRONTEND_URL` to the frontend's
HTTPS origin (without a trailing slash). Render supplies `PORT`.
Configure any additional integrations using `.env.example` as a reference.

Builds generate Prisma Client and compile TypeScript without modifying the database.
Before first use, run `npm run db:deploy` against the intended database in a
controlled environment. Review schema changes and back up existing data first.
This command uses `prisma db push` and refuses changes requiring acceptance of
data loss. Apply subsequent schema changes deliberately before running the new app.

`render.yaml` provides equivalent Blueprint settings for a new service.
For an existing manually configured service, update its dashboard settings.

## Verify the connected Git source

The local backend and frontend checkouts currently both point to
`htechsolution98-del/Expense-and-Finance-Management-System`, branch `rohan`,
but their committed root files differ. Verify which app that remote branch actually
contains. Deploy each app from a repository or branch containing its corresponding
files; separate repositories are also suitable. A single branch cannot represent
both of these different root layouts simultaneously.

If you intentionally combine them into one repository later, set each service's
Root Directory to its actual app subfolder. These settings assume the current
layout where each app's `package.json` is at its Git root.
