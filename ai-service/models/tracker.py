"""
Per-camera tracking.

ByteTrack itself lives inside ultralytics - `model.track(persist=True)` keeps
association state on the model instance between calls. This module owns the
consequence of that: **one model instance per camera, never shared**. Two
cameras sharing an instance would braid their tracks together and hand out
track ids that teleport between locations, which is worse than having no ids.

It also owns the rule about discontinuities. When a stream drops and reconnects,
the frames on either side of the gap are not continuous, so a track cannot
honestly be carried across it. The tracker state is reset and new ids are
issued. A track id in this product means "the same object, seen continuously" -
if that cannot be guaranteed, a fresh id is the truthful answer.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone

import numpy as np

from models.detector import Detection, Detector

log = logging.getLogger(__name__)


@dataclass
class TrackSummary:
    """What is known about one track on one camera, since it was first seen."""

    track_id: int
    object_class: str
    first_seen: datetime
    last_seen: datetime
    frames: int = 1

    @property
    def age_seconds(self) -> float:
        return (self.last_seen - self.first_seen).total_seconds()


@dataclass
class CameraTracker:
    """
    Detection plus tracking for exactly one camera.

    `generation` counts stream discontinuities. It is not cosmetic: a consumer
    joining two detections with the same track id must know whether a reconnect
    happened between them, because ByteTrack will reuse low ids after a reset.
    """

    camera_id: str
    detector: Detector
    generation: int = 0
    tracks: dict[int, TrackSummary] = field(default_factory=dict)

    @property
    def available(self) -> bool:
        return self.detector.available

    @property
    def unavailable_reason(self) -> str | None:
        return self.detector.unavailable_reason

    def process(self, frame: np.ndarray) -> list[Detection]:
        """Detects and tracks in one frame, updating this camera's track table."""
        detections = self.detector.detect(frame)

        now = datetime.now(timezone.utc)
        for detection in detections:
            if detection.track_id is None:
                # The tracker has not associated this box with a track yet.
                # Publishing trackId null is the honest report; inventing an id
                # would create a track that never existed.
                continue

            existing = self.tracks.get(detection.track_id)
            if existing is None:
                self.tracks[detection.track_id] = TrackSummary(
                    track_id=detection.track_id,
                    object_class=detection.object_class,
                    first_seen=now,
                    last_seen=now,
                )
            else:
                existing.last_seen = now
                existing.frames += 1

        return detections

    def on_stream_discontinuity(self) -> None:
        """Called after a reconnect. See the module docstring."""
        self.generation += 1
        self.tracks.clear()
        self.detector.reset_tracker()
        log.info(
            "camera=%s tracker reset after a stream discontinuity (generation %d)",
            self.camera_id,
            self.generation,
        )

    def prune(self, max_idle_seconds: float = 60.0) -> int:
        """Forgets tracks nothing has been seen on for a while."""
        now = datetime.now(timezone.utc)
        stale = [
            track_id
            for track_id, summary in self.tracks.items()
            if (now - summary.last_seen).total_seconds() > max_idle_seconds
        ]
        for track_id in stale:
            del self.tracks[track_id]
        return len(stale)


class TrackerRegistry:
    """
    Hands out one CameraTracker per camera, and only one.

    Construction loads a model, which is slow, so it is done once per camera and
    kept for the life of the worker.
    """

    def __init__(self) -> None:
        self._trackers: dict[str, CameraTracker] = {}
        self._lock = threading.Lock()

    def acquire(self, camera_id: str) -> CameraTracker:
        with self._lock:
            tracker = self._trackers.get(camera_id)
            if tracker is None:
                tracker = CameraTracker(camera_id=camera_id, detector=Detector())
                self._trackers[camera_id] = tracker
            return tracker

    def release(self, camera_id: str) -> None:
        with self._lock:
            self._trackers.pop(camera_id, None)

    def get(self, camera_id: str) -> CameraTracker | None:
        with self._lock:
            return self._trackers.get(camera_id)
