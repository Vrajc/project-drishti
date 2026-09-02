# Drishti — Phase 0 Truth Audit

**Date:** 2026-08-31
**Scope:** every file in `backend/src/`, `backend/prisma/`, `frontend/src/`, plus `docker-compose.yml`,
all three `package.json` files, `.env.example`, `prisma.config.ts`.
**Method:** static read of every listed file, plus live checks against the running Postgres
(row counts, sample rows, and rolled-back `INSERT` probes to reproduce suspected constraint failures).
**Changes made:** Phase 0 itself changed no application code — only this document and
`scripts/check-no-mocks.sh`. Sections 1–6 describe the codebase **as found**. Phase 0.5 then closed
the three blockers §5 puts ahead of Phase 1; what changed, and what is deliberately still open, is
recorded in §7. Where a finding has since been fixed, §7 says so rather than §4 being rewritten —
the record of what was wrong is worth keeping.

---

## 0. Executive summary — the three things that matter

1. **The crowd-analysis feature has never written a single row.** `crowd_densities` contains
   **0 rows** despite 16 videos sitting in `backend/uploads/videos/`. Both mock generators violate a
   foreign key and die inside a fire-and-forget `.catch()`, so the UI reports
   *"Video uploaded successfully"* and nothing ever arrives. Reproduced below with error codes.
   The feature is not merely fake — it is fake **and** non-functional.

2. **Incident reporting is broken the same way.** `incidents` contains **0 rows**.
   `Incident.reporter` is a foreign key to `users.id`, but `LiveMonitoring.tsx:232` sends the user's
   *display name*. Every report 500s. Because incidents feed anomaly, dispatch, organizer and admin
   metrics, the entire operations half of the product sits downstream of a broken write.

3. **The one piece of real incident data that could exist is poisoned on purpose.**
   `EmergencyDispatch.tsx:275-287` starts a `setTimeout` for a *random* 2–12 seconds and then writes
   `status: 'resolved'` to the real `Incident` row. Prisma computes `responseTime` from that
   (`incident.controller.ts:118`). `OrganizerDashboard` and `AdminDashboard` then read that column and
   present it as a measured response time. This is the most dangerous defect in the repo: it launders
   a fabricated number into the database, where every later "traced to a DB read" claim inherits it.

**Verdict on the inventory supplied in the build prompt:** all 11 rows confirmed, 3 with corrected
line ranges, and **14 further findings** added — including the three above, none of which were listed.

---

## 1. Every existing API endpoint

Base URL: `http://localhost:${PORT}/api` (backend `PORT` defaults to **5000** in `server.ts:20`;
`backend/.env.example` sets **5001**, which is what every frontend service assumes. With no `.env`
present the two halves cannot talk. Frontend override: `VITE_API_URL`.)

Auth header: `Authorization: Bearer <jwt>`. Token payload is `{ userId, role }`
(`auth.controller.ts:94,157`).

### `/api/auth` — `auth.routes.ts`

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/register` | — | `{ name, email, password, role? }` | `201 { message, token, user: { id, name, email, role } }` |
| POST | `/login` | — | `{ email, password, role? }` | `200 { message, token, user: {...} }` |
| GET | `/profile` | JWT | — | `200 { user: { id, name, email, role, organization, phone } }` |
| POST | `/logout` | JWT | — | `200 { message }` (no server state; client discards token) |

Validation: email **must** end `@gmail.com`; password >= 8 chars with upper, digit, special.

### `/api/events` — `event.routes.ts`

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/` | — | — | `200 { success, data: Event[] }` |
| GET | `/organizer/:organizerEmail` | — | — | `200 { success, data: Event[] }` |
| GET | `/:id` | — | — | `200 { success, data: Event }` / `404` |
| POST | `/` | JWT + `organizer\|admin` | `{ name, type, date, time, crowdSize, location, description?, mapFileBase64?, image?, organizerId, organizerEmail, organizerName, zones[], cameras[], dispatchUnits[] }` | `201 { success, message, data: Event }` |
| PUT | `/:id` | JWT + `organizer\|admin` | partial of above; `zones`/`cameras`/`dispatchUnits` **replace** (deleteMany + create) | `200 { success, message, data: Event }` |
| DELETE | `/:id` | JWT + `organizer\|admin` | — | `200 { success, message }` |
| POST | `/:id/register` | JWT | `{ userId }` | `200 { success, message, data: Event }` |

`Event` shape (`formatEvent`, `event.controller.ts:12`): all scalar columns plus `_id` (alias of `id`),
`zones: Zone[]`, `cameras: Camera[]`, `dispatchUnits: DispatchUnit[]`, `registeredUsers: string[]`.

### `/api/incidents` — `incident.routes.ts`

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/` | JWT | `{ eventId, type, description, location, reporter, reporterEmail? }` — *as found; since Phase 0.5 the body is `{ eventId, type, description, location }` and `reporter`/`reporterEmail` come from the token* | `201 { success, message, data: Incident }` |
| GET | `/event/:eventId` | JWT | `?status=` | `200 { success, data: Incident[] }` |
| PUT | `/:id/status` | JWT | `{ status: 'open'\|'investigating'\|'resolved' }` | `200 { success, message, data: Incident }` |
| GET | `/` | JWT | — | `200 { success, data: Incident[] }` |
| DELETE | `/:id` | JWT | — | `200 { success, message }` |

`Incident` is returned with `_id`, and `type`/`status` lower-cased. Since Phase 0.5 it also carries
`reporterName` (joined display name, or `null`); `reporter` remains the `users.id` foreign key.

### `/api/crowd-analysis` — `crowdAnalysis.routes.ts` (whole router is `authenticate`d)

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/process` | multipart: `video` file + `{ eventId, cameraId?, cameraName?, sampleInterval? }` | `202 { success, message, data: { filename, eventId, estimatedTime } }` |
| GET | `/:eventId/density` | `?zoneId&startTime&endTime` | `200 { success, data: CrowdDensity[], count }` |
| GET | `/:eventId/latest` | — | `200 { success, data: CrowdDensity[] }` (latest per zone) |
| GET | `/:eventId/zones/:zoneId/statistics` | `?startTime&endTime` | `200 { success, data: { _id, zoneName, avg/max/minPeopleCount, avg/max/minDensity, dataPoints } }` / `404` |
| GET | `/:eventId/heatmap` | `?startTime&endTime` | `200 { success, data: [{ _id: { zoneId, hour }, zoneName, avgDensity, avgPeopleCount }] }` |
| GET | `/:eventId/zones` | — | `200 { success, data: { zones: Zone[], eventName } }` |
| POST | `/:eventId/generate-mock` | — | `200 { success, message, data: { recordCount, zones } }` |

