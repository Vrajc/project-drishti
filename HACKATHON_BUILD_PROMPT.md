# Drishti → Gujarat Police CCTV Hackathon 2026: Build Prompt

> Paste this whole file into Claude Code in VS Code as your opening message.
> Work **one phase at a time**. Do not let it attempt several phases in a single run.

---

## ROLE & MISSION

You are working on **Drishti**, an existing full-stack AI event-safety platform
(`frontend/` React+Vite+TS, `backend/` Express+TS+Prisma+Postgres, `backend/src/services/crowd_analyzer.py` OpenCV).

We are entering the **Gujarat Police Innovation Challenge 2026** (sentinel.gujarat.gov.in).
Submission deadline **7 September 2026**. Live evaluation **10–11 September 2026**.

There are **two goals, of equal weight**:

**GOAL A — Make the existing Drishti real.**
Today large parts of Drishti are simulated: random numbers, hardcoded counts, fabricated alerts,
and a crowd-analysis pipeline that ignores the uploaded video and writes fake rows. Every feature
that Drishti already advertises must become genuinely end-to-end: real data, real detections,
real database reads, no `Math.random()` standing in for a measurement.

**GOAL B — Drive it from live camera feeds and add what the hackathon requires.**
Crowd analysis must run on **live camera streams**, not uploaded video files. On top of that,
add the hackathon deliverables: a standalone camera registry with GIS (mandatory Model 1),
~50 heterogeneous live feeds, watchlist matching against live video, real-time alerts, and
cross-camera vehicle tracking with route history.

**Drishti's purpose, identity, roles and user workflow stay exactly as they are.** It remains an
AI-powered safety platform for organizers, participants and admins. We are making it true, and
extending it — not replacing it.

---

## THE ONE RULE THAT OVERRIDES EVERYTHING

> **No fabricated data anywhere in the product.**
> If a number is displayed to a user, it must be derived from a real detection, a real database
> row, or a real computation. If the real value is not available yet, show an explicit empty
> state ("No camera assigned", "Awaiting first detection") — never a plausible-looking invented
> number. `Math.random()` is banned outside of animation, particle effects and ID generation.

A judge who spots one fake number will distrust the entire demo. This rule is not negotiable and
is not tradeable against schedule pressure.

---

## CONFIRMED MOCK/BROKEN INVENTORY (verify each, then fix)

I audited the repo. These are real findings, with file and line references as of today:

| # | File | Problem |
|---|---|---|
| 1 | `backend/src/controllers/crowdAnalysis.controller.ts:81-90` | The video upload endpoint **never runs the analyzer**. It calls `crowdAnalysisService.generateAndSaveMockCrowdData(...)` and discards the uploaded file. All crowd data in the product is invented. |
| 2 | `backend/src/services/crowdAnalysis.service.ts:292-370` | `generateAndSaveMockCrowdData()` — writes `CrowdDensity` rows from `5 + Math.random()*5`, with fake `confidence` and `processingTime`. |
| 3 | `backend/src/utils/mockCrowdData.ts` | Second fake generator, `Math.random()*50+20` people per zone. |
| 4 | `backend/src/services/crowd_analyzer.py` | The genuine OpenCV HOG pipeline exists but is **dead code** — nothing calls it. HOG is also too weak to keep; it will be replaced by YOLO. |
| 5 | `frontend/src/pages/AnomalyDetection.tsx:49-160` | Entirely fabricated. `generateMockAlert()` fires on a timer, picks a random type/location/description, invents a 75–100% "confidence", and draws detection boxes when `Math.random() > 0.7`. |
| 6 | `frontend/src/pages/EmergencyDispatch.tsx:137,178-190` | Responders are invented, and coordinates are hardcoded to **New York (40.7128, -74.0060)**. A Gujarat Police judge will notice this immediately. |
| 7 | `frontend/src/pages/EmergencyDispatch.tsx:231-238` | "Optimal routing" picks a **random** responder; ETA and distance are `Math.random()`. |
| 8 | `frontend/src/pages/AdminDashboard.tsx:103-123` | `mockParticipants = 2103`, `mockAdmins = 16`, `avgSafetyScore = 94.5` — hardcoded platform statistics. |
| 9 | `frontend/src/pages/LiveMonitoring.tsx:792-793` | Zone Status panel invents each zone's status and crowd percentage with `Math.random()`. |
| 10 | `frontend/src/pages/PreSafetyPlanning.tsx:20-33` | Comment in the code admits analyses previously ran on hardcoded fallbacks; zones still fall back to invented `['Main Area','Food Court','VIP Section']`. |
| 11 | `AISummaries`, `PostEventReports`, `OrganizerDashboard`, `ParticipantDashboard`, `MyEvents`, `EventExplore` | Read from `EventContext` — verify each actually renders live DB data and has a real empty state, rather than falling back to constants. |

