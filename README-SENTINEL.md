# Drishti — Sentinel submission

Gujarat Police Innovation Challenge 2026. Model 1 (standalone camera registry with GIS) plus a
hybrid event-safety layer, on one database and one authentication system.

---

## One-command demo

```bash
cp .env.example .env
cp backend/.env.example backend/.env      # set DATABASE_URL and JWT_SECRET
cp frontend/.env.example frontend/.env

# Sample footage — any MP4s you have the right to use. A handful is enough:
#   media/clips/plaza.mp4, junction.mp4, carpark.mp4
npm run streams:generate                  # turns them into 56 RTSP endpoints

docker compose up -d                      # postgres · redis · mediamtx · ai-service
npm run install:all
npm --prefix backend run prisma:deploy    # apply migrations
npm --prefix backend run seed:cameras     # 5 departments, 16 sites, 56 cameras
npm --prefix backend run seed:units       # 30 dispatch units
npm run dev                               # backend :5001 · frontend :5173
```

Open **http://localhost:5173**.

| Role | Sign in | Lands on |
|---|---|---|
| Police operator | `police@gmail.com` / `Test@123` | Estate overview |
| Organizer | `test@gmail.com` / `Test@123` | Organizer dashboard |

Both are created by the server on first boot. **Admin and police accounts cannot be
self-registered** — `POST /api/auth/register` refuses those roles; an administrator grants them with
`PATCH /api/users/:id/role`.

### Without Docker

Everything except the stream layer and the detector runs on Node and Postgres alone. The camera
registry, health poller, map, watchlist and dispatch all work; pages that need detections show their
empty state and say why. That is the intended behaviour, not a failure mode.

---

## What is real

`npm run verify` runs both type-checks and `scripts/check-no-mocks.sh`, which fails the build on
fabricated data outside a three-entry allowlist (particle animation, ID generation, an upload
filename). It passes with **zero occurrences**, down from 76 when the work started.

Concretely:

- **Camera status** is only ever written by a probe that opened a socket and spoke RTSP `OPTIONS`
  then `DESCRIBE`. A camera nobody has contacted reads *"Not yet probed"* in grey, not red.
- **Crowd counts** come from ray-casting real detection boxes against real zone polygons, using
  logic ported verbatim from the original analyzer and verified identical over 10,000 random points.
- **Match scores** are computed from the edit distance between normalised plates. An exact match
  carries no score at all, because nothing was inferred.
- **A cross-camera link with no plate** is labelled *probable*, capped below certainty, and states
  its reasoning — distance, elapsed time, implied speed, colour and type agreement.
- **Empty states explain themselves.** "No alerts" tells you whether the engine is running, whether
  it can reach Redis, whether anything is on the watchlist, and whether any plate has been read.

Anything not verified end to end is listed in `docs/AUDIT.md`, including the parts that need
hardware this build was developed without.

---

## Layout

```
ai-service/          Python · FastAPI · YOLOv8 + ByteTrack · plate OCR · zone occupancy
backend/             Express + TypeScript · Prisma · Socket.IO
  src/services/      detectionConsumer · matchEngine · cameraHealth · anomalyRules · dispatch
frontend/            React 18 · Vite · Tailwind · react-leaflet · hls.js
  src/pages/police/  alerts · watchlist · vehicle trail · detection search · dispatch · overview
  src/pages/surveillance/  registry · map · live wall
docker/              generated MediaMTX config
scripts/             check-no-mocks.sh · generate-streams.js
docs/                AUDIT · HLD · SECURITY · SCALE-80K · COST-BENEFIT · DEMO-SCRIPT
```

## Documents

| File | What it answers |
|---|---|
| `docs/AUDIT.md` | What was fabricated, what was fixed, and exactly what remains unverified |
| `docs/HLD.md` | Architecture, data flow, ERD, API surface, deployment topology |
| `docs/SECURITY.md` | RBAC, encryption, credential vaulting, audit trail, IT Act / DPDP |
| `docs/SCALE-80K.md` | 80,000-camera sizing — measured figures separated from assumptions |
| `docs/COST-BENEFIT.md` | CAPEX/OPEX, per-camera cost, comparison with a commercial VMS |
| `docs/DEMO-SCRIPT.md` | The five-minute run-through |

## Configuration

Every setting is an environment variable, documented in `.env.example`, `backend/.env.example` and
`frontend/.env.example`. Nothing a judge might ask to change during a demo is hardcoded — stream
host, frame stride, poll interval, fuzzy-match distance, retention windows and the model path are
all env vars.

Two that matter:

- **`CAMERA_CREDENTIAL_KEY`** — 32-byte AES key for camera passwords. Unset, the API refuses to
  store a credential rather than writing plaintext.
- **`PLATE_MODEL_PATH`** — unset by default, so plate reading is off and `plateText` is null on every
  vehicle. It is never guessed from a crop of the car.
