"""
YOLOv8 person and vehicle detection, with ByteTrack running inside it.

Ultralytics' `model.track(persist=True)` is the tracker: it keeps state between
calls for a given model instance, which is why every camera gets its own
instance. Sharing one across cameras would braid their tracks together and
produce track ids that jump between locations.

If ultralytics is not installed, or the weights cannot be loaded, this class
does not fall back to anything. `available` stays False, the reason is recorded,
and the worker refuses to start. A detector that quietly degrades into a
motion-blob heuristic would publish detections nobody could trust.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

import numpy as np

from config import settings
from contracts import COCO_CLASS_NAMES

log = logging.getLogger(__name__)


@dataclass
class Detection:
    """One detected object in one frame, in that frame's pixel coordinates."""

    object_class: str
    confidence: float
    # [x, y, w, h], top-left origin.
    bbox: list[int]
    # None when the tracker did not assign an id to this box, which happens for
    # the first frames of a track. It is never invented.
    track_id: int | None


class Detector:
    """One per camera. Not safe to share - the tracker state is per instance."""

    def __init__(self, model_path: str | None = None) -> None:
        self.model_path = model_path or settings.detector_model
        self.available = False
        self.unavailable_reason: str | None = None
        self._model = None
        # Ultralytics is not re-entrant per model instance.
        self._lock = threading.Lock()

        try:
            from ultralytics import YOLO  # imported lazily so the API can start without it
        except ImportError as exc:
            self.unavailable_reason = (
                f"ultralytics is not installed ({exc}). Install the ai-service requirements, "
                "or run the ai-service container."
            )
            log.warning("Detector unavailable: %s", self.unavailable_reason)
            return

        try:
            self._model = YOLO(self.model_path)
            self.available = True
        except Exception as exc:  # noqa: BLE001 - the reason must reach the operator verbatim
            self.unavailable_reason = f"Could not load '{self.model_path}': {exc}"
            log.warning("Detector unavailable: %s", self.unavailable_reason)

    # -- inference -----------------------------------------------------------

    def detect(self, frame: np.ndarray) -> list[Detection]:
        """
        Runs detection and tracking on one frame.

        Raises RuntimeError rather than returning [] when the model is not
        loaded: an empty list means "nothing in this frame", and a caller must
        never confuse that with "no detector".
        """
        if not self.available or self._model is None:
            raise RuntimeError(self.unavailable_reason or "Detector is not available")

        with self._lock:
            results = self._model.track(
                frame,
                persist=True,  # ByteTrack keeps ids stable across calls
                tracker="bytetrack.yaml",
                classes=sorted(COCO_CLASS_NAMES),
                conf=settings.detector_confidence,
                iou=settings.detector_iou,
                imgsz=settings.detector_imgsz,
                device=settings.device,
                verbose=False,
            )

        return self._to_detections(results)

    @staticmethod
    def _to_detections(results) -> list[Detection]:
        detections: list[Detection] = []
        if not results:
            return detections

        boxes = getattr(results[0], "boxes", None)
        if boxes is None or len(boxes) == 0:
            return detections

        xyxy = boxes.xyxy.cpu().numpy()
        confidences = boxes.conf.cpu().numpy()
        class_ids = boxes.cls.cpu().numpy().astype(int)
        # `id` is absent until the tracker has associated a box with a track.
        track_ids = boxes.id.cpu().numpy().astype(int) if boxes.id is not None else None

        for index in range(len(xyxy)):
            class_id = int(class_ids[index])
            name = COCO_CLASS_NAMES.get(class_id)
            if name is None:
                # Outside the set we publish. Dropped, never relabelled into
                # something that sounds relevant.
                continue

            x1, y1, x2, y2 = (float(v) for v in xyxy[index])
            detections.append(
                Detection(
                    object_class=name,
                    confidence=round(float(confidences[index]), 4),
                    bbox=[int(x1), int(y1), int(x2 - x1), int(y2 - y1)],
                    track_id=int(track_ids[index]) if track_ids is not None else None,
                )
            )

        return detections

    def reset_tracker(self) -> None:
        """
        Drops tracker state.

        Called after a reconnect: the stream has a gap, so track ids from before
        it cannot honestly be continued across the discontinuity.
        """
        if self._model is None:
            return
        with self._lock:
            predictor = getattr(self._model, "predictor", None)
            trackers = getattr(predictor, "trackers", None) if predictor else None
            if trackers:
                for tracker in trackers:
                    reset = getattr(tracker, "reset", None)
                    if callable(reset):
                        reset()