Treat this table as a starting point, not a complete list. In Phase 0 you will search for the rest.

---

## CURRENT STATE (verify, don't assume)

```
backend/src/
  server.ts                       routes: /api/{auth,events,users,monitoring,ai,incidents,crowd-analysis}
                                  no WebSocket, no realtime anything
  controllers/                    ai, auth, crowdAnalysis, event, incident
  services/crowdAnalysis.service.ts   spawns python once per uploaded file (path currently bypassed)
  services/crowd_analyzer.py      OpenCV HOG, offline, per-file, unused
  utils/openai.service.ts         Gemini / OpenAI wrappers — these are real
backend/prisma/schema.prisma      User, Event, Zone, Camera, DispatchUnit, EventRegistration,
                                  Incident, CrowdDensity, AISummary, SystemLog, Notification
frontend/src/pages/               Landing, Login, Register, EventSetup, MyEvents, EventExplore,
                                  LiveMonitoring, CrowdFlowAnalysis, AnomalyDetection,
                                  EmergencyDispatch, PostEventReports, PreSafetyPlanning,
                                  AISummaries, Admin/Organizer/Participant dashboards
docker-compose.yml                exists at repo root
```

Two structural facts that shape the plan:

- `Camera` already has `cameraId, name, location, ipAddress, rtspUrl`, but `eventId` is
  **required** — a camera cannot exist without an event. The mandatory Model 1 needs a
  standalone, event-independent camera registry. Making `eventId` nullable is backward
  compatible: every existing `where: { eventId }` query keeps working.
- Auth, event CRUD, incidents and the Gemini AI features appear genuinely wired. Protect them.

---

## TARGET ARCHITECTURE

```
   RTSP (real cams, or MediaMTX looping sample MP4s as 50 endpoints)
                     │
        ┌────────────▼─────────────────────────────────┐
        │  ai-service/   Python + FastAPI              │
        │  one worker per camera, continuous:          │
        │   • YOLOv8  person + vehicle                 │
        │   • ByteTrack  stable track ids              │
        │   • ANPR  plate crop → PaddleOCR             │
        │   • zone occupancy (real people counts)      │
        └────────────┬─────────────────────────────────┘
                     │ detections → Redis Stream
        ┌────────────▼─────────────────────────────────┐
        │  backend/  Express + TS   (EXISTING)         │
        │  • ingests detections                        │
        │  • writes REAL CrowdDensity rows             │
        │  • rule engine → REAL anomalies/Incidents    │
        │  • watchlist match engine → Alerts           │
        │  • Socket.IO push to browser                 │
        │  • all existing /api/* routes preserved      │
        └────────────┬─────────────────────────────────┘
                     │ REST + WebSocket
        ┌────────────▼─────────────────────────────────┐
        │  frontend/  React  (EXISTING SHELL)          │
        │  existing pages, now fed by real data        │
        │  + /surveillance/{registry,map,watchlist,    │
        │      alerts,track,search}                    │
        └──────────────────────────────────────────────┘
```

**Locked technology choices — use these, do not deliberate:**