### `/api/ai` — `ai.routes.ts` — **authentication is commented out (`ai.routes.ts:13-15`); every route is public**

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/chat` | `{ messages: ChatMessage[], context?, eventId?, liveData? }` | `{ success, message, timestamp, contextUsed }` |
| POST | `/safety-planning` | `{ name, type, expectedAttendance, venue, duration?, zones? }` | `{ success, analysis, timestamp }` |
| POST | `/analyze-incident` | `{ type, location, description, context? }` | `{ success, analysis, timestamp }` |
| POST | `/crowd-flow` | `{ currentLevel, timeOfDay?, eventPhase?, zones? }` | `{ success, predictions, timestamp }` |
| POST | `/generate-report` | `{ name, date, attendance, incidents, safetyScore, responseTime, zones }` | `{ success, report, timestamp }` |
| POST | `/analyze-monitoring` | `{ activeIncidents, crowdLevel, safetyStatus, recentIncidents }` | `{ success, analysis, timestamp }` |
| POST | `/query` | `{ query, eventContext? }` | `{ success, response, timestamp }` |

Backed by Gemini `gemini-2.5-flash` via `utils/openai.service.ts`. These are genuinely wired.

### `/api/users` — `user.routes.ts` — **all four handlers are stubs**

`GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` each return `{ message: "... - to be implemented" }`.
No route reads the database. This is where Phase 4.5's `GET /api/users/stats` belongs.

### `/api/monitoring` — `monitoring.routes.ts` — **all four handlers are stubs**

`GET /events/:id/live`, `GET /events/:id/crowd-flow`, `GET /events/:id/anomalies`,
`POST /events/:id/emergency` all return `"to be implemented"`. **No frontend page calls this router.**

### `GET /health`

`server.ts:60` returns `{ status: 'OK', message: 'Server is running' }`. Does not probe Postgres or Gemini.

### Endpoints the frontend calls that do not exist

| Caller | Called path | Reality |
|---|---|---|
| `crowdAnalysis.service.ts:199` `expandZonesToFullFrame()` | `POST /api/zones/:eventId/expand-zones` | No `/api/zones` router is mounted, so this would 404. The method is never invoked by any page — dead code on both ends. |

**No WebSocket, no Socket.IO, no SSE anywhere.** Every "live" view in the product is a `setInterval`
poll: 3s for incidents, 5s for density and admin, 15s for anomaly, 30s for crowd flow.

---

## 2. Page-by-page: real vs fabricated vs dead

Legend — **Real**: traced to a DB read. **Fabricated**: invented in the client or by a mock
generator. **Dead**: UI wired to nothing, or a control with no handler.

| Page | Real | Fabricated | Dead UI |
|---|---|---|---|
| `Landing.tsx` | Nothing — it is marketing copy | `99.8%` Detection Rate, `15-20min` Early Warning, `<30sec` Response Time (`:186-189`) — unmeasured performance claims, and the first thing a judge sees | — |
| `Login.tsx` / `Register.tsx` | Full auth round-trip against `/api/auth`; JWT + user persisted to `localStorage` | — | — |
| `ParticipantDashboard.tsx` | Registered-event list, from `EventContext` → `GET /api/events` | — | — |
| `MyEvents.tsx` | Registered-event list, real | Stock Pexels URL as image fallback (`:170`) — cosmetic, not a data claim | — |
| `EventExplore.tsx` | Event list, `registeredUsers.length`, capacity % (`:110`) all real | Same Pexels fallback (`:122`) | — |
| `EventSetup.tsx` | Writes real `Event` + `Zone`/`Camera`/`DispatchUnit` rows via `POST /api/events` | — | The zone input captures a **name only** — no polygon, no capacity. Every zone lands with `coordinates: []`, `maxCapacity: 100` (verified in DB). There is no UI anywhere to draw a zone. |
| `OrganizerDashboard.tsx` | **The one honest page.** Active incidents and average response time aggregated from `GET /api/incidents/event/:id`, rendering `N/A` when there is no data (`:299`) | Inherits the poisoned `responseTime` — see §4.3 | — |
| `LiveMonitoring.tsx` | Incident list (3s poll); `crowdLevel`/`crowdDensity` from `/latest` — though that endpoint has no rows to return | `safetyStatus: 'OPTIMAL'` hardcoded (`:122`); `responseTime: 3.2` hardcoded (`:126`); `safetyScore = 100 − open×5`, an invented formula (`:129`); zone fallback `['Main Area']` (`:140`); **Zone Status randomises status and crowd % on every render** (`:792-793`); venue-map fallback labels `Main Stage / VIP Area / Food Court / Exits` (`:707-710`) | "Contact Security" (`:768`) and "Event Info" (`:776`) have no `onClick`. The Lost & Found photo is read into `lostFoundImage` and never sent anywhere. Camera **count** is shown but no camera feed is ever rendered. |
| `CrowdFlowAnalysis.tsx` | Read path is correct — `/latest`, `/density`, `/zones/:id/statistics` are genuine queries | Upload hardcodes `cameraId: 'camera-1'`, `cameraName: 'Main Camera'` (`:93-94`) — itself the FK violation in §4.1 | The whole page renders empty forever: the write path can never produce a row |
| `AnomalyDetection.tsx` | Camera **count** only | Everything else. `generateMockAlert()` (`:49-120`) invents type, location, description; confidence is `Math.random()*25+75` when the AI call fails (`:117`); a 15s timer fires an alert on a 30% coin flip (`:140`); camera tiles draw an "Anomaly Detected" box when `Math.random() > 0.7` (`:423`) | Camera tiles are a static CSS gradient with an `Eye` icon — no `<video>` element exists. The "live" pulse dot (`:419`) is always on. Alerts are never persisted; a refresh loses them. |
| `EmergencyDispatch.tsx` | Emergencies derived from real incidents via `GET /api/incidents/event/:id` | `coordinates` fabricated at **New York** 40.7128/-74.0060 (`:137`, `:187-188`); `generateMockResponders()` invents 8 units (`:178-192`); "optimal routing" picks a **random** responder with `Math.random()` ETA and distance (`:236-238`); real dispatch units get `{ lat: 0, lng: 0 }` (`:213`) | The "Live Dispatch Map" is decorative: markers are placed by array-index CSS classes (`:540-544`, `:560-566`) and route lines are hardcoded percentages (`:577-580`). The New York coordinates are never even read. |
| `AISummaries.tsx` | Gemini chat is a real API call | The assistant opens by claiming it can report "crowd density, recent alerts, zone-specific information" (`:23`) while being handed **only counts** as context (`:111`). It is invited to confabulate live numbers. Quick questions interpolate zone objects into strings (`:45,47`) → `[object Object]` | — |
| `PostEventReports.tsx` | Event name, date, `registeredUsers.length` | `duration: '8 hours'` hardcoded (`:24`); `incidents: 0`, `responseTime: 0`, `safetyScore: 0` are placeholders fed straight into the Gemini report prompt (`:27-29`, `:123-132`), so the generated narrative is authored from zeros | `incidentTableData: any[] = []` (`:33`) is a permanent empty array — the incident table can never populate. Every section's metrics are literal `0` / `'N/A'` constants (`:50-110`). The page never queries incidents or crowd density. |
| `PreSafetyPlanning.tsx` | Feeds the AI real `name`, `type`, `crowdSize`, `location` | Zone fallback `['Main Area','Food Court','VIP Section']` (`:32`); `duration: 'Full Day'` hardcoded (`:31`) | — |
| `AdminDashboard.tsx` | Event counts and statuses; incident open/investigating/resolved counts; `avgResponseTime` — all real reads | `mockParticipants = 2103`, `mockAdmins = 16`, `mockAvgSafetyScore = 94.5` (`:104-106`); `totalUsers` derived from those (`:107`); `systemHealth: events.length > 0 ? 98 : 100` (`:124`); per-event `safetyScore: 0` shown against a colour scale (`:139`). **All of it is also written into an exported PDF (`:212-217`)** — the fabrication leaves the app as a document | Delete Event calls `EventContext.deleteEvent`, which only edits `localStorage` — **the row is never deleted from Postgres** and returns on refresh. |

---

## 3. Every `Math.random()`, hardcoded array and mock generator

### 3.1 `Math.random()` — complete list (33 occurrences)

**Legitimate — animation (6):** `frontend/src/components/ParticleHero.tsx:45,46,47,48,49,50`.

**Legitimate — ID generation (3):** `EventSetup.tsx:129` (camera id), `EventSetup.tsx:144` (unit id),
`crowdAnalysis.controller.ts:24` (multer filename suffix).

**Fabricated data — must all be removed (24):**

| File:line | What it invents |
|---|---|
| `AnomalyDetection.tsx:83` | alert type |
| `AnomalyDetection.tsx:84` | alert location |
| `AnomalyDetection.tsx:85` | alert description |
| `AnomalyDetection.tsx:97` | alert id (inside a fabricated alert) |
| `AnomalyDetection.tsx:110` | alert id (fallback path) |
| `AnomalyDetection.tsx:112` | severity |
| `AnomalyDetection.tsx:117` | **confidence, 75–100%** |
| `AnomalyDetection.tsx:140` | whether an alert fires at all (30% coin flip) |
| `AnomalyDetection.tsx:423` | whether a detection box is drawn on a camera tile |
| `EmergencyDispatch.tsx:137` | emergency lat/lng jitter around New York |
| `EmergencyDispatch.tsx:184` | responder type |
| `EmergencyDispatch.tsx:187` | responder lat (New York) |
| `EmergencyDispatch.tsx:188` | responder lng (New York) |
| `EmergencyDispatch.tsx:190` | responder busy/available |
| `EmergencyDispatch.tsx:236` | **which responder is "optimal"** |
| `EmergencyDispatch.tsx:237` | **ETA, 2–12 min** |
| `EmergencyDispatch.tsx:238` | **route distance, 1–6 km** |
| `LiveMonitoring.tsx:792` | zone status |
| `LiveMonitoring.tsx:793` | zone crowd % |
| `crowdAnalysis.service.ts:334` | people-count base |
| `crowdAnalysis.service.ts:335` | people-count variation |
| `crowdAnalysis.service.ts:351` | **detection confidence** |
| `crowdAnalysis.service.ts:352` | **processing time** |
| `mockCrowdData.ts:20` | people count, 20–70 per zone |

### 3.2 Mock generators

| Location | Note |
|---|---|
| `backend/src/services/crowdAnalysis.service.ts:294-374` `generateAndSaveMockCrowdData()` | *(prompt said 292-370)* 24 frames × N zones. Also falls back to invented zones `main stage / food court / vip area` (`:308-312`) when the event has none. |
| `backend/src/utils/mockCrowdData.ts` (whole file) | Second, independent generator. |
| `backend/src/controllers/crowdAnalysis.controller.ts:278-318` `generateMockData` | Exposed as a live route, `POST /:eventId/generate-mock`. |
| `frontend/src/pages/AnomalyDetection.tsx:49-120` `generateMockAlert()` | *(prompt said 49-160; the generator ends at 120, its timer runs 135-147)* |
| `frontend/src/pages/EmergencyDispatch.tsx:178-192` `generateMockResponders()` | *(prompt said 178-190)* |

### 3.3 Hardcoded arrays and constants presented as data

| File:line | Value |
|---|---|
| `AnomalyDetection.tsx:51-76` | 16 canned alert descriptions |
| `AnomalyDetection.tsx:81` | location fallback `['Main Stage','Food Court','VIP Area','Entrance Gate','Parking Lot','Emergency Exit 3']` |
| `EmergencyDispatch.tsx:180` | `['Station 1','Station 2','Mobile Unit A','Mobile Unit B','Patrol 1','Patrol 2']` |
| `EmergencyDispatch.tsx:213` | real units pinned to `{ lat: 0, lng: 0 }` |
| `LiveMonitoring.tsx:122` | `safetyStatus: 'OPTIMAL'` |
| `LiveMonitoring.tsx:126` | `responseTime: 3.2` |
| `LiveMonitoring.tsx:140` | zone fallback `['Main Area']` |
| `LiveMonitoring.tsx:707-710` | map labels `Main Stage / VIP Area / Food Court / Exits` |
| `PreSafetyPlanning.tsx:31,32` | `'Full Day'`; `['Main Area','Food Court','VIP Section']` |
| `AdminDashboard.tsx:104,105,106,124` | `2103`, `16`, `94.5`, `98` |
| `PostEventReports.tsx:24,27-29,33,50-110` | `'8 hours'`; zeroed metrics; empty incident table; per-section constants |
| `CrowdFlowAnalysis.tsx:93,94` | `'camera-1'`, `'Main Camera'` |
| `crowdAnalysis.service.ts:308-312` | fallback zones |
| `crowd_analyzer.py:330,331` | `confidence: 0.85`, `processingTime: 0` — **even the genuine OpenCV path emits a constant confidence** |
| `Landing.tsx:186-189` | `99.8%`, `15-20min`, `<30sec` |

### 3.4 Verdict on the supplied inventory

| # | Status |
|---|---|
| 1 | **Confirmed**, range corrected to `crowdAnalysis.controller.ts:81-92`. Worse than described: the call is fire-and-forget and always fails (§4.1). |
| 2 | **Confirmed**, range corrected to `:294-374`. |
| 3 | **Confirmed.** |
| 4 | **Confirmed** — `crowd_analyzer.py` is unreachable; `processAndSaveVideo()`, its only caller, is itself never called. Note it also emits a hardcoded confidence, and its `auto_scale_zones` heuristics exist only because zones arrive with empty coordinates. |
| 5 | **Confirmed**, generator is `:49-120`. |
| 6 | **Confirmed**, `:137` and `:178-192`. Add `:213` (`lat:0,lng:0`). |
| 7 | **Confirmed**, `:230-238`. Add the auto-resolve timer at `:275-287` (§4.3). |
| 8 | **Confirmed.** Add `systemHealth` (`:124`) and the PDF export (`:212-217`). |
| 9 | **Confirmed.** Add: it is not memoised, so it re-randomises on every render. |
| 10 | **Confirmed** — the comment at `:22-25` is accurate and the fallback at `:32` survives. |
| 11 | **Assessed** — see §2. `OrganizerDashboard` is genuinely real. `AISummaries` is real-but-uninformed. `PostEventReports` is dead. `MyEvents`/`EventExplore`/`ParticipantDashboard` are real. `AdminDashboard` is mixed. |

---

## 4. Broken — things that currently throw or silently fail

Live database state at audit time (`users` 10, `events` 3, `zones` 5, `cameras` 4,
`dispatch_units` 4):

```
event_registrations : 0
incidents           : 0
crowd_densities     : 0        <- with 16 uploaded videos on disk
ai_summaries        : 0
system_logs         : 0
notifications       : 0
```

### 4.1 CRITICAL — every crowd-density write violates a foreign key

`crowd_densities.zoneId` references `zones.id` (UUID) and `crowd_densities.cameraId` references
`cameras.id` (UUID) — `migration.sql:319,322`. Both generators write the *custom* identifiers instead.

Reproduced against the live database inside rolled-back transactions:

```
A. generateAndSaveMockCrowdData shape (zoneId="zone-0", cameraId="camera-1")
   -> P2003  crowd_densities_zoneId_fkey
B. utils/mockCrowdData shape          (zoneId=<uuid>,  cameraId="camera-1")
   -> P2003  crowd_densities_cameraId_fkey
C. control                            (zoneId=<uuid>,  cameraId=null)
   -> INSERT SUCCEEDED
```

- `crowdAnalysis.service.ts:319` maps `id: zone.zoneId || zone.id` — it prefers the wrong one, so path A.
- `mockCrowdData.ts:28` uses `zone.id` correctly but pins `cameraId: 'camera-1'` (`:34`), so path B.
- `CrowdFlowAnalysis.tsx:93` sends the same bogus `'camera-1'` from the UI.

`crowdAnalysis.controller.ts:82-92` calls the generator **without awaiting it** and swallows the
rejection into `console.error`. The client has already been sent `202 "Video uploaded successfully"`.
That is why 16 uploads produced 0 rows and no error was ever surfaced to anyone.

The genuine path is broken identically: `processAndSaveVideo` builds zones with `id: zone.zoneId`
(`:125`), and `crowd_analyzer.py` echoes that into `record['zoneId']` (`:322`).
**Fixing the analyzer alone will not make this work** — the identity contract must be fixed first.

### 4.2 CRITICAL — every incident creation violates a foreign key

`incidents.reporter` references `users.id` `ON DELETE RESTRICT` (`migration.sql:313`).
`LiveMonitoring.tsx:232` sends `reporter: user?.name || 'Anonymous'`.

```
createIncident with reporter="Test User"
   -> P2003  incidents_reporter_fkey
