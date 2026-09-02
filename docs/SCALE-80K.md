# Scaling to 80,000 cameras

Gujarat has roughly 33 districts. 80,000 cameras is about **2,400 per district**, though the real
distribution is heavily skewed toward Ahmedabad, Surat, Vadodara and Rajkot.

Every figure below is either measured on this build or derived from a stated assumption. Where a
number is an assumption, it says so.

---

## 1. What was actually measured

On the development machine (CPU only, no GPU, remote Postgres):

| Measurement | Value | How |
|---|---|---|
| RTSP health probe | **9–23 ms** per camera | 56 cameras, real sockets |
| Health sweep, 56 cameras | **1,481 ms** | after batching the writes |
| Health sweep before batching | 25,470 ms | 56 sequential transactions |
| Vehicle trail query | **437 ms** (632 ms in-browser) | 4 sightings across 4 cameras |
| Trail with probable threading | **1,255 ms** | includes the gap-filling queries |
| Camera list, 25 rows | 1,393 ms | remote Postgres, cold |
| Alert list with joins | 963 ms | 3 alerts, full include |

**Not measured:** inference throughput. No GPU and no sample footage were available, so the
frames-per-GPU figures below are vendor-published figures for YOLOv8n at 640×640, clearly marked as
assumptions. They must be re-measured on the target hardware before any procurement decision.

---

## 2. Edge versus central inference

| | Central | Edge | Hybrid *(recommended)* |
|---|---|---|---|
| Bandwidth to core | full video, ~2 Mbps × 80,000 = **160 Gbps** | detections only, ~1 kbps × 80,000 = **80 Mbps** | ~2 Gbps (metadata + on-demand video) |
| GPU location | district data centres | at or near the camera | district DCs, edge for high-value sites |
| Failure domain | a DC outage blinds a district | one box blinds a handful | degraded, not blind |
| Cost per camera | lower compute, ruinous transport | higher compute, cheap transport | balanced |
| Retrofit | works with any existing stream | needs hardware at each site | works with what exists, upgrades where it pays |

**Recommendation: hybrid.** Central inference is what this architecture already does, and it is
correct for the ~70% of cameras already backhauled to a district control room. Edge inference
belongs where transport is expensive or the site matters enough to survive a WAN cut — border
posts, major junctions, stadium approaches.

The software does not change: `ai-service` is a container that reads RTSP and publishes to Redis. At
the edge it runs on a Jetson beside the camera and publishes to the district Redis; centrally it
runs in the DC. Same contract either way.

---

## 3. Streams per GPU

*Assumption, not measured here.* YOLOv8n at 640×640, FP16, with the frame stride this build already
uses (every 3rd frame ≈ 8 inferences/second/camera at 25 fps):

| GPU | Inferences/s (assumed) | Cameras at 8 inf/s | With decode overhead (~30%) |
|---|---|---|---|
| Jetson Orin NX 16 GB | ~250 | 31 | **~22** |
| RTX A2000 12 GB | ~700 | 87 | **~60** |
| L4 24 GB | ~1,600 | 200 | **~140** |
| A100 40 GB | ~4,000 | 500 | **~350** |

Decode is the hidden cost: 60 simultaneous H.264 decodes saturate NVDEC before the tensor cores are
busy. The frame stride is the main lever — it is an env var (`FRAME_STRIDE`), so a district under
pressure can halve its load without a redeploy, at the cost of temporal resolution.

**GPUs per district (2,400 cameras):**

- L4 at ~140 cameras each → **18 GPUs**, say 5 servers with 4 GPUs
- A100 at ~350 each → **7 GPUs**, 2 servers

L4 is the better buy: cheaper per stream, lower power, and failure of one card costs 140 cameras
rather than 350.

**State-wide:** ~570 L4-class GPUs across 33 districts. Skewed: Ahmedabad might need 60, a small
district 4.

---

## 4. Bandwidth

**Camera to inference** (the expensive leg, and why edge exists):

- 1080p H.264 at 2 Mbps: 80,000 × 2 Mbps = **160 Gbps** if everything is centralised
- Per district (2,400): **4.8 Gbps** — a 10 GbE aggregation link, which is ordinary

**Inference to core** (detections only): one detection event is ~400 bytes JSON. At 8 events/s for
an active camera and maybe 20% of cameras active at once:

- 80,000 × 0.2 × 8 × 400 B ≈ **512 Mbps** state-wide
- Per district ≈ **15 Mbps**

That asymmetry — 4.8 Gbps in, 15 Mbps out — is the entire argument for district-level inference.

