# Five-minute demo

Evaluation, 10–11 September 2026.

**Before you start:** `docker compose up -d && npm run dev`, both seeds run, clips in
`media/clips/`, and one browser window at `http://localhost:5173`. Have a second terminal ready —
you will kill a stream from it.

The through-line: **every number on screen can be traced to a row, and where there is no row, the
screen says so.** Say that once at the start and then let the interface demonstrate it.

---

## 0:00 — The rule (20 seconds)

> "Drishti runs a camera estate for Gujarat Police. Before showing what it does, here is the rule it
> is built on: nothing on screen is invented. Every number comes from a detection, a database row or
> a computation. Where there isn't one yet, the screen says so rather than showing a plausible
> figure."

Terminal:

```bash
npm run verify
```

> "That's a build gate. It fails if fabricated data appears anywhere in the source. It started at
> 76 occurrences. It's at zero."

---

## 0:20 — The estate (50 seconds)

Sign in as `police@gmail.com` / `Test@123` → **Estate Overview**.

Point at the four tiles: 60 cameras, how many reachable, how many never probed, open anomalies.

> "Sixty cameras across five departments and sixteen sites in Gandhinagar and Ahmedabad. Real
> coordinates — Akshardham, Mahatma Mandir, Kalupur Junction, the SG Highway corridor."

Point at **Detection rules**:

> "Three rules. One is live, two are dormant — and it says which, and why: they're waiting for
> crowd readings, not switched off. A dashboard that showed all three as green would be lying."

**Cameras → Camera Map.**

> "Every pin is a surveyed position. Seven cameras aren't on this map — they're listed underneath by
> name, because they've been installed but not surveyed. Dropping them at 0,0 would put them in the
> Gulf of Guinea."

Click one pin → the popup shows bearing, declared range, hardware, last reached.

> "No coverage cone. We store a bearing and a range, not a field-of-view angle — so we draw a
> direction and a distance, and nothing we can't back."

---

## 1:10 — Live feeds (40 seconds)

**Cameras → Live wall.**

> "Twenty-five feeds. The LIVE badge means pixels are arriving right now — read from the video
> element, not from having asked it to play. The status pill underneath is something different:
> what the last health probe found."

---

## 1:50 — Kill a camera (60 seconds) ⭐

*This is the moment. Do it live.*

Second terminal:

```bash
docker compose exec mediamtx sh -c "pkill -f cam07"
```

> "I've just killed the publisher for one camera. The poller probes every thirty seconds — it opens
> a socket and speaks RTSP. Watch."

Wait. Within ~30 s the tile drops out and the status flips.

Go to **Estate Overview** → the camera-offline rule has fired.

> "That's a real incident row, raised because a probe reached that camera on the previous sweep and
> failed on this one. And the reason is recorded verbatim: *reachable, but nothing is publishing to
> that path*. Not 'camera down' — the server is fine, the stream isn't."

Bring it back:

```bash
docker compose restart mediamtx
```

---

## 2:50 — Watchlist to alert (60 seconds) ⭐

**Watchlist → Add entry.** Plate `GJ 01 AB 1234`, case `FIR-2026-4417`, "Stolen vehicle", severity
high.

> "That's recorded against my account as the issuing officer, with a case number. A watchlist entry
> is a legal act, so it records one."

Point at the row: *matched as GJ01AB1234*.

> "It shows both — what I typed and what the matcher actually compares. Spacing stripped, and the
> letter O folded to zero, because OCR confuses them."

Now let a vehicle with that plate pass a camera (sample clip, or feed a detection).

**Alerts** — the badge in the nav increments; the alert appears with the frame.

> "Exact match, one hundred percent — and that hundred percent is not a confidence the system chose.
> The plates are identical after normalisation, so there's nothing to score. A *probable* match
> would show a computed number below a hundred, and would say why."

Click **Acknowledge**.

> "Stamped with who took it, and never overwritten — the trail records who took responsibility, not
> who clicked most recently."

---

## 3:50 — The graded case: where did it go? (60 seconds) ⭐

**Vehicle Trail** → pick the plate from the watchlist dropdown.

> "Every camera that saw it, in time order. Answered in well under a second."

Point at the elapsed-time readout on screen — it is measured, not claimed.

Point at the map:

> "Numbered stops, chronological. The solid line is a certain link — the same plate was read at both
> ends. The dashed one is *probable*: the plate wasn't readable at that camera, so it's linked on
> colour, type, and whether the journey is physically possible."

Point at the reasoning line under the probable link.

> "It shows its working: distance, elapsed time, implied speed. And it's capped below certainty on
> purpose — colour and type narrow a link down, they can't identify a vehicle. Another white
> hatchback could have made that trip. A hundred percent there would be a lie."

Drag the scrubber. Then **Export PDF**.

> "The caveats travel with the document — that these are camera positions, not a GPS track, and that
> detections are sampled. Someone reading the printout learns what it is without having seen this
> screen."

---

## 4:50 — Close (10 seconds)

> "One database, one login, one camera estate. The event-safety product it grew out of is still
> there — an organizer borrows cameras from this registry for a festival, and gets the same crowd
> analytics on them.
>
> Everything you've seen traces to a row. Where it doesn't, the screen told you."

---

## If asked

**"Is this data real?"**
The coordinates are real places. The cameras are a demonstration estate seeded as a deployment
inventory — vendor, model, resolution are declared configuration, exactly as a department would hand
over a spreadsheet. Status and last-seen are *never* seeded: only a probe writes those. Detections
come from the analytics service reading the streams.

**"What's fake?"**
Nothing is presented as measured that wasn't. What's *absent* is listed in `docs/AUDIT.md`: face
matching isn't built, road-distance ETA needs OSRM so we show straight-line and label it, and
observed frame rate is null because the health probe doesn't decode video.

**"Why is that number blank?"**
Because nothing has measured it yet. That is the design. A zero there would claim the venue is
empty; a dash says we haven't looked.

**"Can it scale to 80,000?"**
`docs/SCALE-80K.md`. The measured numbers are separated from the assumed ones, and the GPU sizing is
explicitly an assumption that a pilot must verify before procurement.

**"What does it cost?"**
`docs/COST-BENEFIT.md`. Roughly ₹31,000 per camera over five years, with no per-camera licence — but
read the AGPL note on the detector before budgeting.

**"Can anyone sign up as police?"**
No. Registration accepts only participant and organizer, and refuses anything else outright. That
was a real hole found during verification, and it's in `docs/SECURITY.md` with the fix.

---

## Recovery

| If | Do |
|---|---|
| A feed won't play | Expected without clips in `media/clips/`. The tile says why. Point at that — it's the honesty story. |
| No alerts appear | The console explains which link is missing: engine, Redis, watchlist or plate reader. Read it aloud. |
| Docker isn't up | The registry, map, health poller, watchlist and dispatch all work without it. Skip the live-wall and alert sections and lean on the trail with seeded detections. |
| Something is genuinely broken | Say so. The whole point is a system that tells the truth about its own state. |
