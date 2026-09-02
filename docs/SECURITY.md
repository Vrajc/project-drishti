# Drishti — Security

A camera estate is a surveillance system. The threat model is not "someone defaces the website"; it
is "someone watches a city, or learns where a vehicle went". This document states what is protected,
what is not yet, and where the boundary is.

---

## 1. Authentication and roles

One JWT-based system, used by every route and by the Socket.IO gateway. There is no second auth
path.

| Role | Sees |
|---|---|
| `PARTICIPANT` | events they can register for, their own registrations, incidents they report |
| `ORGANIZER` | their own events; reads the camera registry to borrow cameras for them |
| `POLICE` | the whole estate: registry, live wall, watchlist, alerts, dispatch, vehicle tracking |
| `ADMIN` | everything, plus user administration |

Tokens carry `{ userId, role }` and nothing else. Every handler that needs an identity takes it
from the verified token, never from the request body — the incident reporter, the watchlist issuing
officer, the alert acknowledger and the camera assignment actor are all established this way.

### Privilege escalation, found and closed

Public registration used to grant whatever role was asked for. Anyone on the internet could
register as `police` or `admin` and immediately reach the entire camera estate, the watchlist,
dispatch and vehicle tracking. This was found during role-by-role verification and fixed:

- `POST /api/auth/register` accepts **only** `participant` and `organizer`, and **refuses** anything
  else with a 403 rather than silently downgrading it — someone who asked for an operator account
  needs to know they did not get one.
- `PATCH /api/users/:id/role` is the only path to a privileged account, and is admin-only.
- An administrator cannot remove their own admin role while signed in as it, so a deployment cannot
  be locked out by a single click.

### Authorisation is checked where the facts are

Route middleware can only see the role. Anything that depends on *which* record is being touched is
checked in the service, because middleware cannot know:

- `GET /api/users/:id` — self, or admin. Without this, any authenticated user could enumerate the
  user table by id.
- `PUT /api/surveillance/cameras/:id/assignment` — an organizer may attach a camera only to an event
  they own, and may release one only from an event they own. Verified: both attempts against another
  organizer's event return 403 with the reason.
- `DELETE /api/users/:id` — refuses to delete an organizer whose events would cascade with them.
- Socket.IO — the estate room admits only `admin` and `police`; an event room is joined per event.

---

## 2. Encryption

**In transit.** TLS terminates at the reverse proxy in front of the backend and the frontend. The
internal compose network is not exposed. RTSP between MediaMTX and the analytics service stays on
that network; for real cameras across a WAN, RTSPS or a site-to-site VPN is required — plain RTSP
over an untrusted link exposes both the credential and the video.

**At rest.** Postgres volume encryption at the host, plus one application-level secret:

Camera stream credentials cannot be hashed, because they have to be replayed to the device. They are
encrypted with **AES-256-GCM** under `CAMERA_CREDENTIAL_KEY`, stored as `iv:tag:ciphertext`, and
**never leave the server** — `formatCamera()` strips `passwordEnc` and the client is told only
`hasCredentials: true`.

If the key is not configured, the API **refuses to store a credential** rather than writing it in
plaintext. Verified: two encryptions of the same secret differ (random IV per write), decryption
round-trips, and a tampered ciphertext is rejected by the GCM authentication tag rather than
returning garbage.

Passwords are bcrypt with a per-user salt, and `password` is never in a `select`, so it cannot leak
through an object spread.

---

## 3. Credential vaulting

`CAMERA_CREDENTIAL_KEY` is a 32-byte key supplied through the environment. For production it should
come from a KMS or vault rather than a file, and rotating it requires re-encrypting stored
credentials — the decrypt path reports a decryption failure explicitly rather than treating it as
"no password", so a rotation that misses rows is visible in the health sweep as
*"the stored credential could not be decrypted"* rather than as a silent authentication failure.

---

## 4. Audit trail

- **`SystemLog`** — action, user, event, description, metadata, IP.
- **`CameraHealth`** — one row per probe. A row exists only if a probe actually happened, so the
  table is evidence of what was checked and when, not of what was assumed.
- **`Alert.acknowledgedBy` / `acknowledgedAt`** — stamped the first time a human touches an alert
  and never overwritten, so the trail records who took responsibility, not who most recently
  clicked.
- **`WatchlistEntry.issuedBy` / `caseNumber` / `caseType` / `issuedAt` / `expiresAt`** — a watchlist
  entry is a legal act and records one. An expired entry stops matching automatically.
