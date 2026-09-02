# Cost and benefit

All figures in INR. Hardware and licence prices are **2026 list-price estimates for planning**, not
quotations — they must be replaced with tendered prices before any procurement decision. Where a
number comes from this build rather than an estimate, it says so.

Scope: **2,400 cameras (one district)**, scaled to 80,000 where useful.

---

## 1. What the comparison is against

A commercial VMS (Milestone XProtect, Genetec Security Center, Axis Camera Station) licensed per
camera, plus an analytics add-on licensed per camera per capability. That is the realistic
alternative, and it is what the cost of this build should be judged against.

---

## 2. CAPEX — one district, 2,400 cameras

*Excludes cameras themselves and civil works, which are common to both options.*

| Item | Qty | Unit | Total |
|---|---:|---:|---:|
| GPU server (2U, 4× L4, 512 GB, 2× Xeon) | 5 | ₹18,00,000 | ₹90,00,000 |
| Application server (backend, Redis, no GPU) | 2 | ₹6,00,000 | ₹12,00,000 |
| Database server (Postgres primary + replica) | 2 | ₹8,00,000 | ₹16,00,000 |
| Hot storage, NVMe, 3-day video (~150 TB usable) | 1 | ₹45,00,000 | ₹45,00,000 |
| Warm storage, HDD, 90-day metadata + snapshots (60 TB) | 1 | ₹9,00,000 | ₹9,00,000 |
| Network — 10 GbE aggregation, ToR switches | 1 | ₹15,00,000 | ₹15,00,000 |
| Rack, UPS, cooling | 1 | ₹12,00,000 | ₹12,00,000 |
| Integration and commissioning | — | — | ₹25,00,000 |
| **District CAPEX** | | | **₹2,24,00,000** |

**Per camera: ₹9,333.**

Software licence cost: **₹0**. Every component is open source — PostgreSQL, Redis, MediaMTX,
Ultralytics YOLO (AGPL-3.0), FFmpeg, React, Express.

> **A licensing caveat that must not be skipped.** Ultralytics YOLOv8 is **AGPL-3.0**. Deploying it
> as a network service obliges you to offer the corresponding source of the whole service to its
> users, or to buy an Ultralytics Enterprise licence. For a government deployment the practical
> options are: (a) buy the enterprise licence — budget roughly ₹8–20 lakh/year depending on scale;
> (b) publish the source; or (c) swap the detector for an Apache/BSD-licensed model such as
> RT-DETR or a self-trained one. The detector sits behind one interface (`models/detector.py`), so
> (c) is a contained change. **This is a decision to make before procurement, not after.**

---

## 3. OPEX — one district, per year

| Item | Basis | Annual |
|---|---|---:|
| Power | 5 GPU servers ≈ 1.5 kW each, plus 4 others ≈ 0.5 kW, PUE 1.6 → ~152 kW·h/day at ₹8/kWh | ₹4,44,000 |
| Bandwidth, district aggregation | 10 Gbps leased | ₹36,00,000 |
| Hardware support and warranty | 8% of CAPEX | ₹17,92,000 |
| Operations staff | 2 engineers | ₹24,00,000 |
| Storage growth | 20%/yr | ₹10,80,000 |
| Ultralytics enterprise licence *(if option (a) above)* | | ₹12,00,000 |
| **District OPEX** | | **₹1,05,16,000** |

**Per camera per year: ₹4,382.**

Five-year total cost of ownership per camera: ₹9,333 + (5 × ₹4,382) = **₹31,243**.

---

## 4. Against a commercial VMS

| | Commercial VMS | This build |
|---|---:|---:|
| VMS base licence, per camera | ₹8,000–15,000 one-off | ₹0 |
| Analytics add-on (ANPR), per camera/yr | ₹3,000–6,000 | ₹0 |
| Analytics add-on (crowd), per camera/yr | ₹2,000–4,000 | ₹0 |
| Annual support, ~20% of licence | ₹1,600–3,000 | included above |
| Hardware | comparable | comparable |

