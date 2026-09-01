"""
Licence plate detection and OCR.

Two stages, and both must succeed before any text is published:

  1. a dedicated plate detector locates the plate inside a vehicle crop;
  2. an OCR engine reads it, and the result must clear a confidence floor.

THERE IS NO FALLBACK, AND THAT IS DELIBERATE
--------------------------------------------
Without a plate detector the obvious shortcut is to OCR the lower third of every
vehicle box and publish whatever comes back. That reliably produces confident,
well-formed, entirely wrong registration numbers - the single worst failure this
product could have, because a plate is the one field a person would act on.

So when `PLATE_MODEL_PATH` is unset, plate reading is off. `attributes.plateText`
stays null on every vehicle, `/health` says why, and nothing guesses.
"""

from __future__ import annotations

import logging
import re
import threading
from dataclasses import dataclass

import numpy as np

from config import settings

log = logging.getLogger(__name__)

# Indian registration format, e.g. GJ01AB1234. Used only to normalise spacing
# and case, never to "correct" a reading into a plausible plate - a reading that
# does not match is published as-is or not at all, not rewritten.
PLATE_CLEANUP = re.compile(r"[^A-Z0-9]")


@dataclass
class PlateReading:
    text: str
    confidence: float


class PlateReader:
    def __init__(self) -> None:
        self.available = False
        self.unavailable_reason: str | None = None
        self.ocr_engine_name: str | None = None
        self._detector = None
        self._ocr = None
        self._lock = threading.Lock()

        if not settings.plate_reading_configured:
            self.unavailable_reason = (
                "PLATE_MODEL_PATH is not set, so no plate detector is loaded. Plate text is "
                "left null rather than guessed from a crop of the vehicle."
            )
            log.info("Plate reading disabled: %s", self.unavailable_reason)
            return

        detector_error = self._load_detector()
        if detector_error:
            self.unavailable_reason = detector_error
            log.warning("Plate reading disabled: %s", detector_error)
            return

        ocr_error = self._load_ocr()
        if ocr_error:
            self.unavailable_reason = ocr_error
            log.warning("Plate reading disabled: %s", ocr_error)
            return

        self.available = True

    # -- loading -------------------------------------------------------------

    def _load_detector(self) -> str | None:
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            return f"ultralytics is not installed ({exc}), so the plate detector cannot load"

        try:
            self._detector = YOLO(settings.plate_model)
        except Exception as exc:  # noqa: BLE001
            return f"Could not load the plate detector '{settings.plate_model}': {exc}"
        return None

    def _load_ocr(self) -> str | None:
        """PaddleOCR first, EasyOCR as the fallback. Neither is a default."""
        try:
            from paddleocr import PaddleOCR

            self._ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
            self.ocr_engine_name = "paddleocr"
            return None
        except Exception as paddle_error:  # noqa: BLE001
            log.info("PaddleOCR unavailable (%s), trying EasyOCR", paddle_error)

        try:
            import easyocr

            self._ocr = easyocr.Reader(["en"], gpu=settings.device != "cpu")
            self.ocr_engine_name = "easyocr"
            return None
        except Exception as easy_error:  # noqa: BLE001
            return (
                "No OCR engine could be loaded. PaddleOCR and EasyOCR both failed; "
                f"the last error was: {easy_error}"
            )

    # -- reading -------------------------------------------------------------

    def read(self, vehicle_crop: np.ndarray) -> PlateReading | None:
        """
        Returns the plate on this vehicle, or None.

        None is returned for every honest failure: reader unavailable, no plate
        found, OCR produced nothing, or the confidence was below the floor. The
        caller publishes null, which is what "we did not read a plate" looks
        like on the wire.
        """
        if not self.available or self._detector is None or self._ocr is None:
            return None
        if vehicle_crop is None or vehicle_crop.size == 0:
            return None

        try:
            with self._lock:
                results = self._detector.predict(
                    vehicle_crop,
                    conf=settings.plate_confidence,
                    device=settings.device,
                    verbose=False,
                )
        except Exception as exc:  # noqa: BLE001
            log.debug("Plate detection failed: %s", exc)
            return None

        crop = self._best_plate_crop(vehicle_crop, results)
        if crop is None:
            return None

        return self._ocr_crop(crop)

    @staticmethod
    def _best_plate_crop(image: np.ndarray, results) -> np.ndarray | None:
        if not results:
            return None
        boxes = getattr(results[0], "boxes", None)
        if boxes is None or len(boxes) == 0:
            return None

        xyxy = boxes.xyxy.cpu().numpy()
        confidences = boxes.conf.cpu().numpy()
        best = int(confidences.argmax())

        height, width = image.shape[:2]
        x1, y1, x2, y2 = (int(v) for v in xyxy[best])
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(width, x2), min(height, y2)
        if x2 <= x1 or y2 <= y1:
            return None

        return image[y1:y2, x1:x2]

    def _ocr_crop(self, crop: np.ndarray) -> PlateReading | None:
        try:
            with self._lock:
                if self.ocr_engine_name == "paddleocr":
                    raw = self._ocr.ocr(crop, cls=True)
                    candidates = [
                        (line[1][0], float(line[1][1]))
                        for block in (raw or [])
                        if block
                        for line in block
                    ]
                else:
                    candidates = [
                        (text, float(confidence))
                        for _box, text, confidence in (self._ocr.readtext(crop) or [])
                    ]
        except Exception as exc:  # noqa: BLE001
            log.debug("OCR failed: %s", exc)
            return None

        if not candidates:
            return None

        text, confidence = max(candidates, key=lambda item: item[1])
        normalised = PLATE_CLEANUP.sub("", text.upper())

        # A registration is never one or two characters. Below the floor, or too
        # short to be a plate, is reported as no reading at all.
        if len(normalised) < 4 or confidence < settings.ocr_min_confidence:
            return None

        return PlateReading(text=normalised, confidence=round(confidence, 4))