```

The handler returns 500 and the page alerts *"Failed to submit incident."* `incidents` is empty.
Because `EmergencyDispatch`, `LiveMonitoring`, `OrganizerDashboard` and `AdminDashboard` all read
this table, the fix is a prerequisite for four pages.

### 4.3 CRITICAL — a fake timer writes fabricated resolutions into the real database

`EmergencyDispatch.tsx:230-287`:

1. `estimatedTime = Math.floor(Math.random()*10)+2` (`:237`)
2. immediately `PUT /api/incidents/:id/status { status: 'investigating' }` (`:242`)
3. `setTimeout(..., estimatedTime * 1000)` then `PUT { status: 'resolved' }` (`:275-287`)

`incident.controller.ts:116-120` then computes `responseTime = (now − incident.timestamp) / 1000`
and persists it.

Nobody was dispatched. Nothing was resolved. The number is a random countdown, and it is now a
column in Postgres that `OrganizerDashboard.tsx:80-85` and `AdminDashboard.tsx:94-97` read back and
present as a measured average. **This must be removed before any response-time metric can be called
real** — otherwise Phase 4 will "trace to a DB read" a value that was invented in the browser.

### 4.4 Zones have no geometry, so no detector can ever count anyone

Every `Zone` row in the database has `coordinates: []` and `maxCapacity: 100`:

```json
{ "id": "28b4ea7f-...", "zoneId": "zone-0", "name": "xd", "coordinates": [], "maxCapacity": 100 }
```

`EventSetup.tsx:114-122` collects a zone **name string** and nothing else; `event.controller.ts:67-68`
defaults `coordinates` to `[]` and `maxCapacity` to `100`. `crowd_analyzer.py:104-122`
(`point_in_zone`) ray-casts against that empty polygon and returns `false` for every point — so a
correct detector wired to the current data would report **0 people in every zone, forever**.

This is a blocker for Phases 3 and 4.1 that is not on the supplied inventory, and it needs a UI
change (zone drawing) rather than a data-source change.

### 4.5 `EventContext` fabricates success when the API fails

- `EventContext.tsx:190-204` — if `POST /:id/register` throws, the `catch` **still** adds the user to
  `registeredUsers` and writes it to `localStorage`. The UI shows "Registered"; the server disagrees.
  This is precisely the failure mode the no-fake-data rule exists to prevent, and it survives page
  reloads until `refreshEvents()` overwrites it.
- `EventContext.tsx:151-160` — `deleteEvent` never calls `DELETE /api/events/:id`. The
  `AdminDashboard` delete button therefore only hides the row locally.

### 4.6 The `zones` type is a lie, and it will crash pages at runtime

`EventContext.Event.zones` is declared `string[]` (`:30`), and `EventSetup` does put strings there
after a create (`:96-101`). But `refreshEvents()` (`:112`) assigns whatever the API returns — an
array of **`Zone` objects**. After any page reload the two disagree, and:

- `LiveMonitoring.tsx:702` renders `{zone}` -> *"Objects are not valid as a React child"*
- `AdminDashboard.tsx:841` renders `{zone}` -> same
- `PreSafetyPlanning.tsx:243` renders zones the same way
- `AISummaries.tsx:45,47` interpolates them into strings -> `[object Object]`
- `LiveMonitoring.tsx:694` and `:796` use the object as a React `key`

`tsc --noEmit` passes in both packages because the API response is typed `any`, so this is invisible
to the build and appears only at runtime — worst case, mid-demo, on a page refresh.

### 4.7 Auth is inconsistent and partly absent

- `auth.middleware.ts:4-9` types `req.user` as `{ id, email, role }`, but the token carries
  `{ userId, role }` (`auth.controller.ts:94`). `req.user.id` and `req.user.email` are always
  `undefined`. Only `role` works, which is why `authorize()` still functions.
- `POST /api/events/:id/register` takes `userId` **from the request body** (`event.controller.ts:287`),
  not from the token — any authenticated user can register any other user.
- `GET /api/incidents` and `DELETE /api/incidents/:id` are documented "admin only" in
  `incident.routes.ts:19,22` but carry only `authenticate` — any logged-in user can list or delete
  every incident in the system.
- `/api/ai/*` has authentication commented out (`ai.routes.ts:13-15`) — all seven Gemini routes are
  public and unmetered.
- `ai.service.ts:14` reads `localStorage.getItem('token')`, but `AuthContext` stores the JWT under
  `'drishti_token'` — the AI client's auth interceptor has never attached a token.
- `App.tsx` has **no route guards**. `/admin-dashboard` and every organizer page render for anyone
  who types the URL, logged in or not.

### 4.8 Smaller breakages

| Where | Problem |
|---|---|
| `crowdAnalysis.service.ts:127-132` | Substitutes a default `100x100` square when `coordinates` is empty — hides §4.4 rather than reporting it. |
| `crowdAnalysis.service.ts:70` | Shells out via `exec` with the video path interpolated into a command string. Unreachable today, but it is a command-injection shape that must not be revived as-is. |
| Frontend `CrowdDensityData` (`crowdAnalysis.service.ts:5-23`) | Declares `_id` and a nested `metadata` object; the API returns `id` and **flat** `frameNumber`/`confidence`/`processingTime`. Both are permanently `undefined` on the client. |
| `prisma/seed.ts` | Seeds `organizer@drishti.local` / `participant@drishti.local`, but login rejects any address that is not `@gmail.com` (`auth.controller.ts:22`) — **the seeded users can never log in.** Only `seedTestUser`'s `test@gmail.com` works. |
| `openai.service.ts:627-652` | `listModels()` prints `Status: Fully Operational` at boot without ever calling the API — a fabricated health claim in the operator's console. |
| `server.ts:20` vs `backend/.env.example` | Port defaults disagree (5000 vs 5001); every frontend service hardcodes 5001 as its fallback. |
| `docker-compose.yml` | Maps Postgres to host **5434** by default; `.env.example` builds `DATABASE_URL` with **5432**. |
| `.vite/` at repo root | Stray build cache sitting in the working tree. |

### 4.9 What is genuinely healthy — protect it

- Auth register/login/profile, password hashing, JWT issuance.
- Event CRUD including nested zones/cameras/dispatch units.
- Incident read/update/delete — only *create* is broken.
- All crowd-analysis **read** endpoints and their aggregation logic (`getHeatmapData`,
  `getZoneStatistics`, `getLatestDensityByZone`) — correct queries with nothing to query.
- All seven Gemini endpoints.
- `frontend/src/utils/pdfGenerator.ts` — a clean, data-agnostic renderer; reuse it in Phase 6.
- `crowd_analyzer.py`'s `point_in_zone` ray-casting (`:104-122`) — port this to `ai-service/zones.py`.
- Redis is **already** in `docker-compose.yml` — Phase 3's bus needs a client library, not new infra.
- `tsc --noEmit` exits 0 in both packages.

---

## 5. Dependency order — what must be real before what else

Two of these precede Phase 1 in the supplied plan. They are cheap, and everything else sits on them.

```
  0a. Identity contract: CrowdDensity.zoneId/cameraId = UUIDs; Incident.reporter = User.id  (4.1, 4.2)
  0b. Delete the auto-resolve timer in EmergencyDispatch                                    (4.3)
  0c. EventContext stops faking success on failure                                          (4.5, 4.6)
        |   Nothing downstream can be trusted, or even persisted, until these three are done.
        v
   1. Camera registry + GIS         -> cameras become addressable UUIDs with lat/lng
        v
   2. Zone geometry (drawing UI)    -> polygons + honest maxCapacity   (4.4; blocks 4.1/4.3/4.6)
        v
   3. Live streams (MediaMTX)       -> a worker has a URL to open
        v
   4. ai-service detections         -> THE single source of counts, boxes, plates, confidence
        v
   +----------------+-------------------+--------------------+---------------------+
   v                v                   v                    v
 4.1 CrowdDensity  4.2 anomalyRules   4.3 LiveMonitoring   5. Watchlist + Alerts
   |                 | (needs 0a+0b)     |                    |
   v                 v                   v                    v
 CrowdFlowAnalysis AnomalyDetection    Zone Status          6. Cross-camera tracking
                     |                                         (needs 1 for lat/lng,
                     v                                          5 for persisted Detections)
                 4.4 EmergencyDispatch  (needs DispatchUnit lat/lng + OSRM)
                     |
                     v
                 4.7 PostEventReports   (aggregates incidents + density + response times — last)
```

**Independent of the pipeline — can start immediately, in parallel:**

- **4.5 Admin stats** — `GET /api/users/stats` over the `users` table. Needs nothing from the AI
  service. The one judgement call: `avgSafetyScore` has no definition today; either define it from
  incident counts, response times and density breaches, or delete the tile.
- **4.6 Pre-safety planning** — only needs real zones, i.e. step 2.
- **Auth hardening** (§4.7) — route guards, `req.user.id`, admin-only enforcement, re-enabling
  `/api/ai` auth. Do this before adding the `POLICE` role in Phase 1 rather than after.

**Ordering traps:**

- Do **not** wire `Detection`/`Alert` (Phase 5) before step 0a. The same UUID-vs-custom-id mistake
  will reproduce itself in three new tables.
- Do **not** compute any "real" response time or safety score before 0b. The source column is
  currently populated by a browser timer.
- Phase 6's spatio-temporal fallback ("probable" links) needs `Camera.latitude/longitude` from
  Phase 1 to compute the distance between two cameras — Phase 1 must land its coordinates, not just
  its rows.

---

## 6. Baseline for `scripts/check-no-mocks.sh`

The gate added in this phase currently **fails**, by design: it is the debt counter, and its hit
count is the number this project has to drive to zero.

```
npm run verify
  typecheck:backend    PASS   (tsc --noEmit, exit 0)
  typecheck:frontend   PASS   (tsc --noEmit, exit 0)
  check:no-mocks       FAIL   76 occurrences, 9 allowlisted     <- Phase 0 baseline
                              59 occurrences after Phase 0.5    <- see §7
```

Where the 76 sat at the Phase 0 baseline, and where they stand after Phase 0.5:

| File | Phase 0 | Now | Owner |
|---|---|---|---|
| `frontend/src/pages/AnomalyDetection.tsx` | 14 | 14 | Phase 4.2 |
| `frontend/src/pages/EmergencyDispatch.tsx` | 14 | **0** | done (§7) |
| `backend/src/controllers/crowdAnalysis.controller.ts` | 11 | 11 | Phase 4.1 |
| `backend/src/services/crowdAnalysis.service.ts` | 9 | 9 | Phase 4.1 |
| `frontend/src/pages/AdminDashboard.tsx` | 9 | 9 | Phase 4.5 |
| `backend/src/routes/monitoring.routes.ts` | 4 | 4 | stub router |
| `backend/src/routes/user.routes.ts` | 4 | 4 | Phase 4.5 |
| `backend/src/routes/crowdAnalysis.routes.ts` | 4 | 4 | Phase 4.1 |
| `backend/src/utils/mockCrowdData.ts` | 4 | 4 | Phase 4.1 |
| `frontend/src/pages/LiveMonitoring.tsx` | 2 | **0** | done (§7) |
| `frontend/src/pages/PreSafetyPlanning.tsx` | 1 | **0** | done (§7) |

The gate also flags `- to be implemented` stub responses, which is why the two dead routers appear.

Allowlisted today, each with its reason recorded in `scripts/no-mocks-allowlist.txt`: the six
particle-animation calls in `ParticleHero.tsx`, and three `Math.random()` calls used purely for
identifier generation (`EventSetup.tsx:129,144`, `crowdAnalysis.controller.ts:24`). Nothing else is
exempt, and **no exemption may be added to make a fabricated value pass** — delete the fabrication
instead.

Note that a passing gate is necessary but not sufficient. It cannot see §4.3 (a random ETA laundered
through the database into a "real" column), §4.4 (empty zone polygons), or `LiveMonitoring.tsx:122,126`
(`'OPTIMAL'` and `3.2` contain no banned token). Those are caught only by the page-by-page walk in §2.

---

## 7. Phase 0.5 — the three blockers, closed

§5 put three fixes ahead of the camera registry. They are done. Nothing below is a new feature:
each one deletes a fabrication or repairs a write that could never have succeeded.

### 0a. Identity contract

| Change | File |
|---|---|
| `AuthRequest.user` retyped to the payload the token actually carries (`{ userId, role }`) | `backend/src/middleware/auth.middleware.ts` |
| `getProfile` reads the typed `req.user.userId` instead of casting through `any` | `backend/src/controllers/auth.controller.ts` |
| `reporter` is derived from the verified JWT, never the request body; `reporterEmail` looked up from the user row; `reporterName` joined additively for display; `P2003` answered with 400 instead of 500 | `backend/src/controllers/incident.controller.ts` |
| Client no longer sends `reporter`; renders `reporterName` | `frontend/src/pages/LiveMonitoring.tsx`, `frontend/src/services/incident.service.ts` |
| `processAndSaveVideo` maps zones by `zone.id` (the UUID the FK wants), not `zone.zoneId` | `backend/src/services/crowdAnalysis.service.ts` |
| Camera identifiers resolved against the `Camera` table (UUID *or* event-scoped `cameraId`); an unregistered camera is refused rather than written as a dangling FK | `backend/src/services/crowdAnalysis.service.ts` |
| Zones with fewer than 3 coordinates now fail loudly instead of being silently replaced with a full-frame rectangle (§4.4 would otherwise produce a confident zero) | `backend/src/services/crowdAnalysis.service.ts` |
| Upload no longer sends the invented `'camera-1'` / `'Main Camera'` | `frontend/src/pages/CrowdFlowAnalysis.tsx` |

Verified against the running API:

```
POST /api/incidents (authenticated)      -> 201, reporter = 3f8b9afe-… , reporterName = "Test User"
POST /api/incidents (no token)           -> 401
POST /api/incidents with body reporter   -> 201, body value ignored, token identity stored
POST /api/incidents with unknown eventId -> 400 "references an event that does not exist"

camera resolve("hyaedj9fy")              -> 8d4ef6ac-…  (FK-valid)
camera resolve("<uuid>")                 -> 8d4ef6ac-…  (FK-valid)
camera resolve("camera-1")               -> refused, no bogus FK written
zones with coordinates: []               -> "Cannot analyse footage: 2 of 2 zone(s) have no
                                            boundary defined (xd, fghfgh)."
```

Test rows were removed afterwards; `incidents` and `crowd_densities` are back to 0.

### 0b. The laundered ETA

`EmergencyDispatch.tsx` no longer contains a single fabricated value:

- the `setTimeout` that wrote `status:'resolved'` to Postgres after a random 2–12 seconds is **gone**.
  Resolution is now recorded only when a human marks an incident resolved, so
  `Incident.responseTime` finally means what the dashboards claim it means.
- random "closest responder", random ETA and random route distance: removed. Dispatch assigns the
  first available unit and displays *"ETA unavailable"* until real coordinates and a routing service
  exist (Phase 4.4).
- `generateMockResponders()` deleted; responders come from `DispatchUnit` rows only, and an event
  with none shows the empty state that was already written but unreachable behind the mock fallback.
- every New York coordinate is gone from the codebase, along with the `{ lat: 0, lng: 0 }` pins.
- the "Live Dispatch Map" no longer places markers by array index or draws routes at fixed
  percentages; it reports the dispatch counts it actually knows and says positions are not plotted.
- a failed dispatch is shown on screen instead of being logged while the card moved to "dispatched".

### 0c. `EventContext` stops reporting success the server did not give

- `registerForEvent` no longer swallows the failure and marks the user registered anyway; the error
  propagates and `EventExplore` renders it.
- `deleteEvent` now calls `DELETE /api/events/:id`; `AdminDashboard` surfaces a failure instead of
  closing the dialog as though the row were gone.
- **§4.6 closed**: `Event.zones` is typed `Zone[]`, and `normaliseZones()` coerces both shapes at the
  single point where events enter the context. The five latent *"Objects are not valid as a React
  child"* crashes surfaced as compile errors the moment the type was corrected, and all five are
  fixed (`LiveMonitoring`, `AdminDashboard`, `PreSafetyPlanning`, `PostEventReports`, `EventSetup`).

### Carried slightly beyond the three blockers

These sat on lines being edited anyway, and leaving a fabrication in place while rewriting its
neighbours was not defensible:

- **Zone Status panel** (`LiveMonitoring`) — was `Math.random()` re-rolled on *every render*. Now
  reads the `CrowdDensity` poll already running on the page, with *"Awaiting first reading"* per zone
  that has none. This is Phase 4.3's zone panel, brought forward; it will show real numbers as soon
  as Phase 3 produces detections.
- `safetyStatus: 'OPTIMAL'` → derived from open incident count.
- `responseTime: 3.2` → mean over genuinely resolved incidents, `N/A` when there are none.
- `safetyScore` (`100 − open×5`, undefined) → tile replaced with *Incidents Resolved* `n/total`.
  Defining a real safety score remains a Phase 4.5 decision.
- Zone fallbacks `['Main Area']` and `['Main Area','Food Court','VIP Section']` removed;
  `PreSafetyPlanning` now refuses to analyse an event with no zones and tells the organizer to
  define them (Phase 4.6's requirement).

### Still open, by design

`npm run verify` still fails on 59 occurrences. Every one belongs to a later phase:
`AnomalyDetection` (14, Phase 4.2), the crowd-analysis mock generators and their route
(28, Phase 4.1 deletes them), `AdminDashboard`'s invented user statistics (9, Phase 4.5),
and the two stub routers (8). None of them was made *worse* here, and in particular **the mock
generators were deliberately left broken rather than repaired** — a working mock that writes
plausible fake rows into Postgres would be far more dangerous than one that fails.

Build state after Phase 0.5: `npm run build` exits 0, both `tsc --noEmit` runs exit 0.

---

## 8. Phase 1 — camera registry and GIS foundation

Model 1 of the challenge brief: a standalone camera registry that exists independently of any
event, with real coordinates, a map, and departments that own the estate.

### Schema (migration `20260901172409_add_camera_registry`)

Additive only. No column was dropped, no table recreated, no data touched. The single
non-additive statement is `ALTER COLUMN "eventId" DROP NOT NULL`, which only widens what the
column accepts. All 4 pre-existing cameras, 3 events, 5 zones and 10 users survived unchanged.

| Change | Detail |
|---|---|
| `Camera.eventId` | now nullable — a registry camera belongs to no event |
| `Camera` + 17 columns | `latitude`, `longitude`, `coverageAngle`, `coverageRadius`, `isPtz`, `vendor`, `model`, `protocol`, `onvifUrl`, `username`, `passwordEnc`, `resolution`, `fps`, `status`, `lastSeenAt`, `departmentId`, `siteId` — every one nullable or defaulted |
| `enum CameraStatus` | `ONLINE OFFLINE DEGRADED UNKNOWN`, default `UNKNOWN` |
| `enum UserRole` | `+ POLICE` |
| `Department` | code (unique), name, contact fields |
| `Site` | code (unique), address, coordinates, optional department |
| `CameraHealth` | one row per probe: status, `latencyMs`, `fpsObserved`, `error` |

**Partial unique index, added by hand to the migration.** `@@unique([eventId, cameraId])` does
not constrain registry cameras, because Postgres treats NULLs as distinct — two registry cameras
could both claim `GNR-001`. `cameras_registry_cameraId_key ON cameras(cameraId) WHERE eventId IS
NULL` closes that. Prisma cannot express a partial index, so `assertCameraIdFree()` in the service
enforces the same rule in the application, both for a readable error message and so the guarantee
survives a deployment where the index is missing. `prisma migrate diff` reports no drift from it.

### `CameraStatus` is the honesty contract

Nothing except a real probe may write `ONLINE`. The seed does not set `status` or `lastSeenAt` at
all — not on first run and not on re-run, so a re-seed cannot erase a health checker's findings.
The API surfaces `UNKNOWN` as *"Not yet probed"* and a null `lastSeenAt` as *"Never reached"*,
in a neutral grey rather than red: a camera nobody has contacted is not a camera that is down,
and colouring it as a fault would be a claim the system cannot support.

### What the seed is, precisely

`prisma/seed-cameras.ts` — 5 departments, 16 sites, 56 cameras. Idempotent (matches on
`cameraId` where `eventId IS NULL`).

- **Real:** every coordinate. Sites are actual places — Akshardham, Mahatma Mandir, Kalupur
  Junction, Kankaria Lakefront, Sabarmati Ashram, Narendra Modi Stadium, SG Highway, Vastrapur
  Lake. Verified bounding box 22.9938–23.2325 N, 72.5010–72.6849 E; zero coordinates outside
  Gujarat.
- **Declared, not measured:** vendor, model, protocol, resolution, fps — a hardware inventory of
  the kind a department hands over as a spreadsheet. The UI labels them *"as configured"* and the
  registry form groups them under *"Hardware — as configured, not measured"*.
- **Deliberately absent:** department contact names and phone numbers are left null. Inventing a
  phone number for a real police force would be worse than an empty field.
- **Deliberately incomplete:** 3 cameras are seeded with no coordinates. A real estate always has
  units registered but not yet surveyed, and the map has to say so rather than drop a pin at 0,0.
  With the 4 pre-existing event cameras, 7 of 60 are withheld from the map and listed by name
  under *"Not on the map — awaiting survey"*.
- `rtspUrl` is built from `MEDIAMTX_RTSP_BASE`, so the whole estate re-targets by env var.

### API — `/api/surveillance`

All routes authenticated. `admin` and `police` read and write; `organizer` reads only, so an
organizer can attach a registry camera to an event without being able to alter the estate.

| Method | Path | Notes |
|---|---|---|
| GET | `/cameras` | filters `q`, `status`, `departmentId`, `siteId`, `eventId` (`none` = registry-only), `located`; `skip`/`take`, returns `{ cameras, total, skip, take }` |
| GET | `/cameras/:id` | includes the last 20 health probes |
| POST/PUT/DELETE | `/cameras[/:id]` | `admin`, `police` |
| GET | `/departments`, `/sites`, `/stats` | |

`passwordEnc` is stripped in `formatCamera()` and never leaves the server; the client gets
`hasCredentials: boolean`. Credentials are AES-256-GCM encrypted under `CAMERA_CREDENTIAL_KEY`.
**With no key configured the API refuses the write** (400, naming the missing variable) rather
than storing a plaintext password — a silent downgrade nobody would notice until it mattered.

`/stats` is entirely `COUNT` and `GROUP BY`. `lastHealthCheckAt` is null until a probe runs, and
the tile reads *"Never run"*.

### Coordinates are stored as a pair or not at all

`validateCoordinatePair` rejects a half-coordinate on create *and* on partial update (it validates
the row as it will be after the write, not just the fields sent). A camera with only a latitude
would be plotted on the prime meridian; a wrong pin is worse than an honest "not surveyed".

### Frontend

`pages/surveillance/CameraRegistry.tsx` (filterable table, create/edit/delete, counts) and
`CameraMap.tsx` (react-leaflet + OpenStreetMap). `cameraStatus.ts` holds one definition of status
presentation so table and map cannot disagree about what a colour means.

The map draws only what is stored: a status-coloured pin, an arrow at the surveyed bearing
(omitted when the bearing is null), and — for the selected camera — a range circle plus an aim
line whose endpoint is a great-circle computation from the stored bearing and range. **No coverage
cone is drawn**, because the schema stores no field-of-view width and a wedge would be an invented
number on a map.

Nav gains a Surveillance section for `admin` and the new `police` role. `police@gmail.com` /
`Test@123` is created on boot alongside the existing organizer seed user, so the role can actually
be signed into.

New env vars, both documented in `backend/.env.example`: `MEDIAMTX_RTSP_BASE`,
`CAMERA_CREDENTIAL_KEY`.

### Verified by hand against a running server

Auth: police register/login round-trip returns `role: police`; `/cameras` → 401 with no token,
403 as a participant, 200 as police; organizer GET 200 / POST 403.
Validation, each returning a readable 400: duplicate registry `cameraId`; latitude without
longitude (on create and on partial update); latitude 991; `protocol: "telepathy"`; unknown
`departmentId`; password with no key configured. Rename onto an existing id rejected; delete 200
then 404.
Credentials: stored value is `iv:tag:ciphertext`, not the plaintext; two encryptions of the same
secret differ; decrypt returns the original; a tampered ciphertext throws on the GCM auth tag.
Seed: re-run reports `0 created, 56 updated`, leaving counts at 60 cameras / 16 sites / 5
departments.
Every new module compiles and is served by the Vite dev server (`CameraRegistry`, `CameraMap`,
`cameraStatus`, `surveillance.service`, `Navbar`, `Login`, `Register`, `react-leaflet`,
`leaflet.css`, all HTTP 200).

**Not verified:** no visual click-through in a browser — the Chrome extension was not connected in
this session. The pages are proven to compile and their data contracts proven end-to-end against
the live API, but nothing here confirms how they *look*.

Gate after Phase 1: still 59 occurrences, unchanged. Phase 1 introduced no new fabricated data.
`npm run build` exits 0; both `tsc --noEmit` exit 0.

---

## 9. Phase 2 — live stream layer and the health poller

Phase 1 gave every camera a status of `UNKNOWN`. This phase builds the only thing allowed to
change that: a poller that opens a socket and speaks the protocol.

### MediaMTX, and how fifty endpoints come from three clips

`docker-compose.yml` gains a `mediamtx` service on the existing `drishti-network`, publishing
RTSP 8554, HLS 8888, WebRTC 8889 / 8189-udp and the control API on 9997 — every port overridable
by env var. It mounts two things: `docker/mediamtx.yml` and `media/clips/`.

`scripts/generate-streams.js` scans the clip folder and assigns clips round-robin across N
endpoints, writing:

- `docker/mediamtx.yml` — one path per camera, each with an ffmpeg publisher looping its clip
  (`-re -stream_loop -1`). Stream-copy by default, because fifty simultaneous H.264 encodes do
  not fit on a laptop; `--reencode` when the source codec cannot be passed through.
- `docker/streams.json` — the manifest `seed-cameras.ts` reads, so the registry and the stream
  server cannot disagree about which path is which. The direction of truth is one-way:
  clips → config + manifest → camera seed.

**The generator refuses to run against an empty clip folder.** Writing a config that points at
files which do not exist would start MediaMTX, fail every publisher, and surface only as fifty
cameras mysteriously OFFLINE. `--allow-empty` produces the paths-free config that is committed as
the baseline — clips are never committed, so a fresh clone genuinely has no streams, and the
config says so in a comment rather than pretending.

### The probe is a real conversation, not a ping

`backend/src/utils/streamProbe.ts` opens a TCP socket and sends `OPTIONS`, then `DESCRIBE`.

Both matter. MediaMTX answers OPTIONS happily for a path with no publisher, so a probe that
stopped at OPTIONS would report every dead camera as healthy. DESCRIBE is what distinguishes
"the server is up" from "this camera is up".

| Outcome | Status | Recorded reason |
|---|---|---|
| DESCRIBE 200 with an SDP body | ONLINE | — |
| DESCRIBE 404 | OFFLINE | `<host> is reachable, but nothing is publishing to "/camNN"` |
| 401, no credential stored | DEGRADED | names the missing credential |
| 401, credential rejected | DEGRADED | `The stored credential was rejected by the camera` |
| Connection refused / no route / unresolvable | OFFLINE | the errno, in words |
| Connects but never answers | OFFLINE | `No RTSP response within <n>ms` |
| Other 4xx / 5xx | DEGRADED | the verbatim status line |

RFC 2617 digest auth is implemented (basic as a fallback), which is what finally gives Phase 1's
`passwordEnc` a consumer. Credentials embedded in a URL are honoured too. HTTP endpoints get an
HTTP probe with the response destroyed after headers, because pulling the body of an MJPEG stream
never finishes.

**`fpsObserved` is left null on every row.** This probe does not decode video, and only a decoder
can honestly report a frame rate. It is filled by the stream workers in Phase 3.

### The poller

`cameraHealth.service.ts` sweeps every camera with a stream URL every 30s (all knobs are env
vars). A camera with no stream URL is **not probed and gets no health row** — it stays `UNKNOWN`,
which is the truthful answer to "is it up?" when nobody has ever asked. A `CameraHealth` row
therefore always means a probe actually happened.

`lastSeenAt` moves only on ONLINE. It means "last time we actually reached this camera", not
"last time we looked", so a camera that goes down keeps the timestamp of its last real contact.

Overlapping sweeps are skipped rather than stacked, and a sweep that overruns its interval logs
which of the three env vars to change.

**A real performance finding.** The first implementation wrote one row and one update per camera,
and a sweep took 25,470ms. The probes were not the problem — measured at 9–23ms each, 944ms for
all 56. The cost was 56 sequential transactions against a hosted Postgres at roughly 450ms per
round trip. Batching to one `createMany` plus one `updateMany` per distinct status brought the
same sweep to **1,481ms**, a 17× reduction. The batch insert falls back to row-by-row if a camera
is deleted mid-sweep, so one missing row cannot lose 55 good probes.

Health rows are pruned to `CAMERA_HEALTH_RETENTION_HOURS` (24 by default); at 56 cameras every
30s the table would otherwise grow by roughly 161k rows a day.

### API

| Method | Path | Notes |
|---|---|---|
| GET | `/cameras/:id/stream` | HLS and WebRTC URLs, or `playable: false` with the reason |
| POST | `/health-check` | sweep everything now, returns the real summary |
| POST | `/cameras/:id/health-check` | probe one camera now |
| GET | `/health` | poller configuration and the last sweep this process ran |

`/cameras/:id/stream` **only offers a browser URL when the camera's RTSP URL points at the
configured stream server**, because only then does republishing exist. For any other host it
returns `playable: false` and explains, rather than composing a URL that would quietly 404 inside
a video element.

### LiveWall

`pages/surveillance/LiveWall.tsx` — a 5×5 grid, hls.js with native-HLS fallback, click to expand.

The page distinguishes two different truths and shows both: the **LIVE** badge means pixels are
arriving *now*, observed from the video element's own playing / waiting / error events, while the
status pill is what the last probe found. The header count — "N of M tiles on this page are
playing now" — is derived from that observed state, not from how many tiles were asked to play.

A tile that cannot play shows the actual reason, including hls.js's own error type and detail,
rather than a black rectangle. The wall also lists every state change from the last sweep, by
camera and with the reason, which is the visible proof that pulling a stream really did flip a
camera.

### Verified by hand, end to end

The done-condition, demonstrated without a manual trigger:

```
nothing listening on 8554   -> 56 probed, 56 OFFLINE  (4 without a URL, not probed)
stream server started       -> 56 probed, 56 ONLINE   56 state changes recorded
cam07 pulled at 23:42:11    -> automatic sweep at 23:42:21, ten seconds, well inside 60s:
    GNR-007: ONLINE -> OFFLINE
      localhost:8554 is reachable, but nothing is publishing to "/cam07"
    lastSeenAt frozen at 18:11:49, the last time it was genuinely reached
cam07 restored              -> GNR-007: OFFLINE -> ONLINE, lastSeenAt advances to 18:12:57
```

Probe classification was exercised against a socket-level RTSP server covering all thirteen
cases: publishing, server-up-path-dead, auth required with no credential, with the right
credential, with the wrong password, credentials in the URL, nothing listening,
connects-then-silent, unresolvable host, empty URL, unsupported scheme, and a dead HTTP endpoint.
Every one produced the intended status and a usable reason.

Stream URLs: a MediaMTX-hosted camera returns HLS and WebRTC URLs; a camera pointed at
198.51.100.7 returns `playable: false` naming the mismatch; a legacy event camera with no URL
returns `playable: false` saying so. All 953 health rows carry `fpsObserved: null`.

Seed idempotency and the manifest fallback both hold: with a manifest the seed uses its paths,
without one it falls back to the convention, and either way the 56 registry cameras keep 56
distinct URLs.

**Not verified, and it matters.** Docker's daemon was not running in this session, so **MediaMTX
itself was never started**. The probe, poller, state transitions and API were verified against a
socket-level RTSP server written for the purpose, which answers OPTIONS and DESCRIBE the way
MediaMTX does — that exercises all of the code in this repository, but none of MediaMTX's own
configuration. Specifically unverified: that `docker/mediamtx.yml` is accepted by MediaMTX, that
the ffmpeg publishers loop correctly, that HLS republishing works, and that twenty-five tiles
play simultaneously in a browser. Those need `docker compose up -d mediamtx` with real clips in
`media/clips/`, and should be run before the evaluation. The Chrome extension was also not
connected, so again there was no visual click-through; every new module is proven to compile and
be served by Vite.

Gate after Phase 2: still 59 occurrences, unchanged. `npm run build` exits 0; both `tsc --noEmit`
exit 0.

---

## 10. Phase 3 — the analytics engine

`ai-service/` at the repo root. Every detection in the product is produced here,
and nothing in it invents one.

### The zone logic is a verified port, not a rewrite

`ai-service/zones.py` carries the ray-casting test and the counting rule across
from `backend/src/services/crowd_analyzer.py`. Equivalence was measured, not
asserted: 10,000 random points against 400 random polygons, and 300 random
scenes of up to 30 boxes against up to 4 zones, run through both
implementations. **Zero divergence on both.**

Getting there found one real difference. The original computes a box centre with
integer floor division (`x + w // 2`), and my first version used `/ 2` — 8 of
300 scenes disagreed, always on a box straddling a zone edge. The quirk is now
preserved deliberately, because two systems that count the same crowd *nearly*
the same are worse than two that count it identically.

**Two behaviours were deliberately not ported.** `auto_scale_zones` rescales
zones by a factor inferred from the largest coordinate present and — when
several zones share coordinates — replaces them outright with evenly distributed
vertical strips. `process_video` invents a full-frame "Full Video" zone for an
event with no zones. Both produce a real count of real people inside boundaries
nobody drew, reported as though an operator had defined them.

The replacement requires the caller to state the canvas the polygons were drawn
on (`zoneReferenceSize`). Without it, `occupancy()` returns `{}` and the worker
publishes `zoneOccupancy: {}` — the honest "we cannot place these boxes". The
old file keeps a header pointing here and saying why.

### The event contract

Verified to match the specified shape exactly: the nine top-level keys and the
four attribute keys, no more and no fewer. A detection with nothing measured
carries `trackId: null`, `snapshotPath: null`, `zoneOccupancy: {}`, and all four
attributes null — never an empty string or a plausible default, so a consumer
can treat a present value as something actually observed.

`zoneOccupancy` is keyed by Zone **UUID**, not the human-facing `zoneId` — the
same identity mistake that broke crowd density before Phase 0.5.

### What the service refuses to do

| Missing | Behaviour |
|---|---|
| ultralytics or weights | `available: false`, `/health` 503 with the reason, worker refuses to start. `detect()` **raises** rather than returning `[]`, so "no detector" can never be read as "empty frame" |
| `PLATE_MODEL_PATH` | plate reading off, `plateText` null on every vehicle, reason on `/health` |
| `zoneReferenceSize` | `zoneOccupancy: {}` rather than a count against a guessed scale |
| readable frames | DEGRADED with the reason, backoff retry, gap left genuinely empty |
| Redis | publish fails, counted as `dropped` on `/health`, no silent buffering |

The plate refusal is the one worth restating. The obvious shortcut with no plate
detector is to OCR the lower third of every vehicle box; it reliably produces
confident, well-formed, entirely wrong registration numbers, and a plate is the
single field a person would act on.

`fpsObserved` is null everywhere in this phase's output until frames are decoded
— it is measured from the decoder over a rolling window, never the camera's
configured fps.

`color` **is** published, because it is a measurement: the centre half of the
crop (edges are mostly background) converted to HSV, achromatic cases resolved
by saturation and value, then the modal hue named. Verified against solid-colour
images for white, black, grey, red, blue, green, yellow and orange, and against
a grey-bordered red box to confirm the centre wins. `vehicleType` is the
detector's own class — "car", not "sedan", because nothing here can tell a sedan
from a hatchback.

### Track identity

ByteTrack runs inside `model.track(persist=True)`, so state lives on the model
instance and each camera gets its own — sharing one would braid tracks together
and hand out ids that teleport between locations. After a reconnect the tracker
is reset and `generation` increments: frames either side of a gap are not
continuous, so a track cannot honestly be carried across it, and two detections
sharing a track id in different generations are not the same object.

### A measured finding about stream opens

`cv2.VideoCapture` on an unreachable RTSP URL blocks for a **flat 30 seconds**,
and no `OPENCV_FFMPEG_CAPTURE_OPTIONS` timeout changes it. Measured across five
option sets (`timeout`, `stimeout`, both, `max_delay`, none): 30.05–30.12s every
time. A thread stuck in C cannot be cancelled, so fifty down cameras would have
occupied asyncio's shared pool and starved the frame reads of every healthy one.

Fixed with a TCP pre-check before FFmpeg is involved — a refused port is known
in milliseconds with the real errno — plus a dedicated capture-open pool so a
stuck open cannot delay another camera. Verified: the worker now reports
DEGRADED with `No connection could be made because the target machine actively
refused it` almost immediately, and stays DEGRADED across retries rather than
flapping back to STARTING.

### Verified by hand

Zone equivalence as above. Contract shape and null discipline. Worker config
parsing, including a bad `frameStride` falling back to the default and a missing
`zoneReferenceSize` disabling occupancy. Colour naming across eight solid
colours and a background-dominated crop. The full worker failure path against a
genuinely refused port: DEGRADED published with the errno, exponential backoff,
**zero detections published during the outage**, `fpsObserved` null, zero frames
processed. A worker with no stream URL and a worker with no detector both reach
FAILED with the reason rather than sitting silent. All eight API routes register
and the app imports cleanly.

**Not verified.** `torch` and `ultralytics` were not installed — the CUDA wheels
are around 2GB and, more to the point, there is no footage on this machine
containing people, vehicles or plates, so installing them would have proved only
that a model loads. **No YOLO inference, no ByteTrack association and no OCR was
run.** The done-condition — a worker publishing real detections within 5s, and
plates read correctly ≥70% of the time — is therefore **unverified**, and needs
`docker compose up -d ai-service` with real footage in `media/clips/`. Redis was
also unavailable, so publishing was verified only through its failure path (the
`dropped` counter incrementing, and the connect error being reported verbatim).

Everything not requiring weights was exercised against real code paths, not
stubs, with one exception: the stream-failure test substitutes a stub detector,
because the real one refuses to start without weights and would otherwise
short-circuit the very path under test.

Gate after Phase 3: unchanged at 59 for files this phase touched; `ai-service/`
contributes none.

---

## 9. Police operations — the role becomes operational

`POLICE` was added in Phase 1 as the second role that owns the camera estate. It could read and
write the registry and nothing else, because **every operational table in the product was
event-scoped**: `Incident.eventId`, `DispatchUnit.eventId`, `CrowdDensity.eventId` and
`Zone.eventId` were all required. A registry camera therefore could not raise an incident, hold a
crowd reading, or have a unit sent to it — there was no row shape for "something happened at
Akshardham", because Akshardham belongs to no event.

This phase widens those four tables the same way Phase 1 widened `Camera`, and builds the
operational surface on top.

### Schema (migration `20260901182427_add_police_operations`)

Additive and widening only. No column dropped, no table recreated. The non-additive statements are
all `DROP NOT NULL`, which only widens what a column accepts.

| Change | Detail |
|---|---|
| `Incident.eventId` | nullable — an estate camera can raise an incident with no event |
| `Incident.reporter` | nullable — a machine-raised incident has no human reporter |
| `Incident` + 8 columns | `cameraId`, `siteId`, `latitude`, `longitude`, `severity`, `source`, `detectionConfidence`, `ruleKey` |
| `DispatchUnit.eventId` | nullable, plus `departmentId`, `latitude`, `longitude`, `status` |
| `Zone.eventId` | nullable, plus `cameraId` — a zone is an event's layout **or** a camera's region of interest |
| `CrowdDensity.eventId`, `.zoneId` | nullable — estate readings need no event |
| `DispatchAssignment` | new: the dispatch audit trail |
| New enums | `IncidentSeverity`, `IncidentSource`, `DispatchStatus`, `DispatchUnitStatus` |

**Hand-written additions to the migration**, following the `cameras_registry_cameraId_key`
precedent — Postgres treats NULLs as distinct, so each widened composite key needed a partial
index, and each widened scope needed a `CHECK`:

| Constraint | What it prevents |
|---|---|
| `zones_camera_zoneId_key` | two zones on one camera claiming the same `zoneId` |
| `dispatch_units_registry_unitId_key` | two registry units claiming the same `unitId` |
| `zones_scope_check` | a zone belonging to both an event and a camera, or to neither |
| `incidents_scope_check` | an incident with no jurisdiction — invisible to both consoles at once |
| `dispatch_units_scope_check` | an orphan unit that appears in no dispatch list |
| `dispatch_assignments_active_key` | one unit holding two live assignments to one incident |
| `incidents_reporter_source_check` | a `MANUAL` incident naming nobody, or an `ANOMALY` incident naming somebody |

All seven verified by `INSERT` probes; all seven refused. Existing data survived unchanged:
60 cameras, 3 events, 5 zones, 16 sites, 5 departments, 12 users.

### The anomaly rule engine replaces the fabricated alert generator

`services/anomalyRules.service.ts`. Three rules, each firing on a row that already exists:

| Rule | Status today | Evidence it fires on |
|---|---|---|
| `CAMERA_OFFLINE` | **live** | a status transition the health poller genuinely observed |
| `ZONE_CAPACITY_BREACH` | dormant | occupancy over a zone's declared `maxCapacity` |
| `CROWD_SURGE` | dormant | rate of change between two consecutive readings |

The two dormant rules are **not stubbed** — they are wired and simply never fire while
`crowd_densities` is empty. `GET /api/dispatch/stats` reports each rule's `active` flag and what it
`requires`, so the console can say *"dormant, waiting for crowd readings"* rather than implying
nothing is wrong. Thresholds are env-driven (`ANOMALY_*`) and read at call time, so they can be
changed live.

`CAMERA_OFFLINE` is real now, with no detector involved: a probe reached the stream last sweep and
failed on this one. Verified end to end — `AMD-001` reset to `UNKNOWN`, probed, and the failure
produced:

```
transition AMD-001: UNKNOWN -> OFFLINE (Connection refused by localhost:8554)
anomaliesRaised=1
  "Camera AMD-001 (Kalupur Main Entrance) is offline. Last probe failed: Connection refused…"
  source=anomaly, ruleKey=CAMERA_OFFLINE, severity=high
  reporter=null, reporterName=null      (machine-raised, so nobody is named)
  detectionConfidence=null              (a reachability probe has no confidence to report)
  re-probing raised 0 more              (open incidents are not duplicated)
```

A camera that answers again resolves its own incident, but **`responseTime` is left alone** — that
column measures human response, and crediting a self-healing stream to a responder would corrupt it.

Note a deliberate consequence: only *transitions* raise. An estate that is already entirely offline
produces no new incidents on restart. The Overview's reachable/offline tiles carry that state
instead, which is the honest division — a standing condition is not an event.

### Dispatch

`services/dispatch.service.ts` and `/api/dispatch`. `police` and `admin` dispatch estate-wide;
`organizer` keeps the ability to send their own event's marshals, and the service refuses an attempt
to commit a unit belonging to a different event. `participant` is absent throughout — reporting an
incident stays open to them, deciding who answers it does not.

Nearest-unit ranking is a haversine over two stored coordinate pairs. **No ETA is ever produced**:
`etaSeconds` stays null until a routing service answers, and the console prints *"ETA unavailable"*.
Distance is labelled *straight-line*. This is the same page whose predecessor picked a random
responder with a random ETA; the fix is the honest lesser number, not a plausible greater one.

The lifecycle (`dispatch → acknowledge → arrive → clear`/`cancel`) writes each timestamp at the
moment the transition is reported. **Nothing advances on a timer.** `meanAcknowledgeSeconds` and
`meanArrivalSeconds` are null — rendered *"Not yet measured"* — until real samples exist; zero is
never used to mean none.

`prisma/seed-units.ts`: 30 units across the 5 existing departments, based at real police stations,
fire stations, hospitals and control rooms in Gandhinagar and Ahmedabad. `contact` is a role label,
not an invented phone number. **3 units are seeded without coordinates** — dispatchable but not
rankable, listed as *"Distance unknown — unit not surveyed"*.

### Realtime

Socket.IO on the existing HTTP server at `/realtime`, verified by the existing JWT — no second auth
system. Rooms are assigned from the verified token, never from a client request. A frame means
*"read again"*, not *"here is the new state"*: REST stays authoritative and every page keeps a
slower poll as a floor, so a missed frame costs latency, never correctness.

Verified: a socket with no token is refused (`Authentication required`); with a bad token
(`Invalid or expired token`); a police socket receives `incident:new` in 1146 ms and `dispatch:new`
on assignment; **a participant socket connects and receives nothing from the estate room**.

### API added

| Method | Path | Roles |
|---|---|---|
| GET | `/api/incidents/estate` | `admin`, `police` — filters `status`, `severity`, `source`, `cameraId`, `siteId`, `scope`, `since`, `take` |
| GET | `/api/dispatch/units` | `admin`, `police`, `organizer` |
| GET | `/api/dispatch/incidents/:id/units` | ranked nearest-first |
| GET | `/api/dispatch/incidents/:id/assignments` | |
| POST | `/api/dispatch` | send a unit |
| PUT | `/api/dispatch/:id` | `acknowledge` \| `arrive` \| `clear` \| `cancel` |
| PUT | `/api/dispatch/units/:id/status` | `admin`, `police` |
| GET | `/api/dispatch/stats` | `admin`, `police` |
| GET | `/api/surveillance/crowd` | estate occupancy per camera zone |

`POST /api/incidents` now accepts `cameraId` as an alternative to `eventId`, and inherits the
camera's surveyed position. Existing response shapes are unchanged; every new field is additive.

### Frontend

`pages/police/DispatchConsole.tsx` (queue, filters, unit ranking, lifecycle actions) and
`EstateOverview.tsx` (camera health, rule coverage, anomaly feed, estate occupancy).
`incidentPresentation.ts` holds one definition of severity and rule presentation, as
`cameraStatus.ts` does for camera health.

`components/RequireRole.tsx` is the app's **first route guard**. §2 recorded that every route in
`App.tsx` was unguarded; that was survivable for read-only dashboards and is not survivable for a
page that can dispatch a unit. It does not replace the server checks and does not pretend to — it
gives a signed-out user `/login` and a wrong-role user a clear refusal, instead of a screen of 403s.

### A bug this phase's own testing found and fixed

Deleting an incident cascades its `DispatchAssignment` rows away but left every committed unit
reading `DISPATCHED` with nothing to explain it — those units would have been missing from the
available list permanently. `deleteIncident` now frees them in the same transaction, skipping any
unit that still holds a live assignment elsewhere. Regression-tested.

### Gate and build

`check-no-mocks` is at **59 occurrences — unchanged from the Phase 1 baseline**. This phase
introduced no fabricated data. (Three transient hits came from comments in new files naming the
functions they replace; the comments were reworded rather than allowlisted, so the gate keeps its
signal.) `npm run build` exits 0; both `tsc --noEmit` runs exit 0.

**Not verified:** no visual click-through in a browser — the same limitation as Phase 1. Both new
pages compile and their data contracts are proven end to end against the live API, but nothing here
confirms how they look. The crowd panel has necessarily only been seen in its empty state, since
`crowd_densities` is still at 0 rows until a detector lands.

### What this does not do

Crowd-flow analytics for police is **wired, not fed**. The schema, the read path
(`GET /api/surveillance/crowd`), the rules and the UI all exist and are honest about being empty.
Nothing produces estate crowd readings yet, because that is the detector — Phase 3. When it lands it
writes `CrowdDensity` rows with `eventId: null` against camera zones, and the dormant rules and the
occupancy panel begin working with no change to anything in this section.

---

## 11. Phase 4 — the mock gate reaches zero

`npm run verify` passes. Every occurrence of fabricated data in the audit's §3
inventory is gone, and none was replaced by another.

```
Phase 0 baseline   76
after Phase 0.5    59
after Phase 4      0   (9 allowlisted: particle animation, id generation, upload filename)
```

### A note on how this phase was built

This phase was worked on concurrently with a second session in the same working
tree, which built the police-operations side: `anomalyRules.service.ts`,
`dispatch.*`, `realtime.ts` (Socket.IO), `geo.ts`, `seed-units.ts` and the
`pages/police/` console, plus a `add_police_operations` migration. That work
covers 4.2's backend and 4.4 outright.

What is recorded below is the half done here: 4.1, 4.3, 4.5, the 4.2 frontend,
and the two stub routers. Where the two met — `cameraHealth.service.ts`,
`crowdAnalysis.service.ts`, `realtime.ts` — the changes are complementary and
both are in the tree; the commit for this phase deliberately stages only the
files this session owns, so nothing of theirs is attributed here or overwritten.

### 4.1 Crowd flow, from live detections

`detectionConsumer.service.ts` reads the `drishti:detections` Redis Stream the
ai-service publishes to and turns `zoneOccupancy` into real `CrowdDensity` rows.

- Detections are grouped **by frame**, because every detection from one frame
  carries that frame's whole occupancy map; the occupancy is read once per
  frame, not once per detection.
- `confidence` on a row is the **mean confidence of the person detections that
  made up that count** — a real computation over real values, null when the
  count is zero because there is nothing to average.
- `peopleCount` over `maxCapacity` is **not clamped**. Over capacity is the
  reading that matters most.
- One row per camera-zone per `DENSITY_WRITE_INTERVAL_SECONDS` (10 by default).
  It is the latest genuine instantaneous reading, timestamped with when that
  count was actually observed — not an average over the window relabelled as a
  moment.
- A zone the worker could not place boxes in publishes `{}`, and `{}` is not a
  count of zero: no row is written at all.
- `frameNumber` and `processingTime` are null on live rows. A live stream has no
  frame index to give; those belong to the archived-footage path.

**The consumer feeds the rule engine.** `evaluateCrowdReadings` existed in the
other session's `anomalyRules.service.ts` but nothing called it. The consumer
now hands it the ids of every reading as they land, using
`createManyAndReturn` so the ids come back from the same write rather than a
racing re-query. This is the only path by which `ZONE_CAPACITY_BREACH` and
`CROWD_SURGE` can fire, so an anomaly of either kind is always backed by a
detection someone could go and look at. A rule-engine failure is caught
separately from the write: the reading is the measurement, the anomaly is a
judgement about it, and losing the second must not lose the first.

**Deleted, not disabled:** `backend/src/utils/mockCrowdData.ts`,
`generateAndSaveMockCrowdData()` (85 lines), the `generateMockData` controller,
and the `POST /:eventId/generate-mock` route — verified returning 404.

**The upload endpoint now runs the analyzer.** It previously accepted a video,
discarded it, and wrote randomly generated density rows, so an organizer who
uploaded real footage was shown numbers with no relationship to it. It calls
`processAndSaveVideo` on the file that was actually uploaded, deletes the file
afterwards, and answers 202 describing what was *accepted* rather than what was
found.

### 4.3 and the two stub routers

`monitoring.routes.ts` had four endpoints answering with a fixed string. Three
are now real aggregations in `monitoring.controller.ts`:

| Route | Answers from |
|---|---|
| `/events/:id/live` | latest `CrowdDensity` per zone, camera status from the health poller, incident counts, mean response time |
| `/events/:id/crowd-flow` | density readings over a requested window |
| `/events/:id/anomalies` | incidents with `source: ANOMALY` only |

A zone with no readings returns `latestReading: null`, and `meanResponseSeconds`
is null rather than 0 when nothing has been resolved — 0 would read as an
instant response. Only `ANOMALY`-sourced incidents appear in the anomaly feed;
mixing manual reports in would overstate what the system detected on its own.

The fourth stub, `POST /events/:id/emergency`, was **not** reimplemented, and the
file says why: emergency dispatch is genuinely served by `/api/dispatch`, which
assigns real `DispatchUnit` rows to real incidents. A second endpoint answering
the same question differently is how two subsystems drift apart.

`user.routes.ts` had four more. All five routes are now real queries, `password`
is never selected so it cannot leak through a spread, `GET /:id` is self-or-admin
(without which any authenticated user could enumerate the table), `PUT` refuses
email/role/password changes rather than ignoring them silently, and `DELETE`
refuses to remove an organizer whose events would cascade with them.

### 4.5 Admin dashboard

`GET /api/users/stats` returns counts from a `GROUP BY`. Measured against the
live database:

```
was shown          participants 2103, admins 16, safety score 94.5, health 98%
actually in the DB participants 4, organizers 6, admins 1, police 2  (13 total)
```

Every role appears in the response including empty ones, so a zero is
distinguishable from a role that does not exist.

**The safety-score tile is gone, not recomputed.** There is no defensible
formula for collapsing incidents, response times and density breaches into one
number, and any weighting chosen would be arbitrary while looking authoritative.
The tile now shows **cameras online** out of the registry total, which is
measured by the health poller, with offline and not-yet-probed counts beneath
it. The neighbouring "System Health 98%" tile — also a constant — became **mean
response time**, over incidents genuinely marked resolved, showing a dash rather
than 0 when there are none.

The users tab previously derived its admin count by subtracting participants and
organizers from the total, which silently absorbed police operators into
"admins". It now shows the admin count itself, and police as their own line.

Every tile reading a stat renders `—` while the query is in flight or if it
fails, with the server's own message in a banner. None falls back to a number.

### 4.2 Anomaly detection, front end

`generateMockAlert()` is deleted — 70 lines that produced a random type, a random
location, a random description from a hand-written list, a random severity and a
confidence in a 75–100 range, fired on a 30% coin flip every 15 seconds.

The page now projects real `Incident` rows with `source: ANOMALY`, loaded from
`/api/monitoring/events/:id/anomalies` and pushed live over the other session's
Socket.IO gateway, with a 30s poll as a fallback so a dropped socket degrades to
slower updates rather than a page that silently stops changing. `confidence` is
the rule's own computed value and is `null`-able. "Start Monitoring" now
subscribes to a feed that was already running server-side rather than starting a
simulation, and resolving an alert writes to the server first and re-reads —
never an optimistic mark on a request that failed.

**The camera tiles no longer draw a detection box.** The old one appeared on
`Math.random() > 0.7`. It is not replaced with a real one, because bounding boxes
live on the detection stream and are not persisted on an `Incident` — there is
nothing real to draw. A rectangle over the tile would be decoration pretending to
be evidence. The tile instead shows the camera's real probed status, and a border
plus count when the rule engine has an open anomaly against that camera. The
always-pulsing "live" dot is now status-coloured, grey for a camera nobody has
reached.

### Verified by hand

Gate passes. `npm run build` exits 0, both `tsc --noEmit` exit 0.

Against a running server: `/api/users/stats` returns the true 13 users by role
and is 403 for an organizer; `/api/monitoring/events/:id/live` returns three real
zones each with `latestReading: null` and two cameras with
`{"UNKNOWN": 2}`, `meanResponseSeconds: null`; `/crowd-flow` returns 0 readings;
`/anomalies` returns 0; `POST /crowd-analysis/:id/generate-mock` returns 404.
The detection consumer with no Redis logs `Detection consumer error (Connection
is closed.); retrying in 1s`, then 2s — visible, backing off, and writing
nothing.

Those zeroes and nulls are the point. There is no ai-service running and no
Redis, so nothing has been measured, and every page says so rather than showing
a plausible number.

**Not verified.** No end-to-end run from a camera to a chart: that needs
MediaMTX, the ai-service and Redis all up, none of which this machine could run
(Docker's daemon is down). The consumer's parsing, grouping, throttle and
rule-engine hand-off are therefore exercised only by construction and type, not
against a live stream. The full organizer walk-through in the phase's
done-condition — create event, define zones, assign cameras, watch a number
change — is unrun for the same reason. There was again no browser click-through.

---

## 12. Phase 5 — watchlist, plate matching, alerts

Migration `add_watchlist_and_alerts`: four tables (`watchlist_entries`,
`detections`, `alerts`, `track_points`), three enums, and back-relations on
`Camera` and `User`. Purely additive — no DROP, no data touched; 60 cameras, 13
users and 3 events all intact afterwards.

### Match scores are computed, and it is checked

`utils/plateMatch.ts` is deliberately separate from the engine so it can be
reasoned about without Redis or a database in the way. Everything in it is a
pure function.

Normalisation uppercases, strips everything that is not alphanumeric, and folds
exactly four OCR confusions: `O`, `Q` → `0` and `I`, `L` → `1`. **Deliberately
narrow.** Folding `S/5`, `B/8` or `Z/2` as well would raise the hit rate and
start matching genuinely different plates — and on a watchlist a false positive
sends officers to the wrong vehicle.

The score is `1 - distance / length`, computed from a bounded Levenshtein
distance. An exact match is 1. One substitution on a ten-character plate is
0.9; on a six-character plate 0.83 — which is correct, because one wrong
character matters more on a shorter plate. **A fuzzy match can never reach an
exact match's score**, so an operator can see at a glance that the system is not
certain. Plates shorter than four characters are refused outright: a
two-character fragment sits within one edit of a great many real plates.

Verified by 27 assertions, all passing — normalisation, distance (substitution,
insertion, deletion, early-out on length gap), and the matcher including the
four-character floor, the fuzzy-disabled path, and that every fuzzy score is
strictly below the exact one.

### The engine

`matchEngine.service.ts` reads the same stream as the crowd consumer under its
own consumer group (`drishti-match`), so the two have independent delivery and
neither can stall the other. Per detection it does three things: persist a
sampled detection, record a track point, and compare any plate against the
active watchlist.

**The detections table is a sample, and says so.** At eight sampled frames a
second across fifty cameras, storing everything would be tens of millions of
rows a day. What is kept: one row per camera-track per
`DETECTION_PERSIST_INTERVAL_SECONDS`, plus **every** detection carrying a plate,
because that is the evidence behind an alert. The rule is written on the model
and repeated wherever the table is served, so "all detections" is never read as
a complete record.

**TrackPoint stores the camera's position, not the object's.** This system
cannot place a vehicle within a field of view. A route drawn from these points is
a sequence of cameras that saw the vehicle, and the model comment says so, so
Phase 6 cannot quietly present it as a GPS trail. A camera with no survey gets no
track point rather than one at 0,0.

Deduplication: the same watchlist entry on the same camera inside
`ALERT_DEDUPE_SECONDS` (30) is one sighting. Without it a car at a red light
would alert on every sampled frame.

### Verified end to end against the real database

Driven through `processDetectionEvent` — the same function the stream loop calls,
exported so a replay uses the same path rather than a parallel one that could
drift:

```
1  plate passes with an empty watchlist    -> 0 alerts, detection still persisted
2  GJ01AB1234 added                        -> stored as "GJ 01 AB 1234" / GJ01AB1234
3  same plate passes                       -> ALERT PLATE_EXACT score 1, status NEW
                                              camera GNR-001, real snapshot path, real bbox
4  again 5s later on the same camera       -> still 1 alert, 1 suppressed as duplicate
5  again 45s later                         -> 2 alerts
6  OCR misread "GJO1AB1234" (letter O)     -> PLATE_EXACT score 1 (normalisation folded it)
7  genuinely different "GJ01AB1235"        -> PLATE_FUZZY score 0.9
8  unrelated "MH12CD9999"                  -> nothing raised
9  entry deactivated                       -> nothing raised
10 track point written                     -> at the camera's surveyed 23.2266, 72.6489
```

Through the HTTP API: organizer 403 and no-token 401 on `/watchlist`; issuer
taken from the token; four validation refusals each naming the reason; CSV
import of four rows returning `imported: 2, rejected: 2` **with the offending
line numbers and reasons**; the alert workflow moving NEW → ACKNOWLEDGED →
DISPATCHED with the first handler's name preserved on the second transition; an
invalid status rejected; and deleting a watchlist entry that has raised alerts
refused with an explanation, because deleting cascades to the alerts and loses
the record.

All test rows removed afterwards — watchlist, alerts, detections and track
points are back to 0.

### An empty console explains itself

"No alerts" means one of five very different things, and `/api/alerts/counts`
returns what tells them apart: whether the engine is running, whether it can
reach Redis, how many watchlist entries are active, and **how many detections
have actually carried a plate**. Measured here:

```
total 0 · unhandled 0 · watchlistActive 3 · platesReadable 0
engine running true · connected false · lastError "Connection is closed."
```

The console renders that as *"The match engine cannot reach Redis, so no
detections are arriving"* rather than an empty list that reads as a quiet night.
When Redis is up but no plate reader is configured it says that instead. This is
the difference between a system that is idle and one that is working — and a
judge will ask.

The navbar badge shows unhandled alerts, and is **absent** rather than showing 0
until the count is actually known.

### Deliberately not built

Face matching. `WatchlistEntry.embedding` exists and is null on every row;
nothing reads it. The person form says plainly that a person entry is a record
only and will not raise alerts, rather than accepting a photo and silently never
matching it. InsightFace and pgvector are listed as the last, bonus item and are
not in scope here.

### Not verified

The phase's acceptance test — *adding `GJ01AB1234` raises an alert within three
seconds of that plate passing a running camera* — is **unverified end to end**.
Every link is proven except the two that need infrastructure this machine cannot
run: Redis transport, and a plate actually being read. The ai-service's plate
reader is off unless `PLATE_MODEL_PATH` is set, so no real plate text has ever
entered the system. What was proven is that given a detection carrying
`GJ01AB1234`, the engine raises the correct alert against the correct camera
with the correct snapshot, in-process, against the real database.

Gate still passes. `npm run build` exits 0; both `tsc --noEmit` exit 0.

---

## 13. Phase 6 — cross-camera vehicle tracking

The graded test case. A trail is the sequence of cameras that saw a vehicle, in
time order, with the links between them classified and never blurred.

### A trail is not a GPS track, and says so

Every position on the map is the **camera's** surveyed coordinate, because
nothing in this system can place a vehicle within a field of view. That sentence
travels with the data: it is on the `TrackPoint` model, returned by the API as
`trailNote`, printed on the page, and carried into the exported PDF. A reader who
only ever sees the PDF still learns what the route is and is not.

Cameras in a trail that were never surveyed are **named** in `unmappableCameras`
rather than silently dropped, so a route missing a leg says so instead of looking
complete.

### Two link types, and no third

| | When | Score |
|---|---|---|
| `CERTAIN` | the same normalised plate was read at both ends | **null** — nothing was inferred, so there is nothing to score |
| `PROBABLE` | no plate at one end; linked on colour, type and whether the journey is physically possible | computed, and capped |

A link is **rejected outright** when the plates differ, when colour or type
disagree (both are measured from the frame, so a mismatch is evidence *against*),
when either camera is unsurveyed, or when the implied speed is impossible.

**Straight-line distance is used deliberately, and only in the direction it is
valid.** It is a lower bound on road distance, so the implied speed is a lower
bound on the real one: if even that exceeds 150 km/h, no vehicle could have made
the journey and the link is impossible. It can rule a link out; it never rules
one in on its own. The reasoning string says this on every inferred link.

**An inferred link is capped at 0.85.** The first implementation let a perfect
agreement score 1.0, and *"PROBABLE — 100%"* reads as certainty, which is the one
thing an inferred link must never do. Colour, type and plausible timing narrow a
link down; they cannot identify a vehicle, because another white car of the same
type could have made the same journey. Only a plate identifies, and that path
returns no score at all.

Every inferred link returns its components — `colorMatch`, `typeMatch`,
`straightLineMetres`, `secondsApart`, `impliedKmh` — alongside the number, and
the page and the PDF both print the reasoning. The single score is a ranking aid,
and nobody has to take it on trust.

### A flaw found by testing, not by reading

The first version made the `PROBABLE` path **unreachable**. `getTrailByPlate`
filters on `plateNormalised`, so a query could only ever return rows that carry
the plate — a leg where the plate went unread was invisible, and the route
silently jumped over it. The classifier was correct and could never run.

`threadProbableSightings` now offers plateless detections that fall *between*
two confirmed sightings to the same classifier, keeping one only if it links both
backwards and forwards. Bounded at 200 candidates per gap so a busy hour cannot
turn one query into thousands of comparisons.

Verified on a seeded four-camera journey where the third leg had no plate:

```
1. 14:57:16  GNR-001  Ch-0 Circle North Approach    plate GJ 01 AB 1234
2. 15:00:16  GNR-005  Mahatma Mandir Main Gate      plate GJ 01 AB 1234
3. 15:05:56  GNR-014  Infocity Circle               plate (not read)     <- threaded in
4. 15:08:16  GNR-017  Indroda Park Gate             plate GJO1AB1234

CERTAIN   score n/a     634m / 180s = 12.7 km/h
PROBABLE  score 0.772  8766m / 340s = 92.8 km/h
PROBABLE  score 0.52   5228m / 140s = 134.4 km/h
```

The scores falling as the implied speed becomes less plausible is the scoring
working, not a defect in it.

### Verified by hand

Link classification, in isolation: same plate at both ends → CERTAIN with a null
score; an `O`-for-zero misread still CERTAIN; two different plates → no link;
plateless with matching colour and type → PROBABLE; three seconds apart → refused
as impossible; colour differing → refused; type differing → refused; an
unsurveyed camera → refused; and every PROBABLE score strictly below 1.

Through the API: the trail above answered in **437 ms**, and **1,255 ms** with
probable threading — both well inside the five-second done-condition. The same
vehicle is found by `gj01ab1234`, `GJ-01-AB-1234` and `GJO1AB1234`, all
normalising to `GJ01AB1234`, through the same function the match engine uses.
Facets return only values that actually occur. A plate of `---` is refused with
*"contains no letters or digits to search on"*. An organizer gets 403.

All seeded rows removed afterwards; detections, track points, alerts and
watchlist are back to 0, and the 60-camera estate is untouched.

### The PDF export

`generateVehicleTrailPDF` was **added alongside** `generatePDFReport` rather than
routed through it. That function renders a post-event safety report — its cover
page says so, and its data shape requires an attendance figure and a safety
score. Forcing a vehicle trail through it would have meant inventing both. The
new export shares the module's jsPDF setup and visual language, prints the
sighting table, and gives every inferred link its own paragraph of reasoning,
because a "probable" row in a table is not evidence on its own.

### Detection search

`EventSearch` filters by camera, class, plate, colour and time range, with
snapshots and CSV export of exactly the rows on screen — not the whole matching
set, so the file cannot claim more than was fetched. Filter dropdowns are built
from values that actually occur, so an empty dropdown means nothing has been
recorded.

Every response carries `samplingNote`. The detections table is a sample — one row
per camera-track per interval, plus every plate-bearing detection — and "247
results" must never read as "247 times this vehicle was seen".

### Not verified

The done-condition names *any vehicle in the sample footage*. There is no sample
footage on this machine, no plate reader configured, and no Redis, so **no
detection in any of this originated from a real frame**. What is proven is that
given detections in the database, the trail is built correctly, ordered
correctly, classified correctly and returned in about a second. The link from
real video to a real plate row remains the same unverified gap as in Phases 3
and 5. There was again no browser click-through.

Gate still passes. `npm run build` exits 0; both `tsc --noEmit` exit 0.

---

## 14. Phase 7, and role-by-role verification in a browser

The first session in which the Chrome extension was connected, so every earlier phase's "no
click-through" caveat is now discharged for the UI. Docker's daemon was still down, so MediaMTX,
Redis and the analytics service still did not run — those caveats stand.

### Four defects that reading the code would not have found

**1. Privilege escalation — the serious one.** `POST /api/auth/register` granted whatever role the
body asked for. Anyone could register as `police` or `admin` and immediately reach the entire camera
estate, the watchlist, alerts, dispatch and vehicle tracking. Found by registering a test admin
during role verification and noticing it simply worked.

Registration now accepts only `participant` and `organizer`, and **refuses** anything else with a
403 rather than silently downgrading — someone who asked for an operator account needs to know they
did not get one. `PATCH /api/users/:id/role` is the only path to a privileged account, is
admin-only, and refuses to let an administrator strip their own role while signed in as it.

```
before   requested police -> granted role: police
         requested admin  -> granted role: admin
after    police 403 · admin 403 · organizer 201 · participant 201
```

**2. A hardcoded safety claim, shown to the people most likely to act on it.** The participant
dashboard rendered `Safe` / `All systems clear` as two fixed strings in the markup, on every
account, whatever was happening. **The mock gate could never have caught this** — no banned word
appears in it, which is worth remembering about the gate's limits.

It now reports open incidents across the events that person is actually registered for, and
distinguishes four states: no registered events, checking, could not check, and a real count.
Verified after registering for an event: *"No open incidents — Across 1 registered event"*.

**3. Live monitoring asserted an empty venue.** Crowd level rendered `0%` when nothing had been
measured. Zero is a claim that the venue is empty; "no reading yet" is a different statement. Both
density tiles now hold null until a `CrowdDensity` row exists and render a dash. The admin
dashboard's response-time tile also carried an `Optimal` subtitle whatever the value — including
when there was no value — and now states what the number is instead.

**4. Three navigation entries were unreachable.** Nine police entries overflowed a container whose
scrollbar is deliberately hidden (`no-scrollbar`), so Camera Registry, Camera Map and Live Wall
could not be seen or clicked. Measured rather than eyeballed: **668 px of items in a 566 px box**.

The three surveillance pages cross-link each other, so the nav now carries one entry into that
group; the user's name yields to the navigation below `xl`; and admin gained the police routes it
could already reach by URL but could not navigate to. After: 668 in 668, `overflowing: false`.

### A missing implementation, now built

The spec's organizer journey is *create event → define zones → **assign registry cameras** → live
monitoring*. There was no way to assign a registry camera to an event: Event Setup only let an
organizer type camera details by hand.

`PUT /api/surveillance/cameras/:id/assignment` and the `EventCameras` page close it. Authorisation
is in the service rather than the middleware, because middleware cannot see which event is being
targeted: an organizer may assign only to an event they own, and release only from an event they
own. Both bypass attempts were tested and return 403 with the reason.

### Snapshot fallbacks

Two of the three pages that show snapshots had no `onError`, so an unreachable file rendered a
broken image with alt text where a photograph should be. The third injected markup on every failed
load and could stack duplicates. All three now use the same declarative fallback reading
*"recorded, not served here"*.

### Walked in the browser

| Role | Path |
|---|---|
| Police | login → estate overview → alerts → **watchlist: added `GJ 01 AB 1234` through the form** → alert raised and **acknowledged** → vehicle trail → detection search → dispatch → registry → map → live wall |
| Organizer | login → **created "Gandhinagar Navratri Mahotsav" with 3 zones** → **assigned 3 Mahatma Mandir cameras from the registry** → live monitoring → crowd flow → anomaly → emergency dispatch → pre-safety → AI summaries → post-event |
| Participant | **registered through the form** → dashboard → explore events → **registered for the event** → dashboard reflects it |
| Admin | dashboard → user statistics → **granted and revoked a role** |

Every figure checked against the database. The admin dashboard now reads **14 users** where it once
claimed 2,124, **0/60 cameras online** where it claimed a 94.5 safety score, and **Mean response —**
where it claimed 98% system health.

### Authorisation matrix, measured

```
route                              no token   organizer   police
/surveillance/cameras                 401        200        200
/surveillance/stats                   401        200        200
/watchlist                            401        403        200
/alerts/counts                        401        403        200
/tracking/detections                  401        403        200
/tracking/facets                      401        403        200
/dispatch/units                       401        200        200
/users/stats                          401        403        403   (admin only)
```

### Performance, in the browser

```
/api/alerts        963 ms      /api/alerts/counts   123 ms
/api/watchlist     239 ms      /api/tracking/plate  1,120 ms
/api/surveillance/cameras  1,393 ms
vehicle trail, end to end, as the page measured it:  632 ms
```

A first page load took about nine seconds; that is Vite dev-mode module loading plus a cold
connection, not the API.

### One thing that is not a defect

Synthesised coordinate clicks from the automation frequently failed to reach buttons on these pages.
This was checked rather than assumed: `document.elementFromPoint` at the button's centre returns the
button itself, and a dispatched click sequence at the same coordinates works. A real user's click
lands. The failures are an artifact of the automation against this app's layered `fixed` overlays.

### Phase 7 artefacts

`docs/HLD.md`, `docs/SECURITY.md`, `docs/SCALE-80K.md`, `docs/COST-BENEFIT.md`,
`docs/DEMO-SCRIPT.md`, `README-SENTINEL.md`.

Two deliberate choices in them. `SCALE-80K` separates measured figures from assumed ones and states
that the GPU sizing is an assumption no procurement should rest on. `COST-BENEFIT` states the
**AGPL-3.0 obligation on Ultralytics YOLO** as a decision to make before procurement, not after —
a submission that quoted a zero licence cost without it would be misleading.

### State after this pass

```
npm run verify   PASS — 0 occurrences (9 allowlisted)
npm run build    exit 0, both packages
```

Test data removed: the injected detections, track points and alerts did not come from a frame, so
they were deleted. What was kept is what an operator genuinely created through the UI — the event,
its zones, its three assigned cameras, and the watchlist entry.

**Still unverified, and unchanged from earlier phases:** no detection in this system has ever
originated from a real video frame. MediaMTX, Redis and the analytics service could not run here.
That single gap is what a pilot has to close first.
