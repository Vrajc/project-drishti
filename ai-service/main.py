"""
Drishti analytics service.

Every detection in the product comes from here. Nothing downstream may invent
one, and nothing in here invents one either: when a model is missing or a stream
is unreadable, the service says so and produces nothing.

    GET  /health                  what loaded, what did not, and why
    GET  /workers                 every worker and its real counters
    GET  /workers/{camera_id}     one worker
    POST /workers/{camera_id}/start
    POST /workers/{camera_id}/stop
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import JSONResponse

from config import settings
from contracts import utc_now_iso
from models.detector import Detector
from models.plate import PlateReader
from publisher import publisher
from workers.stream_worker import StreamWorker, WorkerConfig, trackers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("ai-service")

# camera_id -> worker
workers: dict[str, StreamWorker] = {}

# Loaded once at startup purely so /health can report what a worker *would* get
# without paying to load a model per request.
_capability_probe: dict[str, object] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting Drishti analytics service")

    connected = await publisher.connect()
    if not connected:
        # Not fatal. The service still starts so /health can explain why nothing
        # is being published, which is more useful than a container that exits.
        log.warning("Redis is not available: %s", publisher.unavailable_reason)

    detector = Detector()
    plate_reader = PlateReader()
    _capability_probe["detector"] = detector
    _capability_probe["plate"] = plate_reader

    if detector.available:
        log.info("Detector ready: %s on %s", settings.detector_model, settings.device)
    else:
        log.error("Detector unavailable: %s", detector.unavailable_reason)

    if plate_reader.available:
        log.info("Plate reading ready via %s", plate_reader.ocr_engine_name)
    else:
        log.info("Plate reading off: %s", plate_reader.unavailable_reason)

    yield

    log.info("Stopping %d worker(s)", len(workers))
    for worker in list(workers.values()):
        await worker.stop()
    workers.clear()
    await publisher.close()


app = FastAPI(
    title="Drishti Analytics Service",
    version="1.0.0",
    description="YOLOv8 detection and ByteTrack tracking over live camera streams.",
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> JSONResponse:
    """
    A capability report, not a liveness ping.

    `ready` is true only when this service could actually produce a detection
    right now. A caller must not read a 200 as "detections are flowing".
    """
    detector: Detector | None = _capability_probe.get("detector")  # type: ignore[assignment]
    plate: PlateReader | None = _capability_probe.get("plate")  # type: ignore[assignment]

    detector_ok = bool(detector and detector.available)
    redis_ok = publisher.stats.connected

    body = {
        "service": "drishti-ai",
        "ts": utc_now_iso(),
        # Both are required before a single detection can reach a consumer.
        "ready": detector_ok and redis_ok,
        "detector": {
            "model": settings.detector_model,
            "device": settings.device,
            "available": detector_ok,
            "reason": detector.unavailable_reason if detector else "not probed",
        },
        "plateReading": {
            "configured": settings.plate_reading_configured,
            "available": bool(plate and plate.available),
            "ocrEngine": plate.ocr_engine_name if plate else None,
            "reason": plate.unavailable_reason if plate else "not probed",
        },
        "redis": {
            "url": settings.redis_url,
            "connected": redis_ok,
            "reason": publisher.unavailable_reason,
            "published": publisher.stats.published,
            # Detections that were produced but never reached a consumer.
            "dropped": publisher.stats.dropped,
            "lastError": publisher.stats.last_error,
        },
        "sampling": {"frameStride": settings.frame_stride},
        "workers": {
            "count": len(workers),
            "online": sum(1 for w in workers.values() if w.status.state == "ONLINE"),
            "degraded": sum(1 for w in workers.values() if w.status.state == "DEGRADED"),
        },
    }

    # 200 only when the service can do its job; 503 makes the failure visible to
    # anything that polls it, rather than hiding behind a green tick.
    return JSONResponse(status_code=200 if body["ready"] else 503, content=body)


@app.get("/workers")
async def list_workers() -> dict:
    return {
        "count": len(workers),
        "workers": [worker.status.to_wire() for worker in workers.values()],
    }


@app.get("/workers/{camera_id}")
async def get_worker(camera_id: str) -> dict:
    worker = workers.get(camera_id)
    if worker is None:
        raise HTTPException(status_code=404, detail=f"No worker is running for camera {camera_id}")

    tracker = trackers.get(camera_id)
    return {
        **worker.status.to_wire(),
        "tracks": {
            "active": len(tracker.tracks) if tracker else 0,
            # Increments on every stream discontinuity. Two detections sharing a
            # track id across different generations are not the same object.
            "generation": tracker.generation if tracker else 0,
        },
    }


@app.post("/workers/{camera_id}/start")
async def start_worker(camera_id: str, body: dict = Body(default_factory=dict)) -> dict:
    """
    Starts a worker for one camera.

    Body:
      streamUrl          required, the RTSP URL to read
      zones              optional, [{id, name, coordinates:[{x,y}], maxCapacity}]
      zoneReferenceSize  the canvas the zone polygons were drawn on, as
                         {width, height} or [width, height]. Without it zone
                         occupancy is published empty rather than counted
                         against a guessed scale.
      frameStride        optional, defaults to FRAME_STRIDE
    """
    existing = workers.get(camera_id)
    if existing is not None and existing.status.state not in {"STOPPED", "FAILED"}:
        raise HTTPException(
            status_code=409,
            detail=f"A worker is already running for camera {camera_id} ({existing.status.state})",
        )

    config = WorkerConfig.from_request(camera_id, body)
    if not config.stream_url:
        raise HTTPException(status_code=400, detail="streamUrl is required")

    if config.zones and config.zone_reference_size is None:
        log.warning(
            "camera=%s started with %d zone(s) but no zoneReferenceSize; occupancy will be empty",
            camera_id,
            len(config.zones),
        )

    worker = StreamWorker(config, publisher)
    workers[camera_id] = worker
    await worker.start()

    return {
        "started": True,
        "camera": camera_id,
        "streamUrl": config.stream_url,
        "frameStride": config.frame_stride,
        "zones": len(config.zones),
        "zoneOccupancyPossible": bool(config.zones) and config.zone_reference_size is not None,
        "status": worker.status.to_wire(),
    }


@app.post("/workers/{camera_id}/stop")
async def stop_worker(camera_id: str) -> dict:
    worker = workers.pop(camera_id, None)
    if worker is None:
        raise HTTPException(status_code=404, detail=f"No worker is running for camera {camera_id}")

    await worker.stop()
    return {"stopped": True, "camera": camera_id, "status": worker.status.to_wire()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, log_level="info")
