# Deploying to production

The live deployment is two hosted services and one managed database:

| Piece | Where | Serves |
| --- | --- | --- |
| Frontend | Vercel — `project-drishti-seven.vercel.app` | the SPA, built from `frontend/` |
| Backend | Render — `project-drishti-1.onrender.com` | `/api/*` and the Socket.IO endpoint |
| Database | Prisma Postgres | everything |

The camera stack in `docker-compose.yml` — MediaMTX, Redis, and the Python
`ai-service` — is **not hosted**. The backend is written to work without it and
says so rather than pretending; see *What is dead without the camera stack*.

---

## 1. The thing that will break production if you skip it

`feat/sentinel-cctv` carries three migrations that **alter tables the live site
already reads**:

| Migration | Touches existing data |
| --- | --- |
| `20260901172409_add_camera_registry` | new tables only, plus columns on `cameras` |
| `20260901182427_add_police_operations` | **`incidents`** gains `severity`, `source`, `cameraId`, `siteId`, `latitude`, `longitude`, `ruleKey`, `detectionConfidence`; `eventId` and `reporter` become nullable. **`zones`** gains `cameraId`. **`crowd_densities`** loosens `eventId`/`zoneId`. Four CHECK constraints are added. |
| `20260902144105_add_watchlist_and_alerts` | new tables only |

Prisma Client generated from the new schema selects every scalar on the model.
Deploy the backend code **without** applying these and the columns will not
exist, so `GET /api/incidents/...` and the zone endpoints start returning 500s —
features that work on the live site today.

Render does not apply migrations on its own: the start command only runs
`prisma generate`. Use the build script added for this:

```
Root Directory   backend
Build Command    npm ci --include=dev && npm run build:render
Start Command    npm start
```

`build:render` is `prisma generate && prisma migrate deploy && tsc`. Putting the
migration in the build means a failed migration **aborts the deploy and leaves
the old instance serving**, which is what you want.

`--include=dev` is not optional. `typescript` and the `@types/*` packages are
devDependencies, and Render applies the service's environment variables to the
build as well as the run — so with `NODE_ENV=production` set, a plain
`npm ci` omits them and the build fails on `tsc: not found`. `prisma` and
`@prisma/client` are runtime dependencies, so they install either way.

### Before you run it

`migrate deploy` validates the four new CHECK constraints against rows that are
already in the table. Run these against production first — every one must
return `0`, or the migration fails partway and Prisma marks it failed, blocking
every later deploy until you resolve it by hand:

```sql
SELECT count(*) FROM zones          WHERE "eventId" IS NULL;  -- zones_scope_check
SELECT count(*) FROM incidents      WHERE "eventId" IS NULL;  -- incidents_scope_check
SELECT count(*) FROM incidents      WHERE "reporter" IS NULL; -- incidents_reporter_source_check
SELECT count(*) FROM dispatch_units WHERE "eventId" IS NULL;  -- dispatch_units_scope_check
```

They should all be zero on a database that only ever ran the original schema,
where those columns were `NOT NULL`. Check anyway — it costs a minute, and a
failed migration on a live database costs considerably more.

**Take a backup first regardless.** These migrations are not reversible by
re-deploying the old code: the constraints and columns stay behind.

### One data caveat worth knowing

`severity` is added as `NOT NULL DEFAULT 'MEDIUM'`, so **every incident that
already exists becomes "medium" severity** — because the column has a default,
not because anyone assessed those incidents. The post-event report prints that
column. If that matters for historical events, make the column nullable in a
follow-up migration (and handle the null in `formatIncident`, which currently
calls `.toLowerCase()` on it) rather than leaving a backfilled value to be read
as an assessment.

---

## 2. Order of operations

1. **Back up the database.**
2. Run the four pre-flight queries above.
3. **Set the backend environment variables** (next section) — before the deploy,
   so the new instance boots with them.
4. **Deploy the backend** (Render, with `build:render`). Migrations apply during
   the build; the old instance keeps serving until it succeeds.
5. **Check `/health` and the logs** — see *Verifying*.
6. **Deploy the frontend** (Vercel).

Backend before frontend matters beyond the migration: the report endpoint's
field was renamed `safetyScore` → `resolutionRate`. New frontend against old
backend sends a field the old code does not read, and the report goes back to
claiming a safety score of 0. In this order the mismatch never exists.

---

## 3. Environment

`backend/.env.production.example` is the authoritative list, with a note on each
variable saying what happens if you leave it out. The short version:

**Must be set on Render:** `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`,
`FRONTEND_URL`, `GEMINI_API_KEY`.

`JWT_SECRET` is now enforced: the server **exits at boot** in production without
it. Four call sites used to fall back to the literal `'your-secret-key'`, which
is in this repository — a deployment missing the variable was accepting tokens
anyone could forge, including ones claiming the admin or police role. They now
share one accessor (`src/config/jwt.ts`) that has no production fallback. If the
live backend has been running without `JWT_SECRET` set, **every session token
issued so far is forgeable**; setting a real one invalidates them, which is the
point, and everyone signs in again.

`FRONTEND_URL` is the CORS allow-list. It must be the exact origin the browser
sends — `https://project-drishti-seven.vercel.app`, no trailing slash. Only one
origin is read, so Vercel preview URLs on other subdomains will be rejected.

**Demo accounts are now opt-in.** The boot seed creates `test@gmail.com`
(organizer) and `police@gmail.com` (police) with a password published in this
repository, and the police role reaches the surveillance estate, the watchlist
and dispatch. In production the seed does nothing unless `SEED_DEMO_USERS=true`
**and** `SEED_USER_PASSWORD` are both set; asking for it without a password is
refused. It only creates missing accounts and never rewrites an existing
password — so `test@gmail.com`, which the live database already has, keeps the
credentials it has today. Change that password by hand if it matters.

**Leave unset while the camera stack is not hosted:** `REDIS_URL`,
`MEDIAMTX_RTSP_BASE`, `MEDIAMTX_HLS_BASE`, `MEDIAMTX_WEBRTC_BASE`. These now
have honest behaviour when absent rather than a localhost fallback — see below.

**On Vercel:** Root Directory `frontend`, and `VITE_API_URL` pointing at the
Render API. `frontend/.env.production` already carries
`https://project-drishti-1.onrender.com/api`; a dashboard variable overrides it
if you need a different backend. `VITE_SNAPSHOT_BASE_URL` stays blank, which
makes the alerts console say a snapshot was recorded but is not reachable,
instead of rendering a broken image.

---

## 4. What is dead without the camera stack

Nothing crashes. Each piece stands down and says why in the boot log:

| Service | Without its dependency |
| --- | --- |
| Detection consumer | Stands down at boot when `REDIS_URL` is unset in production, logging `no REDIS_URL set in production`. Previously it fell back to `localhost:6379` and reconnected on backoff for the life of the process. |
| Watchlist match engine | Same rule, same log line. |
| Camera health poller | Runs, but an empty camera registry means an empty sweep. It only becomes noise if you seed cameras the deployment cannot reach — then set `CAMERA_HEALTH_ENABLED=false`. |
| Live wall / streams | The API reports that no playable URL exists for a camera whose RTSP host is not the configured MediaMTX, rather than composing a URL that would 404. |

So the police and surveillance pages will render and navigate, and will be
empty of live data. That is the honest state, not a bug — but it is worth
deciding whether to expose those routes publicly before the stack is hosted.

---

## 5. Verifying

After the backend deploy:

- `GET /health` returns `{"status":"OK"}`.
- The boot log shows the database connected and, if you left Redis unset, the
  two `disabled (no REDIS_URL set in production)` lines. It should **not** show
  repeated Redis reconnect errors.
- `GET /api/incidents/event/<an existing event id>` with a valid token returns
  rows — this is the query that fails if the migration did not apply.

After the frontend deploy:

- Log in, open an event with recorded incidents, go to Post-Event Reports. The
  incident table should populate and "Download PDF Report" should be enabled.
  If incidents cannot be read the button stays disabled with a reason, which is
  deliberate: an unread incident list would otherwise be reported as an event
  with no incidents.

---

## 6. Rolling back

Redeploy the previous commit on Render and Vercel. **The migrations do not roll
back** — the new columns and constraints stay. Every added column is nullable or
defaulted and the old code writes rows that satisfy all four constraints, so the
previous version keeps working against the migrated database.

The one thing that does not survive a rollback is data the new code created:
`incidents.eventId` and `reporter` are nullable after the migration, and a
police-scope incident (camera-scoped, no event; or anomaly-sourced, no reporter)
is a shape the old Prisma Client declares non-null. Roll back before anyone
files one and there is nothing to trip over; roll back after, and those rows
need clearing first.

The backup remains the only route back to the pre-migration schema.
