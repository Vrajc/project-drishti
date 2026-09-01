"""
Configuration for the Drishti analytics service.

Everything here is read from the environment so nothing about a deployment is
baked into the image. Defaults are chosen to be safe rather than convenient: a
missing model path disables that capability and says so, it never falls back to
something that produces plausible output.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def _float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    # --- Service ---
    host: str = field(default_factory=lambda: os.getenv("AI_SERVICE_HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: _int("AI_SERVICE_PORT", 8100))

    # --- Detection ---
    # YOLOv8n is the default because fifty concurrent streams on one machine is
    # the constraint that matters; point this at yolov8s.pt for more accuracy.
    detector_model: str = field(default_factory=lambda: os.getenv("YOLO_MODEL", "yolov8n.pt"))
    detector_confidence: float = field(default_factory=lambda: _float("YOLO_CONFIDENCE", 0.35))
    detector_iou: float = field(default_factory=lambda: _float("YOLO_IOU", 0.5))
    detector_imgsz: int = field(default_factory=lambda: _int("YOLO_IMGSZ", 640))
    device: str = field(default_factory=lambda: os.getenv("YOLO_DEVICE", "cpu"))

    # A separate licence-plate detector. There is no default weight file: plate
    # reading stays off until a real one is supplied, because guessing where a
    # plate is and running OCR on it produces confident nonsense.
    plate_model: str | None = field(default_factory=lambda: os.getenv("PLATE_MODEL_PATH") or None)
    plate_confidence: float = field(default_factory=lambda: _float("PLATE_CONFIDENCE", 0.3))
    ocr_min_confidence: float = field(default_factory=lambda: _float("OCR_MIN_CONFIDENCE", 0.4))

    # --- Sampling ---
    # Every Nth frame. At 25fps and N=3 that is ~8 inferences per second per
    # camera, which is what makes fifty streams feasible on one machine.
    frame_stride: int = field(default_factory=lambda: _int("FRAME_STRIDE", 3))

    # --- Stream handling ---
    # Passed to OpenCV's FFmpeg backend before a capture is opened. Without a
    # timeout, VideoCapture on an unreachable RTSP URL blocks for tens of
    # seconds, and the worker cannot report DEGRADED until it returns - the
    # camera looks fine for as long as FFmpeg is willing to wait.
    # `timeout` is in microseconds. Older FFmpeg builds call it `stimeout`.
    ffmpeg_capture_options: str = field(
        default_factory=lambda: os.getenv(
            "FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp|timeout;5000000"
        )
    )
    # TCP pre-check before FFmpeg is asked to open a stream. A refused port is
    # known in milliseconds this way, instead of thirty seconds later.
    connect_timeout_seconds: float = field(default_factory=lambda: _float("STREAM_CONNECT_TIMEOUT", 3.0))
    # Threads reserved for opening captures, kept off asyncio's shared pool.
    capture_open_pool_size: int = field(default_factory=lambda: _int("CAPTURE_OPEN_POOL_SIZE", 8))
    read_timeout_seconds: float = field(default_factory=lambda: _float("STREAM_READ_TIMEOUT", 10.0))
    reconnect_initial_seconds: float = field(default_factory=lambda: _float("STREAM_BACKOFF_INITIAL", 2.0))
    reconnect_max_seconds: float = field(default_factory=lambda: _float("STREAM_BACKOFF_MAX", 60.0))
    # Consecutive read failures tolerated before the worker tears the capture
    # down and reconnects.
    max_read_failures: int = field(default_factory=lambda: _int("STREAM_MAX_READ_FAILURES", 15))

    # --- Redis ---
    redis_url: str = field(default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379"))
    detection_stream: str = field(default_factory=lambda: os.getenv("DETECTION_STREAM", "drishti:detections"))
    status_stream: str = field(default_factory=lambda: os.getenv("CAMERA_STATUS_STREAM", "drishti:camera-status"))
    # Streams are capped so an unattended service cannot fill the disk.
    stream_maxlen: int = field(default_factory=lambda: _int("STREAM_MAXLEN", 100_000))

    # --- Snapshots ---
    snapshots_enabled: bool = field(default_factory=lambda: _bool("SNAPSHOTS_ENABLED", True))
    snapshot_dir: Path = field(
        default_factory=lambda: Path(os.getenv("SNAPSHOT_DIR", "/snapshots"))
    )
    snapshot_quality: int = field(default_factory=lambda: _int("SNAPSHOT_QUALITY", 70))
    # Newest N snapshots kept per camera; older files are removed.
    snapshot_retention_per_camera: int = field(
        default_factory=lambda: _int("SNAPSHOT_RETENTION_PER_CAMERA", 500)
    )

    @property
    def plate_reading_configured(self) -> bool:
        return self.plate_model is not None


settings = Settings()