| Concern | Choice |
|---|---|
| Demo stream source | MediaMTX in docker-compose, looping sample MP4s as `rtsp://mediamtx:8554/cam01…cam50` |
| Detection | `ultralytics` YOLOv8n/s — person + vehicle classes |
| Tracking | ByteTrack via `model.track(persist=True)` |
| ANPR | licence-plate detector + PaddleOCR (EasyOCR fallback) |
| AI service | Python 3.11 + FastAPI + uvicorn in `ai-service/` at repo root |
| AI ⇄ backend bus | Redis Streams (add `redis` to docker-compose) |
| Browser realtime | Socket.IO mounted on the existing Express server |
| GIS | `react-leaflet` + OpenStreetMap tiles |
| Routing / ETA | OSRM public demo server, or `osrm-backend` in docker — **never** a random ETA |
| Face recognition (bonus, last) | InsightFace + pgvector |
| Camera discovery | `onvif-zeep` WS-Discovery |
| Geography | **Gujarat only.** Gandhinagar / Ahmedabad coordinates. Purge every New York coordinate. |

---

## PHASE 0 — Truth audit (read-only, no code changes)

Read `backend/prisma/schema.prisma`, `backend/src/server.ts`, every file in `backend/src/routes/`
and `backend/src/controllers/`, `backend/src/services/*`, `frontend/src/App.tsx`,
`frontend/src/contexts/*`, `frontend/src/services/*`, and every file in `frontend/src/pages/`.
Also `docker-compose.yml`, both `package.json` files, and `.env.example`.

Then produce **`docs/AUDIT.md`** containing:

1. Every existing API endpoint, with its request/response shape.
2. A table of **every page**, and for each: which data is real (traced to a DB read), which is
   fabricated, and which is dead UI wired to nothing.
3. Every occurrence of `Math.random()`, hardcoded arrays, and mock generators, with file:line —
   confirm or correct my inventory table above.
4. Anything that is currently broken or throws.
5. A dependency order: what must be real before what else can become real.

**Stop. Show me `docs/AUDIT.md` and wait for my go-ahead before Phase 1.**

Also add `scripts/check-no-mocks.sh` — greps the codebase for `Math.random`, `mock`, `dummy`,
`fake`, `hardcode` outside an allowlist (animations, ID generation, tests) and exits non-zero on a
hit. Wire it into `npm run verify`. From here on, every phase must end with this passing.

---

## PHASE 1 — Camera registry & GIS foundation *(mandatory Model 1)*

Cameras become first-class, event-independent, geolocated entities, shown on a map.

**Schema (additive only, nullable columns, migration `add_camera_registry`):**

- `Camera.eventId` → `String?` (optional). Existing queries keep working.
- Add to `Camera`: `latitude Float?`, `longitude Float?`, `vendor String?`, `model String?`,
  `protocol String?`, `onvifUrl String?`, `username String?`, `passwordEnc String?`,
  `resolution String?`, `fps Int?`, `status CameraStatus @default(UNKNOWN)`,
  `lastSeenAt DateTime?`, `departmentId String?`, `siteId String?`,
  `isPtz Boolean @default(false)`, `coverageAngle Int?`, `coverageRadius Int?`
- New: `Department` (name, code, contact), `Site` (name, departmentId, address, lat, lng, district),
  `CameraHealth` (cameraId, checkedAt, isOnline, latencyMs, errorMessage)
- New enum `CameraStatus { ONLINE OFFLINE DEGRADED UNKNOWN }`

**Backend:** `backend/src/routes/surveillance.routes.ts` + controller + service, mounted at
`/api/surveillance`. Camera CRUD, bulk CSV import, department/site CRUD,
`GET /cameras/geojson`, `POST /cameras/:id/health-check`, `POST /cameras/discover` (ONVIF).

