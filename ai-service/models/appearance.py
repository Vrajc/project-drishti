"""
Appearance attributes computed from the pixels of a crop.

Only `color` lives here, and it is a measurement rather than a label: the crop's
central region is converted to HSV, the modal hue/saturation/value bucket is
found, and that bucket is given its nearest name. The answer comes from the
image, so it is publishable under the same rule as a detection.

`vehicleType` deliberately does not live here. The contract's example says
"sedan", but nothing in this service can tell a sedan from a hatchback - that
needs a body-style classifier nobody has trained. The worker publishes the
detector's own class ("car", "truck", "bus", "motorcycle") instead, which is a
real classification from a real model.
"""

from __future__ import annotations

import cv2
import numpy as np

# Hue ranges in OpenCV's 0-179 scale, with the name each covers.
_HUE_NAMES: tuple[tuple[int, int, str], ...] = (
    (0, 9, "red"),
    (10, 22, "orange"),
    (23, 33, "yellow"),
    (34, 84, "green"),
    (85, 100, "cyan"),
    (101, 130, "blue"),
    (131, 160, "purple"),
    (161, 179, "red"),
)


def _hue_name(hue: float) -> str:
    for low, high, name in _HUE_NAMES:
        if low <= hue <= high:
            return name
    return "unknown"


def dominant_colour(crop: np.ndarray) -> str | None:
    """
    Names the dominant colour of a crop, or returns None when it cannot.

    None is returned for an empty or unusably small crop. A caller publishes
    that as null - "we did not measure a colour" - rather than defaulting to a
    common one.

    The centre half of the crop is used, because the edges of a bounding box are
    mostly background and would drag the answer toward the road surface.
    """
    if crop is None or crop.size == 0:
        return None

    height, width = crop.shape[:2]
    if height < 8 or width < 8:
        return None

    y0, y1 = height // 4, height - height // 4
    x0, x1 = width // 4, width - width // 4
    centre = crop[y0:y1, x0:x1]
    if centre.size == 0:
        return None

    hsv = cv2.cvtColor(centre, cv2.COLOR_BGR2HSV)
    hue = hsv[:, :, 0].astype(np.float32)
    saturation = hsv[:, :, 1].astype(np.float32)
    value = hsv[:, :, 2].astype(np.float32)

    median_saturation = float(np.median(saturation))
    median_value = float(np.median(value))

    # Achromatic first: a low-saturation pixel has no meaningful hue, and
    # reporting one would be reading noise as colour.
    if median_value < 45:
        return "black"
    if median_saturation < 40:
        if median_value > 190:
            return "white"
        return "grey"

    # Modal hue over the chromatic pixels only.
    chromatic = hue[(saturation >= 40) & (value >= 45)]
    if chromatic.size == 0:
        return "grey"

    histogram = np.bincount(chromatic.astype(np.int32), minlength=180)
    modal_hue = int(histogram.argmax())

    name = _hue_name(modal_hue)
    if name == "unknown":
        return None

    # A dark saturated colour reads as the colour, not as black; a very bright
    # weakly saturated one reads as a pale version. Neither is renamed further -
    # this stops at what the pixels support.
    return name