- **Role changes** are logged with the actor.
- **`Incident.reporter` is null only for `source: ANOMALY`**. Attributing a machine-raised incident
  to a person would be a lie in the audit trail.

---

## 5. Network segmentation

```
  Public          │  DMZ                    │  Camera VLAN         │  Data
  ────────────────┼─────────────────────────┼──────────────────────┼──────────────
  operator        │  reverse proxy (TLS)    │  cameras (no egress) │  Postgres
  browsers        │  frontend static        │  MediaMTX            │  Redis
                  │  backend + Socket.IO    │  ai-service          │
```

Cameras should have no route to the internet and no inbound route from the operator network — only
the stream layer talks to them. The analytics service needs the camera VLAN and Redis, and nothing
else. Postgres and Redis accept connections only from the backend and the analytics service.

The `10.42.x.x` addresses in the demo seed are a private plan, deliberately not routable.

---

## 6. CCTV-specific threats

| Threat | Mitigation | Status |
|---|---|---|
| Default camera credentials | credentials stored encrypted per camera; health probe reports `401` explicitly as *"requires authentication and no credential is stored"* | done |
| Stream hijack / replay | cameras on an isolated VLAN; RTSPS or VPN for WAN links | design |
| A camera silently going dark | health poller probes every 30s and raises a `CAMERA_OFFLINE` incident; `lastSeenAt` is the last time the camera was genuinely *reached*, so it cannot drift | done |
| False identification of a vehicle | plate normalisation folds only four OCR confusions; a fuzzy match is labelled *probable* and capped below certainty; the alert always links the frame it was made on | done |
| Fabricated evidence in the interface | every snapshot is a real file path; a path that cannot be served reads *"recorded, not served here"* rather than showing nothing; no bounding box is drawn that is not a stored `bbox` | done |
| Operator over-trusting an inference | an inferred cross-camera link states its components — colour, type, distance, elapsed time, implied speed — so the inference can be checked, not just trusted | done |
| Snapshot disclosure | snapshots are on a private volume; `VITE_SNAPSHOT_BASE_URL` is blank by default, so they are not exposed to browsers until someone deliberately serves them behind auth | done |
| Unauthorised watchlist changes | admin/police only; deleting an entry that has raised alerts is refused because it would destroy the record | done |

---

## 7. Indian regulatory notes

**IT Act 2000, s.43A and s.72A** — reasonable security practices for sensitive personal data, and
liability for disclosure without consent. Face images and vehicle registrations linked to a person
are sensitive. The controls above (encryption at rest for credentials, RBAC, audit trail, network
segmentation) are the substance of "reasonable security practices"; a deployment also needs a
documented information-security policy under ISO 27001 or equivalent.

**DPDP Act 2023** —

- *Lawful basis.* Processing here is by the State for the prevention and investigation of offences.
  s.17(1)(c) exempts such processing from several obligations, but **not** from the requirement to
  hold data securely and only for as long as needed.
- *Purpose limitation.* The watchlist enforces it structurally: every entry carries a case number,
  a case type and an issuing officer, and expired entries stop matching.
- *Storage limitation.* Retention is explicit and configurable rather than unbounded:
  `CAMERA_HEALTH_RETENTION_HOURS` (24), `SNAPSHOT_RETENTION_PER_CAMERA` (500),
  `STREAM_MAXLEN` (100,000). Detections are sampled rather than exhaustive, and the sampling rule is
  stated wherever the table is served.
- *Data minimisation.* Person detections are aggregated into zone counts; individual person
  detections are not retained as identifiable records, and no face embedding is computed or stored.
- *Accuracy.* An inferred vehicle link is never presented as certain. This matters legally as well
  as ethically: an officer acting on a "probable" link must be able to see it is probable.

**Public notice.** Deployments must display CCTV signage as required by local rules. That is an
operational obligation this software cannot discharge.

---

## 8. Known gaps

- No rate limiting on `POST /api/auth/login`. Brute-force protection belongs at the reverse proxy or
  as express-rate-limit before production.
- JWTs are not revocable before expiry (7 days). A compromised token stays valid; shortening the
  expiry and adding a refresh flow is the fix.
- `JWT_SECRET` falls back to a development default if unset. Production must set it; the deployment
  checklist should fail the boot if it is absent.
- CORS allows any origin when `NODE_ENV=development`. Production must set `FRONTEND_URL`.
- Snapshots are written unencrypted to a volume. Encrypting that volume is a host-level task.
