"""
One worker per camera: RTSP in, detections out.

The loop is deliberately boring. Open the capture, read frames, run every Nth
one through the detector, publish what came back. Everything interesting is in
what happens when that fails.

ON FAILURE, NOTHING IS FILLED IN
--------------------------------
A stream that cannot be opened or read moves the worker to DEGRADED, publishes
that state with the reason, and retries with exponential backoff. It does not
re-publish the last frame's detections, it does not hold the previous
zoneOccupancy, and it does not interpolate across the gap. A consumer seeing
DEGRADED knows the absence of detections is a fault rather than an empty scene -
which is only true because the gap is genuinely left empty.

Decoding is blocking work, so it runs in a thread; the loop stays async so fifty
of these coexist in one process.
"""

from __future__ import annotations

import asyncio
import logging
import os
import socket
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

import cv2
import numpy as np

from config import settings
from contracts import (
    CameraState,
    CameraStatusEvent,
    DetectionAttributes,
    DetectionEvent,
    VEHICLE_CLASSES,
    utc_now_iso,
)
from models.appearance import dominant_colour
from models.plate import PlateReader
from models.tracker import CameraTracker, TrackerRegistry
from publisher import RedisPublisher
from zones import Zone, occupancy, scale_zones, zone_from_mapping

log = logging.getLogger(__name__)

trackers = TrackerRegistry()

# Opening a capture is done on its own pool, never asyncio's default one.
# cv2.VideoCapture on an unreachable RTSP URL blocks for a flat 30s no matter
# what OPENCV_FFMPEG_CAPTURE_OPTIONS says - measured, not assumed - and a thread
# stuck in C cannot be cancelled. Fifty of those on the shared pool would starve
# the frame reads of every healthy camera.
_open_pool = ThreadPoolExecutor(
    max_workers=settings.capture_open_pool_size, thread_name_prefix="capture-open"
)


def _endpoint(url: str) -> tuple[str, int] | None:
    """Host and port of a stream URL, with the scheme's default port."""
    try:
        parsed = urlparse(url)
    except Exception:  # noqa: BLE001
        return None

    if not parsed.hostname:
        return None

    defaults = {"rtsp": 554, "rtsps": 322, "http": 80, "https": 443}
    port = parsed.port or defaults.get((parsed.scheme or "").lower())
    if port is None:
        return None
    return parsed.hostname, port


def _reachable(url: str, timeout: float) -> str | None:
    """
    Cheap TCP pre-check before handing the URL to FFmpeg.

    Returns None when the port accepted a connection, or the reason it did not.
    This is what keeps a dead camera from occupying a thread for thirty seconds:
    a refused connection is known in milliseconds, and the worker can report
    DEGRADED straight away with the real errno instead of waiting on FFmpeg's
    retry loop.

    It only proves something is listening. Whether that something is publishing
    this path is FFmpeg's job, and it fails fast once connected.
    """
    endpoint = _endpoint(url)
    if endpoint is None:
        # A local file or an unusual scheme. Let the capture decide.
        return None

    host, port = endpoint
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return None
    except socket.timeout:
        return f"No answer from {host}:{port} within {timeout:.0f}s"
    except OSError as exc:
        return f"{exc.strerror or exc} contacting {host}:{port}"



@dataclass
class WorkerConfig:
    camera_id: str
    stream_url: str
    zones: list[Zone] = field(default_factory=list)
    # The canvas the zone polygons were drawn on. Without it the worker cannot
    # place a box inside a zone and publishes zoneOccupancy {} - see zones.py.
    zone_reference_size: tuple[float, float] | None = None
    frame_stride: int = settings.frame_stride

    @classmethod
    def from_request(cls, camera_id: str, body: dict) -> "WorkerConfig":
        raw_zones = body.get("zones") or []
        reference = body.get("zoneReferenceSize") or body.get("zone_reference_size")
        reference_size = None
        if isinstance(reference, (list, tuple)) and len(reference) == 2:
            try:
                reference_size = (float(reference[0]), float(reference[1]))
            except (TypeError, ValueError):
                reference_size = None
        elif isinstance(reference, dict):
            width, height = reference.get("width"), reference.get("height")
            if width is not None and height is not None:
                try:
                    reference_size = (float(width), float(height))
                except (TypeError, ValueError):
                    reference_size = None

        stride = body.get("frameStride") or body.get("frame_stride") or settings.frame_stride
        try:
            stride = max(1, int(stride))
        except (TypeError, ValueError):
            stride = settings.frame_stride

        return cls(
            camera_id=camera_id,
            stream_url=str(body.get("streamUrl") or body.get("stream_url") or "").strip(),
            zones=[zone_from_mapping(zone) for zone in raw_zones],
            zone_reference_size=reference_size,
            frame_stride=stride,
        )