**Frontend:** `frontend/src/pages/surveillance/CameraRegistry.tsx` (filterable table, add/edit
modal, CSV import) and `CameraMap.tsx` (react-leaflet, clustered markers coloured by real status,
click → detail drawer). Add a Surveillance section to the existing navbar for `ADMIN` and a new
`POLICE` role. Leave navigation for all other roles untouched.

**Seed:** `backend/prisma/seed-cameras.ts` — ~55 cameras across 5 departments
(Health, Police, GSRTC, Panchayat, Municipal) at **real Gandhinagar/Ahmedabad coordinates**.

**Done when:** every pre-existing page still works; the map shows 55 real pins; camera create,
edit and CSV import all persist to Postgres; no event is required to own a camera.

---

## PHASE 2 — Live stream layer: 50 feeds without 50 cameras

- Add **MediaMTX** to `docker-compose.yml`, configured to loop a folder of sample MP4s as 50
  distinct RTSP endpoints, with HLS/WebRTC output for the browser.
- `scripts/generate-streams.js` — takes a folder of clips, writes the MediaMTX config and a
  matching camera seed so a handful of files become 50 named endpoints.
- `GET /api/surveillance/cameras/:id/stream` returns the playable URL.
- `frontend/src/pages/surveillance/LiveWall.tsx` — 5×5 grid of genuinely playing feeds, name and
  live status overlaid, click to expand.
- Health poller every 30s writes real `CameraHealth` rows and updates `Camera.status`.

**Done when:** 50 feeds play simultaneously in the browser, and killing one flips that camera to
OFFLINE on the map within 60s — because the poller actually probed it.

---

## PHASE 3 — The real analytics engine

Create `ai-service/` at the repo root. This single service produces every detection in the
product; nothing downstream may invent one.

```
ai-service/
  main.py                  FastAPI: /health, /workers, /workers/{cam}/start|stop
  workers/stream_worker.py one asyncio task per camera: RTSP → detect → track → publish
  models/detector.py       YOLOv8 person + vehicle
  models/plate.py          plate detect + OCR → text + confidence
  models/tracker.py        ByteTrack, stable track_id per camera
  zones.py                 point-in-polygon occupancy — PORT the existing logic from
                           backend/src/services/crowd_analyzer.py, don't reinvent it
  publisher.py             Redis Stream publisher
  config.py  requirements.txt  Dockerfile
```

Detection event contract (both sides depend on this exact shape):

```json
{
  "cameraId": "CAM-014", "ts": "2026-09-10T11:04:22.310Z",
  "trackId": 42, "class": "car", "confidence": 0.91,
  "bbox": [x, y, w, h],
  "attributes": { "plateText": "GJ01AB1234", "plateConfidence": 0.87,
                  "color": "white", "vehicleType": "sedan" },
  "zoneOccupancy": { "zone-uuid-1": 14, "zone-uuid-2": 3 },
  "snapshotPath": "/snapshots/CAM-014/1757502262310.jpg"
}
```

Sample every Nth frame (default 3) so 50 streams are feasible on one machine. On stream failure,
retry with backoff and report the camera as DEGRADED — never silently fill the gap.

Retire `crowd_analyzer.py` only after its zone logic is ported; keep the file with a header
comment pointing to its replacement.

**Done when:** starting a worker publishes real detections within 5s, and plates in the sample
footage are read correctly ≥70% of the time.

---

## PHASE 4 — Make existing Drishti features real, on live feeds

This is Goal A. Every item below replaces fabricated data with data from Phase 3. Do not change
any page's layout, styling or user flow — only its data source.

**4.1 Crowd flow analysis → live.** Backend consumer writes **real** `CrowdDensity` rows from
`zoneOccupancy` on live detections. Delete `mockCrowdData.ts`, `generateAndSaveMockCrowdData()`
and the `generateMockData` controller. `CrowdFlowAnalysis.tsx` keeps its charts but streams live
values over Socket.IO. Keep the upload endpoint as a *secondary* "analyse archived footage" path —
but make it genuinely run the analyzer on the uploaded file instead of bypassing it.