**Operator video** is on demand: HLS pulled only for cameras actually on screen. A 25-tile wall at
2 Mbps is 50 Mbps per operator.

---

## 5. Storage and retention

Per camera per day, with this build's current settings:

| Data | Volume | Basis |
|---|---|---|
| `CameraHealth` | 2,880 rows ≈ 350 KB | one probe per 30s, pruned at 24h |
| `CrowdDensity` | ~8,600 rows ≈ 1.5 MB | one row per zone per 10s |
| `Detection` (sampled) | ~9,000 rows ≈ 3 MB | one per track per 10s, plus every plate |
| `TrackPoint` | ~17,000 rows ≈ 2 MB | one per track per 5s |
| Snapshots | 500 files ≈ 25 MB | capped per camera |
| Video, if recorded | ~21 GB | 2 Mbps continuous |

**Metadata only: ~7 MB/camera/day → 560 GB/day state-wide → ~200 TB/year.** Manageable.

**Video is the problem: 21 GB/camera/day → 1.7 PB/day.** Which is why the tiering matters:

| Tier | Retention | Where | State-wide |
|---|---|---|---|
| Hot — live + last 72 h video | 3 days | district NVMe | ~5 PB |
| Warm — snapshots, detections, tracks | 90 days | district HDD | ~60 TB |
| Cold — alerts, incidents, case-linked video | 1 year+ | state object storage | ~200 TB |
| Legal hold — anything attached to a case | indefinite | immutable | small |

Continuous video retention should be a **district-level policy decision**, not a default. Under DPDP
storage limitation, keeping 1.7 PB/day of everything is difficult to justify; keeping metadata plus
event-triggered video is far easier to defend and 30× cheaper.

---

## 6. Bus throughput

Redis Streams at peak: 80,000 cameras × 20% active × 8 events/s = **128,000 events/s** state-wide,
**~4,000/s per district**.

A single Redis instance handles 100k+ XADD/s, so per district this is comfortable. The consumer side
is the constraint, and this build already has the shape for it: independent consumer groups, so
`detectionConsumer` and `matchEngine` scale separately, and each can run multiple consumers in the
same group.

The measured lesson applies at scale: **the write path, not the compute, is the bottleneck.**
Batching the health sweep gave a 17× improvement. The same batching is applied to density writes
(`createManyAndReturn`), and detection persistence is sampled rather than exhaustive precisely
because writing every detection would be tens of millions of rows per district per day.

Streams are capped (`STREAM_MAXLEN`) so a stalled consumer degrades to dropped events rather than an
out-of-memory Redis — and dropped events are counted and reported, never silently buffered and
replayed later as though live.

---

## 7. Disaster recovery

| Failure | Effect | Recovery |
|---|---|---|
| One camera | that camera OFFLINE within 30s, `CAMERA_OFFLINE` incident raised | operational |
| One `ai-service` worker | its cameras stop producing detections; state shows DEGRADED with the reason | restart, backoff already built in |
| Redis down | detections dropped and counted; health poller and all UI reads keep working | reconnect loop with exponential backoff; the gap is visible in the charts, not filled |
| Postgres primary | writes fail, reads serve from replica | streaming replication, promote; RPO ~seconds, RTO ~minutes |
| District DC | that district blind | cameras buffer at the edge where deployed; neighbouring district can take streams if bandwidth allows |
| State core | districts keep operating; state-wide search unavailable | district autonomy is the design goal — nothing in the district path depends on the core |

**Districts must be autonomous.** A district's cameras, inference, Redis and Postgres are all local;
the core aggregates. This is why the compose file is the district unit rather than the deployment
unit.

---

## 8. Phased rollout

| Phase | Scope | Duration | Purpose |
|---|---|---|---|
| **0 — Pilot** | 50 cameras, Gandhinagar | 4 weeks | Measure what this document assumes: real inference throughput, real plate accuracy on Gujarat plates in Gujarat lighting, real bandwidth. **Nothing scales until these are measured.** |
| **1 — One district** | 2,400, Gandhinagar | 3 months | Prove the district unit end to end: GPU sizing, retention, operator workflow, DR drill |
| **2 — Metros** | ~25,000 across 4 cities | 9 months | The hard case: density, traffic, existing VMS integration |
| **3 — State** | remaining ~52,000 | 18 months | Repeat the district unit 29 times |
| **4 — Federation** | state-wide search | ongoing | Cross-district vehicle tracking, shared watchlist |

Phase 0 exists because this document contains assumptions. The measured numbers here — probe
latency, sweep duration, query times — are real. The inference numbers are not, and no procurement
should rest on them.
