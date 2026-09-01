"""
Redis Streams publisher.

Every detection this service produces leaves through here. Two streams:

  drishti:detections      one entry per detection
  drishti:camera-status   one entry per worker state change

Both are capped with an approximate MAXLEN so an unattended service cannot fill
a disk. Approximate trimming is Redis' cheap path - it trims to *at least* the
cap, on radix node boundaries.

WHAT HAPPENS WHEN REDIS IS DOWN
-------------------------------
Publishing fails, the failure is counted and logged, and the worker keeps
processing frames. It does not buffer indefinitely, because a service that
silently replays an hour of stale detections when Redis returns would deliver
"live" events describing a scene that has long since changed. Dropped is
honest; delayed-and-relabelled-as-live is not. `dropped` on the health endpoint
is the visible count of what was lost.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field

from config import settings
from contracts import CameraStatusEvent, DetectionEvent

log = logging.getLogger(__name__)


@dataclass
class PublisherStats:
    published: int = 0
    dropped: int = 0
    last_error: str | None = None
    connected: bool = False


class RedisPublisher:
    def __init__(self, url: str | None = None) -> None:
        self.url = url or settings.redis_url
        self.stats = PublisherStats()
        self._client = None
        self._connect_lock = asyncio.Lock()
        self._unavailable_reason: str | None = None

    @property
    def unavailable_reason(self) -> str | None:
        return self._unavailable_reason

    async def connect(self) -> bool:
        """Idempotent. Returns whether a usable connection now exists."""
        async with self._connect_lock:
            if self._client is not None:
                return True

            try:
                from redis.asyncio import Redis
            except ImportError as exc:
                self._unavailable_reason = (
                    f"the redis package is not installed ({exc}); no detections can be published"
                )
                log.error("Publisher unavailable: %s", self._unavailable_reason)
                return False

            try:
                client = Redis.from_url(self.url, decode_responses=True)
                await client.ping()
            except Exception as exc:  # noqa: BLE001
                self._unavailable_reason = f"could not reach Redis at {self.url}: {exc}"
                self.stats.connected = False
                self.stats.last_error = str(exc)
                log.warning("Publisher unavailable: %s", self._unavailable_reason)
                return False

            self._client = client
            self._unavailable_reason = None
            self.stats.connected = True
            log.info("Publisher connected to %s", self.url)
            return True

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception:  # noqa: BLE001
                pass
            self._client = None
            self.stats.connected = False

    async def _xadd(self, stream: str, payload: dict) -> bool:
        if self._client is None and not await self.connect():
            self.stats.dropped += 1
            return False

        try:
            await self._client.xadd(
                stream,
                {"data": json.dumps(payload, separators=(",", ":"))},
                maxlen=settings.stream_maxlen,
                approximate=True,
            )
        except Exception as exc:  # noqa: BLE001
            self.stats.dropped += 1
            self.stats.last_error = str(exc)
            self.stats.connected = False
            # Drop the handle so the next publish reconnects rather than
            # retrying against a socket that is already gone.
            self._client = None
            log.warning("Publish to %s failed, event dropped: %s", stream, exc)
            return False

        self.stats.published += 1
        return True

    async def publish_detection(self, event: DetectionEvent) -> bool:
        return await self._xadd(settings.detection_stream, event.to_wire())

    async def publish_detections(self, events: list[DetectionEvent]) -> int:
        """Returns how many actually reached Redis, which may be fewer than sent."""
        delivered = 0
        for event in events:
            if await self.publish_detection(event):
                delivered += 1
        return delivered

    async def publish_status(self, event: CameraStatusEvent) -> bool:
        return await self._xadd(settings.status_stream, event.to_wire())


publisher = RedisPublisher()
