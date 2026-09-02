# Drishti — High-Level Design

Gujarat Police Innovation Challenge 2026 · Model 1 (standalone camera registry) plus a
hybrid event-safety layer.

---

## 1. What this system is

Drishti began as an event-safety platform for organizers: define a venue's zones, watch crowd
density, report incidents, dispatch responders. This submission keeps that product intact and
adds the jurisdiction-wide surveillance layer the challenge asks for — a camera registry that
exists independently of any event, live streams, detection, watchlist matching and cross-camera
vehicle tracking.

The two halves share one database, one authentication system and one set of cameras. An event
does not own cameras; it borrows them from the estate registry.

### The rule the architecture is built around

> Every number a user sees is derived from a real detection, a real database row, or a real
> computation. Where a real value does not exist yet, the interface says so.

This is enforced mechanically. `scripts/check-no-mocks.sh` fails the build on fabricated data
outside a three-entry allowlist (particle animation, identifier generation, an upload filename),
and `npm run verify` runs it alongside both type-checks. It currently passes with zero
occurrences, down from 76 at the start of the work.

---

## 2. Components

```
                    ┌──────────────────┐
   RTSP ×N          │    MediaMTX      │  loops sample clips as N RTSP paths,
   (or real  ──────▶│  (stream layer)  │  republishes each as HLS + WebRTC
    cameras)        └────────┬─────────┘
                             │ RTSP
                             ▼
                    ┌──────────────────┐
                    │   ai-service     │  Python 3.11 · FastAPI · YOLOv8 + ByteTrack
                    │  one asyncio     │  plate detect + OCR · zone occupancy
                    │  worker / camera │
                    └────────┬─────────┘
                             │ Redis Streams  (drishti:detections, drishti:camera-status)
                             ▼
   ┌─────────────────────────────────────────────────┐
   │              backend (Express + TS)             │
   │                                                 │
   │  detectionConsumer ──▶ CrowdDensity ──▶ rules   │
   │       (group: drishti-backend)                  │
   │  matchEngine ──▶ Detection · TrackPoint · Alert │
   │       (group: drishti-match)                    │
   │  cameraHealth poller ──▶ CameraHealth           │
   │  anomalyRules ──▶ Incident                      │
   │  dispatch ──▶ DispatchAssignment                │
   │                                                 │
   │  REST /api/*        Socket.IO (same HTTP server)│
   └───────────────┬─────────────────────────────────┘
                   │                    ▲
                   ▼                    │ JWT
          ┌─────────────────┐           │
          │   PostgreSQL    │    ┌──────┴───────┐
          │   (Prisma)      │    │   frontend   │  React 18 · Vite · Tailwind
          └─────────────────┘    │  React Router│  react-leaflet · hls.js
                                 └──────────────┘
```

Two independent Redis consumer groups read the same detection stream. A stall in crowd-density
writing cannot hold up watchlist matching, and vice versa.

---

## 3. Data flow, end to end

A vehicle passes a camera:

1. **MediaMTX** publishes the camera's RTSP path.
2. **`ai-service`** decodes every Nth frame (default 3), runs YOLOv8 detection with ByteTrack
   association, computes zone occupancy by ray-casting the detection centres against the zone
   polygons, optionally reads a plate, writes a snapshot, and publishes one event per detection to
   `drishti:detections`.
3. **`detectionConsumer`** groups the batch by frame, writes a `CrowdDensity` row per zone at most
   once per interval, and hands the new row ids to the rule engine.
4. **`anomalyRules`** evaluates `ZONE_CAPACITY_BREACH` and `CROWD_SURGE` against those readings and
   raises `Incident` rows where they fire.
5. **`matchEngine`**, on its own consumer group, persists a sampled `Detection`, writes a
   `TrackPoint` at the camera's surveyed position, normalises any plate and compares it against
   active watchlist entries, raising an `Alert` on a match.
6. **Socket.IO** pushes `crowd:density`, `incident:new` and `alert:new` to the estate room and the
   relevant event room.
7. The **police console** and the **organizer's monitoring pages** update.

Independently of all this, the **camera health poller** opens a socket to each camera every 30s,
speaks RTSP `OPTIONS` then `DESCRIBE`, and writes a `CameraHealth` row. A transition to OFFLINE
raises a `CAMERA_OFFLINE` incident.

### Detection event contract

Both sides depend on this exact shape (`ai-service/contracts.py`):

```json
{
  "cameraId": "GNR-014", "ts": "2026-09-10T11:04:22.310Z",
  "trackId": 42, "class": "car", "confidence": 0.91,
  "bbox": [x, y, w, h],
  "attributes": { "plateText": "GJ01AB1234", "plateConfidence": 0.87,
                  "color": "white", "vehicleType": "car" },
  "zoneOccupancy": { "<zone-uuid>": 14 },
  "snapshotPath": "/snapshots/GNR-014/1757502262310.jpg"
}
```

