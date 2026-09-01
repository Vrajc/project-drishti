"""
The detection event contract.

Both sides of Redis depend on this exact shape, so it lives in one place and is
validated on the way out. A field that has no measured value is `null` - never
an empty string, never a plausible default. A consumer can therefore treat a
present value as something that was actually observed.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# The COCO classes worth publishing, mapped to the names the product uses.
# Anything the detector finds outside this set is dropped rather than renamed
# into something that sounds relevant.
COCO_CLASS_NAMES: dict[int, str] = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

VEHICLE_CLASSES = frozenset({"car", "motorcycle", "bus", "truck", "bicycle"})


def utc_now_iso() -> str:
    """Timestamps are always UTC with milliseconds, matching the contract."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class DetectionAttributes(BaseModel):
    """
    Everything here is optional and defaults to None.

    `plateText` is present only when a plate detector found a plate and OCR read
    it above the confidence floor. `color` is computed from the actual pixels of
    the crop. `vehicleType` is the detector's own class, not a finer-grained
    guess at body style the model cannot make.
    """

    model_config = ConfigDict(populate_by_name=True)

    plate_text: str | None = Field(default=None, alias="plateText")
    plate_confidence: float | None = Field(default=None, alias="plateConfidence")
    color: str | None = None
    vehicle_type: str | None = Field(default=None, alias="vehicleType")


class DetectionEvent(BaseModel):
    """
    One published detection.

    `zoneOccupancy` is the occupancy of the whole frame this detection came
    from, keyed by Zone.id (the UUID, not the human-facing zoneId) - the same
    identity mistake that broke crowd density before. It is `{}` when the worker
    has no zone geometry it can trust, which is the honest empty state rather
    than a count against invented boundaries.
    """

    model_config = ConfigDict(populate_by_name=True)

    camera_id: str = Field(alias="cameraId")
    ts: str = Field(default_factory=utc_now_iso)
    track_id: int | None = Field(default=None, alias="trackId")
    object_class: str = Field(alias="class")
    confidence: float
    # [x, y, w, h] in pixels, top-left origin, in the frame's own coordinates.
    bbox: list[int]
    attributes: DetectionAttributes = Field(default_factory=DetectionAttributes)
    zone_occupancy: dict[str, int] = Field(default_factory=dict, alias="zoneOccupancy")
    snapshot_path: str | None = Field(default=None, alias="snapshotPath")

    def to_wire(self) -> dict[str, Any]:
        """Serialises with the contract's field names, nulls included."""
        return self.model_dump(by_alias=True)


CameraState = Literal["STARTING", "ONLINE", "DEGRADED", "STOPPED", "FAILED"]


class CameraStatusEvent(BaseModel):
    """
    Published whenever a worker's view of a camera changes.

    The service reports DEGRADED while it is retrying a stream it cannot read.
    It never fills the gap with the last known detections - a consumer that sees
    DEGRADED knows the absence of events is a fault, not an empty scene.
    """

    model_config = ConfigDict(populate_by_name=True)

    camera_id: str = Field(alias="cameraId")
    ts: str = Field(default_factory=utc_now_iso)
    state: CameraState
    # Verbatim reason whenever the state is not ONLINE.
    reason: str | None = None
    # Measured from the decoder, null until frames have actually been read.
    fps_observed: float | None = Field(default=None, alias="fpsObserved")
    frames_processed: int = Field(default=0, alias="framesProcessed")
    consecutive_failures: int = Field(default=0, alias="consecutiveFailures")

    def to_wire(self) -> dict[str, Any]:
        return self.model_dump(by_alias=True)