**4.2 Anomaly detection → real.** Delete `generateMockAlert()` entirely. Build
`backend/src/services/anomalyRules.service.ts` computing anomalies from actual detections:
crowd density over a zone's `maxCapacity` threshold, sudden surge (rate of change), loitering
(same `trackId` in a zone beyond N seconds), zone-capacity breach, camera offline, and
unusual-hour motion. Each anomaly persists an `Incident` and pushes over Socket.IO with the real
contributing frame as evidence. Confidence must come from the detector, not from a random range.
The detection boxes drawn in the UI must be the real `bbox` values.

**4.3 Live monitoring → real.** Zone Status reads live `CrowdDensity` per zone. Camera tiles show
real streams and real health. Every counter traces to a query.

**4.4 Emergency dispatch → real.** Responders come from the `DispatchUnit` table only; if an event
has none, show an empty state with a link to add them — no invented responders. Give `DispatchUnit`
`latitude`/`longitude`. Replace the random "optimal routing" with a genuine nearest-unit
computation and a real OSRM road-distance ETA. Purge every New York coordinate; the map centres on
the event's real location.

**4.5 Admin dashboard → real.** Add `GET /api/users/stats` returning true counts by role from
Postgres. Replace `mockParticipants`, `mockAdmins`, `mockAvgSafetyScore`. If a metric like "average
safety score" has no real definition, either define and compute it honestly (from incident counts,
response times and density breaches) or remove the tile. Do not display an undefined metric.

**4.6 Pre-safety planning → real.** Feed the AI the event's actual zones, crowd size, location and
camera layout. Remove the `['Main Area','Food Court','VIP Section']` fallback; if the event has no
zones, prompt the organizer to define them.

**4.7 Everything else.** Work through the `docs/AUDIT.md` table and make each remaining page real,
including honest empty states.

**Done when:** `scripts/check-no-mocks.sh` passes, and you can walk the full organizer journey —
create event → define zones → assign registry cameras → live monitoring → crowd analysis →
anomaly → dispatch → post-event report — with every number traceable to a real detection or row.

---

## PHASE 5 — Watchlist, matching, real-time alerts

**Schema:** `WatchlistEntry` (entityType VEHICLE|PERSON, plateNumber?, vehicleMakeModel?, color?,
personName?, photoUrl?, embedding?, caseNumber, caseType, severity, issuedBy, issuedAt, expiresAt?,
isActive, notes) · `Detection` (persisted detections, indexed on `(cameraId, ts)` and `plateNumber`)
· `Alert` (watchlistEntryId, detectionId, cameraId, matchType, matchScore, ts, status
NEW|ACKNOWLEDGED|DISPATCHED|CLOSED|FALSE_POSITIVE, acknowledgedBy?, acknowledgedAt?, notes)
· `TrackPoint` (trackId, cameraId, ts, lat, lng, plateNumber?).

**Match engine** (`backend/src/services/matchEngine.service.ts`): consume the Redis Stream,
normalise plate text (strip spaces/hyphens, `O↔0`, `I↔1`), fuzzy-match active watchlist entries
(Levenshtein ≤1 = probable match at a lower score), deduplicate repeats from the same camera
within 30s, persist `Detection` + `Alert`, emit `alert:new` on Socket.IO. Match scores are computed,
never assigned.

**Frontend:** `Watchlist.tsx` (CRUD + CSV import of stolen-vehicle lists) and `AlertsConsole.tsx`
(live feed with real snapshot, camera, score; acknowledge / dispatch / false-positive). Alert-count
badge in the navbar. Reuse the existing JWT middleware — no second auth system.

**Done when:** adding `GJ01AB1234` to the watchlist raises an alert within 3 seconds of that plate
passing any running camera, with the correct snapshot and camera name.

---

## PHASE 6 — The graded test case: cross-camera vehicle tracking

- `VehicleTracking.tsx`: search a plate (or pick a watchlist entry) → every sighting across all
  cameras, in time order.
