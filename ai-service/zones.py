"""
Zone occupancy.

The ray-casting test and the counting rule are ported verbatim from
`backend/src/services/crowd_analyzer.py` - same algorithm, same vertex format,
same "centre point of the box, first matching zone wins" behaviour. Two systems
that count the same crowd differently are worse than one that counts it badly.

WHAT WAS DELIBERATELY NOT PORTED
--------------------------------
`CrowdAnalyzer.auto_scale_zones` is not here, and its absence is the point.

That function did two things when zone coordinates looked small relative to the
frame. The first was to scale them by a factor inferred from the largest
coordinate present - a guess at what canvas the operator drew on. The second,
when several zones had identical coordinates, was to **replace them with evenly
distributed vertical strips across the frame**. Occupancy counted against those
strips is a real count of real people inside boundaries nobody drew, reported as
though an operator had defined them. That is exactly the class of number this
product must not produce.

The same file also invented a full-frame "Full Video" zone when an event had no
zones at all, so an event with no geometry still returned confident occupancy.
The backend already refuses to analyse such an event; this module does the
equivalent, by returning `{}`.

Instead, zone geometry is scaled explicitly, from a reference canvas size the
caller states. If the caller does not know what canvas the zones were drawn on,
`occupancy` returns an empty mapping and the worker publishes `zoneOccupancy:
{}` - the honest "we cannot place these boxes" rather than a plausible count.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence


@dataclass(frozen=True)
class Zone:
    """
    A zone as the registry stores it.

    `id` is the Zone row's UUID. It is what `zoneOccupancy` is keyed by, and
    what a CrowdDensity row's foreign key expects - passing the human-facing
    `zoneId` string here is the mistake that made every density write fail.
    """

    id: str
    name: str
    # Polygon vertices in the coordinate space named by `reference_size`.
    points: tuple[tuple[float, float], ...]
    max_capacity: int | None = None

    @property
    def is_usable(self) -> bool:
        """Fewer than three vertices is a line or a point, not an area."""
        return len(self.points) >= 3


def zone_from_mapping(raw: Mapping) -> Zone:
    """
    Accepts the shape the API returns: coordinates as [{'x': .., 'y': ..}].
    A vertex missing either component is dropped rather than defaulted to zero,
    which would silently drag the polygon to the origin.
    """
    points: list[tuple[float, float]] = []
    for vertex in raw.get("coordinates") or []:
        if not isinstance(vertex, Mapping):
            continue
        x, y = vertex.get("x"), vertex.get("y")
        if x is None or y is None:
            continue
        try:
            points.append((float(x), float(y)))
        except (TypeError, ValueError):
            continue

    return Zone(
        id=str(raw.get("id") or ""),
        name=str(raw.get("name") or ""),
        points=tuple(points),
        max_capacity=raw.get("maxCapacity"),
    )


def point_in_zone(point: tuple[float, float], zone: Zone) -> bool:
    """
    Ray casting, ported from CrowdAnalyzer.point_in_zone.

    A point on the boundary may fall either way; that is true of the original
    too, and matching it matters more than tidying it.
    """
    x, y = point
    vertices = zone.points
    if len(vertices) < 3:
        return False

    inside = False
    j = len(vertices) - 1

    for i in range(len(vertices)):
        xi, yi = vertices[i]
        xj, yj = vertices[j]

        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside

        j = i

    return inside


def scale_zones(
    zones: Sequence[Zone],
    reference_size: tuple[float, float] | None,
    frame_size: tuple[int, int],
) -> list[Zone] | None:
    """
    Maps zones from the canvas they were drawn on into frame pixels.

    `reference_size` is the width and height of that canvas, stated by the
    caller. Returns None when it is unknown or degenerate - the caller must then
    report no occupancy rather than guess a scale factor.

    When the reference already matches the frame this is the identity, so a
    caller whose zones are already in pixel space can pass the frame size.
    """
    if reference_size is None:
        return None

    ref_w, ref_h = reference_size
    if ref_w <= 0 or ref_h <= 0:
        return None

    frame_w, frame_h = frame_size
    if frame_w <= 0 or frame_h <= 0:
        return None

    scale_x = frame_w / ref_w
    scale_y = frame_h / ref_h

    return [
        Zone(
            id=zone.id,
            name=zone.name,
            points=tuple((x * scale_x, y * scale_y) for x, y in zone.points),
            max_capacity=zone.max_capacity,
        )
        for zone in zones
    ]


def box_centre(box: Sequence[float]) -> tuple[float, float]:
    """
    Centre of an [x, y, w, h] box - the point the original counted by.

    Floor division, not `/ 2`, because that is what CrowdAnalyzer did. It
    truncates the centre by up to half a pixel, which only ever matters for a
    box straddling a zone edge; keeping the quirk is what makes the two systems
    provably agree rather than nearly agree.
    """
    x, y, w, h = box[0], box[1], box[2], box[3]
    return (x + w // 2, y + h // 2)


def occupancy(
    boxes: Iterable[Sequence[float]],
    zones: Sequence[Zone] | None,
) -> dict[str, int]:
    """
    Counts boxes per zone, keyed by Zone.id.

    Ported behaviour, kept deliberately:
      - a box is placed by the centre of its bounding box;
      - the first zone that contains it wins, so overlapping zones do not
        double count;
      - every usable zone appears in the result, including zones with a count
        of zero, so a consumer can tell "no people here" from "no such zone".

    Returns `{}` when there is no trustworthy geometry, which is what the worker
    publishes rather than a count against boundaries nobody drew.
    """
    if not zones:
        return {}

    usable = [zone for zone in zones if zone.is_usable]
    if not usable:
        return {}

    counts: dict[str, int] = {zone.id: 0 for zone in usable}

    for box in boxes:
        centre = box_centre(box)
        for zone in usable:
            if point_in_zone(centre, zone):
                counts[zone.id] += 1
                break

    return counts