@dataclass
class WorkerStatus:
    camera_id: str
    state: CameraState = "STARTING"
    reason: str | None = None
    started_at: str = field(default_factory=utc_now_iso)
    frames_read: int = 0
    frames_processed: int = 0
    detections_published: int = 0
    consecutive_failures: int = 0
    reconnects: int = 0
    # Measured from the decoder over the last window. Null until frames have
    # actually been read - never the camera's configured fps.
    fps_observed: float | None = None
    last_detection_at: str | None = None
    last_error: str | None = None
    zone_occupancy_available: bool = False

    def to_wire(self) -> dict:
        return {
            "cameraId": self.camera_id,
            "state": self.state,
            "reason": self.reason,
            "startedAt": self.started_at,
            "framesRead": self.frames_read,
            "framesProcessed": self.frames_processed,
            "detectionsPublished": self.detections_published,
            "consecutiveFailures": self.consecutive_failures,
            "reconnects": self.reconnects,
            "fpsObserved": self.fps_observed,
            "lastDetectionAt": self.last_detection_at,
            "lastError": self.last_error,
            "zoneOccupancyAvailable": self.zone_occupancy_available,
        }


class StreamWorker:
    def __init__(self, config: WorkerConfig, publisher: RedisPublisher) -> None:
        self.config = config
        self.publisher = publisher
        self.status = WorkerStatus(camera_id=config.camera_id)
        self.tracker: CameraTracker = trackers.acquire(config.camera_id)
        self.plate_reader = PlateReader()

        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        self._capture: cv2.VideoCapture | None = None
        self._scaled_zones: list[Zone] | None = None
        self._fps_window_started = 0.0
        self._fps_window_frames = 0

    # -- lifecycle -----------------------------------------------------------

    async def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run(), name=f"worker:{self.config.camera_id}")

    async def stop(self) -> None:
        self._stop.set()
        if self._task is not None:
            try:
                await asyncio.wait_for(self._task, timeout=15)
            except asyncio.TimeoutError:
                self._task.cancel()
            except asyncio.CancelledError:
                pass
        await self._release_capture()
        trackers.release(self.config.camera_id)
        await self._set_state("STOPPED", None)

    # -- state ---------------------------------------------------------------

    async def _set_state(self, state: CameraState, reason: str | None) -> None:
        changed = state != self.status.state or reason != self.status.reason
        self.status.state = state
        self.status.reason = reason
        if reason:
            self.status.last_error = reason

        if not changed:
            return

        log.info(
            "camera=%s state=%s%s", self.config.camera_id, state, f" reason={reason}" if reason else ""
        )
        await self.publisher.publish_status(
            CameraStatusEvent(
                cameraId=self.config.camera_id,
                state=state,
                reason=reason,
                fpsObserved=self.status.fps_observed,
                framesProcessed=self.status.frames_processed,
                consecutiveFailures=self.status.consecutive_failures,
            )
        )

    # -- capture -------------------------------------------------------------

    def _open_capture_blocking(self) -> tuple[cv2.VideoCapture | None, str | None]:
        unreachable = _reachable(self.config.stream_url, settings.connect_timeout_seconds)
        if unreachable is not None:
            return None, unreachable

        # Read by the FFmpeg backend when the capture is constructed, so it has
        # to be in the environment first. Set every time because another worker
        # may have been given different options.
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = settings.ffmpeg_capture_options

        capture = cv2.VideoCapture(self.config.stream_url, cv2.CAP_FFMPEG)
        if not capture.isOpened():
            capture.release()
            return None, f"Could not open the stream at {self.config.stream_url}"

        # A small buffer keeps the worker near live rather than replaying a
        # backlog after a stall - stale frames published as current would be a
        # quiet lie about when something happened.
        try:
            capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:  # noqa: BLE001 - not all backends support it
            pass

        return capture, None

    async def _release_capture(self) -> None:
        if self._capture is not None:
            capture, self._capture = self._capture, None
            await asyncio.to_thread(capture.release)

    # -- main loop -----------------------------------------------------------

    async def _run(self) -> None:
        if not self.config.stream_url:
            await self._set_state("FAILED", "No stream URL was supplied for this camera")
            return

        if not self.tracker.available:
            await self._set_state(
                "FAILED",
                self.tracker.unavailable_reason
                or "The detector is not available, so no detections can be produced",
            )
            return

        backoff = settings.reconnect_initial_seconds
        frame_index = 0

        while not self._stop.is_set():
            if self._capture is None:
                # STARTING is only true the first time. A worker that has
                # already failed to open or lost the stream stays DEGRADED while
                # it retries - flipping back to STARTING would read as progress
                # when nothing has changed.
                first_attempt = self.status.consecutive_failures == 0 and self.status.reconnects == 0
                await self._set_state(
                    "STARTING" if first_attempt else "DEGRADED",
                    None if first_attempt else self.status.last_error,
                )

                loop = asyncio.get_running_loop()
                try:
                    capture, error = await asyncio.wait_for(
                        loop.run_in_executor(_open_pool, self._open_capture_blocking),
                        timeout=settings.read_timeout_seconds * 2,
                    )
                except asyncio.TimeoutError:
                    # The pre-check passed but FFmpeg is still not back. Report
                    # rather than hang; the orphaned thread is confined to the
                    # open pool and cannot delay another camera's frames.
                    capture, error = None, (
                        f"Opening {self.config.stream_url} did not return within "
                        f"{settings.read_timeout_seconds * 2:.0f}s"
                    )

                if capture is None:
                    self.status.consecutive_failures += 1
                    await self._set_state("DEGRADED", error)
                    await self._sleep_with_backoff(backoff)
                    backoff = min(backoff * 2, settings.reconnect_max_seconds)
                    continue

                self._capture = capture
                self._scaled_zones = None
                self._fps_window_started = time.monotonic()
                self._fps_window_frames = 0
                backoff = settings.reconnect_initial_seconds
                self.status.consecutive_failures = 0
                await self._set_state("ONLINE", None)

            ok, frame = await asyncio.to_thread(self._capture.read)

            if not ok or frame is None:
                self.status.consecutive_failures += 1
                if self.status.consecutive_failures >= settings.max_read_failures:
                    await self._release_capture()
                    self.status.reconnects += 1
                    # The gap makes the frames on either side discontinuous, so
                    # track ids cannot be carried across it.
                    self.tracker.on_stream_discontinuity()
                    await self._set_state(
                        "DEGRADED",
                        f"Lost the stream after {self.status.consecutive_failures} failed reads; "
                        "reconnecting",
                    )
                    await self._sleep_with_backoff(backoff)
                    backoff = min(backoff * 2, settings.reconnect_max_seconds)
                else:
                    await asyncio.sleep(0.05)
                continue

            self.status.consecutive_failures = 0
            self.status.frames_read += 1
            self._update_observed_fps()
            frame_index += 1

            # Sample every Nth frame. The rest are decoded and discarded, which
            # is what keeps the stream near live.
            if frame_index % self.config.frame_stride != 0:
                continue

            try:
                await self._process_frame(frame)
            except Exception as exc:  # noqa: BLE001
                log.exception("camera=%s frame processing failed", self.config.camera_id)
                await self._set_state("DEGRADED", f"Frame processing failed: {exc}")

        await self._release_capture()

    async def _sleep_with_backoff(self, seconds: float) -> None:
        try:
            await asyncio.wait_for(self._stop.wait(), timeout=seconds)
        except asyncio.TimeoutError:
            pass

    def _update_observed_fps(self) -> None:
        """Measured from the decoder over a rolling window, never configured."""
        self._fps_window_frames += 1
        elapsed = time.monotonic() - self._fps_window_started
        if elapsed >= 5.0:
            self.status.fps_observed = round(self._fps_window_frames / elapsed, 2)
            self._fps_window_started = time.monotonic()
            self._fps_window_frames = 0

    # -- per-frame work ------------------------------------------------------

    def _resolve_zones(self, frame_shape: tuple[int, ...]) -> list[Zone] | None:
        """
        Scales the configured zones into this frame's pixels, once per capture.

        Returns None when the caller did not say what canvas the zones were
        drawn on. The worker then publishes zoneOccupancy {} rather than
        counting against a guessed scale.
        """
        if self._scaled_zones is not None:
            return self._scaled_zones
        if not self.config.zones:
            self.status.zone_occupancy_available = False
            return None

        height, width = frame_shape[0], frame_shape[1]
        scaled = scale_zones(self.config.zones, self.config.zone_reference_size, (width, height))

        if scaled is None:
            self.status.zone_occupancy_available = False
            log.warning(
                "camera=%s has %d zone(s) but no reference canvas size, so zone occupancy "
                "cannot be computed and will be published empty",
                self.config.camera_id,
                len(self.config.zones),
            )
            return None

        self._scaled_zones = scaled
        self.status.zone_occupancy_available = True
        return scaled

    def _snapshot(self, frame: np.ndarray, epoch_ms: int) -> str | None:
        if not settings.snapshots_enabled:
            return None

        directory = settings.snapshot_dir / self.config.camera_id
        try:
            directory.mkdir(parents=True, exist_ok=True)
            path = directory / f"{epoch_ms}.jpg"
            ok = cv2.imwrite(
                str(path), frame, [int(cv2.IMWRITE_JPEG_QUALITY), settings.snapshot_quality]
            )
            if not ok:
                return None
        except Exception as exc:  # noqa: BLE001
            log.debug("camera=%s snapshot failed: %s", self.config.camera_id, exc)
            return None

        self._prune_snapshots(directory)
        # Published as a path, not a filesystem location, so a consumer on
        # another host resolves it against its own snapshot mount.
        return f"/snapshots/{self.config.camera_id}/{epoch_ms}.jpg"

    @staticmethod
    def _prune_snapshots(directory: Path) -> None:
        try:
            files = sorted(directory.glob("*.jpg"))
            excess = len(files) - settings.snapshot_retention_per_camera
            for path in files[:excess]:
                path.unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass

    async def _process_frame(self, frame: np.ndarray) -> None:
        detections = await asyncio.to_thread(self.tracker.process, frame)

        if self.status.state != "ONLINE":
            await self._set_state("ONLINE", None)
        self.status.frames_processed += 1

        if not detections:
            return

        zones = self._resolve_zones(frame.shape)
        people = [d.bbox for d in detections if d.object_class == "person"]
        zone_counts = occupancy(people, zones)

        epoch_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        snapshot_path = self._snapshot(frame, epoch_ms)
        timestamp = utc_now_iso()

        events = [
            DetectionEvent(
                cameraId=self.config.camera_id,
                ts=timestamp,
                trackId=detection.track_id,
                **{"class": detection.object_class},
                confidence=detection.confidence,
                bbox=detection.bbox,
                attributes=self._attributes(frame, detection),
                # The occupancy of the whole frame this detection came from, so
                # a consumer never has to add up partial counts.
                zoneOccupancy=zone_counts,
                snapshotPath=snapshot_path,
            )
            for detection in detections
        ]

        delivered = await self.publisher.publish_detections(events)
        self.status.detections_published += delivered
        if delivered:
            self.status.last_detection_at = timestamp

    def _attributes(self, frame: np.ndarray, detection) -> DetectionAttributes:
        if detection.object_class not in VEHICLE_CLASSES:
            return DetectionAttributes()

        crop = self._crop(frame, detection.bbox)
        if crop is None:
            return DetectionAttributes(vehicleType=detection.object_class)

        # The detector's own class, not a body style it cannot determine.
        attributes = DetectionAttributes(
            vehicleType=detection.object_class,
            color=dominant_colour(crop),
        )

        reading = self.plate_reader.read(crop)
        if reading is not None:
            attributes.plate_text = reading.text
            attributes.plate_confidence = reading.confidence

        return attributes

    @staticmethod
    def _crop(frame: np.ndarray, bbox: Sequence[int]) -> np.ndarray | None:
        height, width = frame.shape[:2]
        x, y, w, h = bbox
        x1, y1 = max(0, int(x)), max(0, int(y))
        x2, y2 = min(width, int(x + w)), min(height, int(y + h))
        if x2 <= x1 or y2 <= y1:
            return None
        return frame[y1:y2, x1:x2]