- Route drawn on the Leaflet map: numbered markers, chronological polyline, real snapshot in each
  popup.
- Timeline scrubber under the map advancing the vehicle marker along the route.
- Cross-camera re-identification: same plate = same vehicle. Where the plate is unreadable, fall
  back to colour + type + spatio-temporal plausibility (time gap vs real distance between the two
  cameras) and label the link **"probable"** with its computed score. Never present an inferred
  link as certain.
- Export the trail as PDF by **reusing `frontend/src/utils/pdfGenerator.ts`**.
- `EventSearch.tsx`: filter all detections by camera, class, plate, colour and time range, with
  snapshots and CSV export.

**Done when:** any vehicle in the sample footage can be searched by plate and produces an accurate
multi-camera route with real timestamps and images in under 5 seconds.

---

## PHASE 7 — Submission artefacts

- `docs/HLD.md` — architecture diagram, components, data flow, integration strategy (Model 1 base
  plus our hybrid additions), API contracts, ERD, deployment topology
- `docs/SECURITY.md` — encryption in transit/at rest, RBAC, credential vaulting, audit log
  (`SystemLog` already exists), network segmentation, CCTV-specific threats, IT Act / DPDP notes
- `docs/SCALE-80K.md` — 80,000-camera sizing: edge vs central inference, streams per GPU, GPUs per
  district, bandwidth, storage tiers and retention, bus throughput, DR, phased rollout
- `docs/COST-BENEFIT.md` — CAPEX/OPEX, per-camera cost, vs commercial VMS
- `README-SENTINEL.md` — one-command demo setup
- `docs/DEMO-SCRIPT.md` — the five-minute run-through

---

## CODING RULES

- Branch `feat/sentinel-cctv`; commit after every phase; never commit `.env`, `node_modules/`,
  model weights, snapshots or video files.
- TypeScript strict. Backend is ESM (`"type": "module"`) — keep the `.js` extension on relative
  imports, exactly as the existing code does.
- Follow the existing `routes/ → controllers/ → services/` pattern.
- Match the existing Tailwind dark theme; new pages must look like the same product.
- Every new env var goes into `.env.example` with a comment.
- Nothing hardcoded that a judge might ask you to change live — camera count, thresholds, URLs.
- Every failure state must be visible and honest: dead stream, unreadable plate, empty watchlist,
  no dispatch units. An empty state is a feature; a fabricated value is a defect.
- After each phase, run both servers, click through **both** the original event journey and the new
  surveillance journey, run `npm run verify`, and report exactly what you verified by hand.

## DO NOT

- Do not remove or restyle the existing event-safety features, pages or APIs — only re-source
  their data.
- Do not run `prisma migrate reset` or any destructive migration; new columns are nullable or
  defaulted.
- Do not replace one mock with another, or leave a "temporary" placeholder value.
- Do not change existing API response shapes; other pages depend on them.
- Do not introduce a second auth system.
- Do not leave a single New York coordinate in the codebase.

---

## THE FIVE MINUTES THAT GET SCORED

Build backwards from this and you will not waste a day:

1. Map loads with 55 real cameras across 5 departments, coloured by live health *(Model 1)*
2. Live wall: 50 feeds playing at once *(integration)*
3. Judge names a vehicle in the footage → we add its plate to the watchlist live *(watchlist)*
4. Alert fires in the console within seconds, real snapshot, real camera *(real-time alerting)*
5. Click through to the map: the vehicle's full cross-camera route with timeline *(test case)*
6. Search the history, export the PDF trail *(searchable events)*
7. Switch to crowd view: **real** live person counts per zone, and a genuine surge alert
   *(bonus analytics — and the Rath Yatra / Navratri story)*
8. One slide: how this scales to 80,000 cameras *(scalability)*

Every number on screen during those five minutes must survive the question
**"where did that come from?"**

---

**Start with Phase 0 now. Produce `docs/AUDIT.md` and `scripts/check-no-mocks.sh`, then stop and
wait for my go-ahead.**