**Licence cost alone, 2,400 cameras over five years:**

- Commercial: base ₹2.4–3.6 crore + analytics ₹6–12 crore = **₹8.4–15.6 crore**
- This build: **₹0**, or ₹60 lakh if the Ultralytics enterprise licence is taken

**State-wide (80,000 cameras) five-year licence saving: roughly ₹280–520 crore.**

That is the headline, and it is also the least interesting part of the comparison.

---

## 5. What is actually being traded

Licence savings are real but they are not free. An honest comparison states what is given up.

**What a commercial VMS gives you that this does not, today:**

- 24×7 vendor support with contractual SLAs
- Certified integrations with hundreds of camera models
- PTZ control, edge recording management, video export chain-of-custody tooling
- Years of field hardening on Indian plate formats and lighting
- Someone to hold accountable when it fails

**What this gives you that a commercial VMS does not:**

- **No per-camera licence, so cost does not scale with the estate.** This is the structural
  difference: adding 10,000 cameras costs hardware, not licences.
- **The data model is yours.** Cross-camera vehicle tracking, watchlist matching and crowd analytics
  query one Postgres schema. In a VMS these are separate licensed modules with their own stores.
- **No vendor lock-in on the analytics.** The detector is one interface.
- **Auditability.** Every displayed number traces to a row, and the build fails if that stops being
  true — enforced by `scripts/check-no-mocks.sh` in `npm run verify`.

**The honest recommendation:** this is not a drop-in VMS replacement for an estate that already runs
one. It is a strong choice for a greenfield analytics layer *over* existing cameras — including
cameras already managed by a VMS, since it only needs an RTSP URL. The realistic deployment keeps
the VMS for recording and uses this for analytics, which also removes the most expensive line item
(the per-camera analytics add-on) without touching the recording chain.

---

## 6. Benefit, and how to measure it

Claims about "crimes prevented" are unmeasurable before deployment, so this section states what to
*measure* rather than what to promise.

| Metric | Baseline today | How this build measures it |
|---|---|---|
| Time to detect a camera fault | manual, often days | `CameraHealth` transition timestamp — **measured at 10 s** in verification |
| Time to first alert on a watchlisted vehicle | manual review, hours to never | `Alert.ts` minus `Detection.ts` |
| Time to reconstruct a vehicle's route | manual, hours per case | trail query — **measured at 437 ms** for 4 cameras |
| Operator time per incident | unmeasured | `Alert.acknowledgedAt` minus `Alert.ts` |
| Anomaly precision | unmeasured | `FALSE_POSITIVE` share of alert outcomes |

The last one matters most, and the schema records it deliberately: an operator marking an alert a
false positive is the only honest measure of whether the matching is good enough. **A pilot that
does not measure the false-positive rate has not evaluated the system.**

### Cost per outcome

At ₹4,382/camera/year, a district of 2,400 cameras costs **₹1.05 crore/year**. One officer-year is
roughly ₹8–12 lakh fully loaded. The system pays for itself if it saves about **10 officer-years of
manual video review per district per year** — roughly 20,000 hours.

Manual review of one vehicle's route across a district is a half-day job. If a district runs 200
such enquiries a year, that alone is ~800 hours. The rest has to come from continuous monitoring
replacing patrol-based observation, which is exactly the claim a pilot must test rather than assume.

---

## 7. What would change these numbers

- **Measured inference throughput.** GPU count drives ~40% of CAPEX and rests on an unmeasured
  assumption (see `docs/SCALE-80K.md` §3).
- **The video retention decision.** Hot storage is ₹45 lakh of a ₹2.24 crore district. Dropping
  continuous recording in favour of event-triggered clips cuts it by ~80%.
- **The AGPL decision.** Between ₹0 and ~₹12 lakh/year per district, or a detector swap.
- **Whether the VMS stays.** If it does, this is an add-on and the comparison above overstates the
  saving; if it goes, it understates the migration cost.