A field with no measured value is `null`, never a plausible default. `zoneOccupancy` is `{}` when
the worker cannot place boxes in zones — which is not the same as every zone being empty.

---

## 4. Entity model

```
User ─┬─< Event ─┬─< Zone ──────< CrowdDensity >── Camera
      │          ├─< Incident >── DispatchAssignment >── DispatchUnit
      │          └─< EventRegistration
      └─< WatchlistEntry ──< Alert >── Detection >── Camera
                                          │
Department ──< Site ──< Camera ──< CameraHealth
                          └──< TrackPoint
```

Points worth knowing:

- **`Camera.eventId` is nullable.** A registry camera belongs to no event. Because Postgres treats
  NULLs as distinct, `@@unique([eventId, cameraId])` does not constrain registry cameras; a partial
  unique index (`WHERE "eventId" IS NULL`) does, and the service mirrors the rule so the caller gets
  a readable message.
- **Every foreign key is the UUID, never the human-facing identifier.** `CrowdDensity.zoneId` →
  `zones.id`, not `Zone.zoneId`. Getting this wrong is what made every crowd-density write fail
  before the audit.
- **`Incident.reporter` is nullable** only so the rule engine can raise one without attributing it
  to a person. A manual report always carries the reporter from the verified token.
- **`TrackPoint.lat/lng` is the camera's surveyed position**, not the object's. Nothing here can
  place a vehicle within a field of view.

---

## 5. API surface

All routes require a JWT except `POST /api/auth/{register,login}` and `GET /api/events`.

| Prefix | Roles | Purpose |
|---|---|---|
| `/api/auth` | — | register (participant/organizer only), login, profile |
| `/api/users` | admin | list, read, update, delete, `PATCH /:id/role` |
| `/api/events` | organizer, admin | event CRUD, registration |
| `/api/incidents` | authenticated | report, list, update status |
| `/api/monitoring` | organizer, admin, police | live view, crowd flow, anomalies for one event |
| `/api/crowd-analysis` | authenticated | archived-footage upload, density reads |
| `/api/surveillance` | admin, police (read: + organizer) | camera registry, stream URLs, health, assignment |
| `/api/dispatch` | admin, police | incident queue, unit assignment |
| `/api/watchlist` | admin, police | watchlist CRUD, CSV import |
| `/api/alerts` | admin, police | alert feed, counts, workflow |
| `/api/tracking` | admin, police | vehicle trail, detection search, facets |

Response envelope throughout: `{ success, data }` or `{ success: false, message }`.

---

## 6. Integration strategy

**Model 1 is the base.** The camera registry is standalone: departments, sites, cameras with GIS,
health history. Nothing in it depends on an event existing. A district could deploy only that.

**The event layer is additive.** An organizer borrows registry cameras for the duration of an event
(`PUT /api/surveillance/cameras/:id/assignment`), and the borrowing is authorisation-checked: an
organizer may only assign to an event they own, and may only release a camera currently on one of
their events.

**Existing installations.** Cameras are addressed by URL, so an existing VMS that can publish RTSP
needs no change: point `rtspUrl` at it. ONVIF fields (`onvifUrl`, credentials) are stored for
devices that support discovery and PTZ. The health poller speaks plain RTSP and HTTP, including
RFC 2617 digest auth, so it works against real cameras without a vendor SDK.

---

## 7. Deployment topology

```
docker compose up -d
  postgres     5434 → 5432   Postgres 15
  redis        6379          streams + cache
  mediamtx     8554 RTSP · 8888 HLS · 8889 WebRTC · 9997 API
  ai-service   8100          FastAPI, one asyncio worker per camera
  backend      5001          Express + Socket.IO
  frontend     built static assets
```

For a district deployment the same compose file scales out: `ai-service` replicas pinned to GPUs,
`backend` behind a load balancer with Socket.IO sticky sessions or a Redis adapter, Postgres with a
read replica for the search endpoints. See `docs/SCALE-80K.md`.

---

## 8. What is not built

Stated plainly because a design document that omits its gaps is not a design document.

- **Face matching.** `WatchlistEntry.embedding` exists and is null on every row. The person form
  says a person entry is a record only. InsightFace + pgvector were scoped as the last, optional
  item.
- **Road-distance ETA.** `DispatchAssignment.etaSeconds` stays null and the console says
  "ETA unavailable". Straight-line distance is shown, labelled as such. A real ETA needs OSRM.
- **Observed frame rate.** `CameraHealth.fpsObserved` is null: the health probe does not decode
  video, and only a decoder can report a frame rate honestly.
- **PTZ control.** `isPtz` is recorded; nothing drives the motor.

See `docs/AUDIT.md` for what has and has not been verified end to end.
