# Drishti analytics service

Every detection in the product is produced here. Nothing downstream may invent
one, and nothing in here invents one either.

```
main.py                   FastAPI: /health, /workers, /workers/{cam}/start|stop
config.py                 environment-driven settings
contracts.py              the detection event, validated on the way out
zones.py                  point-in-polygon occupancy, ported from crowd_analyzer.py
publisher.py              Redis Streams publisher
models/detector.py        YOLOv8 person + vehicle, ByteTrack inside it
models/tracker.py         one model instance per camera, reset on discontinuity
models/plate.py           plate detect + OCR, off unless a real detector is supplied
models/appearance.py      dominant colour, measured from the crop's pixels
workers/stream_worker.py  one asyncio task per camera
```

## Running it

```bash
docker compose up -d ai-service        # from the repo root
curl localhost:8100/health
```

Locally, without Docker:

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8100
```

Start a worker:

```bash
curl -X POST localhost:8100/workers/GNR-007/start -H 'Content-Type: application/json' -d '{
  "streamUrl": "rtsp://mediamtx:8554/cam07",
  "zones": [{"id": "<zone-uuid>", "name": "Foyer",
             "coordinates": [{"x":0,"y":0},{"x":800,"y":0},{"x":800,"y":600},{"x":0,"y":600}]}],
  "zoneReferenceSize": {"width": 800, "height": 600},
  "frameStride": 3
}'
```

## What it refuses to do

**No detector, no detections.** If ultralytics is missing or the weights cannot
load, `available` is false, `/health` returns 503 with the reason, and a worker
refuses to start. It does not fall back to a motion heuristic.

**No plate detector, no plate text.** `PLATE_MODEL_PATH` has no default. The
tempting shortcut - OCR the lower third of every vehicle box - reliably produces
confident, well-formed, entirely wrong registration numbers, and a plate is the
one field a person would act on. Unset, `attributes.plateText` is null on every
vehicle and `/health` says why.

**No reference canvas, no zone occupancy.** Zone polygons are drawn on some
canvas; without knowing its size the service cannot place a box inside a zone.
It publishes `zoneOccupancy: {}` rather than guessing a scale factor. See the
long note at the top of `zones.py` for what was deliberately not ported from
`crowd_analyzer.py`, and why.

**No frames, no numbers.** A stream that cannot be read moves the worker to
DEGRADED with the reason and retries with backoff. The gap is left empty: no
replayed last frame, no held occupancy, no interpolation. `fpsObserved` stays
null until frames have actually been decoded.

**No Redis, no silent buffering.** Publishing failures are counted and reported
as `dropped` on `/health`. The service does not queue an hour of detections and
replay them as live when Redis returns.

## Sampling

`FRAME_STRIDE` (default 3) - every Nth frame is inferred on, the rest are
decoded and discarded. At 25fps that is about eight inferences per second per
camera, which is what makes fifty streams feasible on one machine.

## Notes

`cv2.VideoCapture` on an unreachable RTSP URL blocks for a flat 30 seconds, and
no `OPENCV_FFMPEG_CAPTURE_OPTIONS` timeout changes that - measured, not assumed.
A TCP pre-check runs first so a refused port is known in milliseconds, and
capture opens use their own thread pool so a stuck one cannot starve the frame
reads of healthy cameras.
