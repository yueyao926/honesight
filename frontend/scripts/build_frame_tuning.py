from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PNG_DIR = ROOT / "src" / "PNG"
OUT = ROOT / "src" / "components" / "community" / "frameTuning.json"

SHRINK = 0.065
STRAIGHTEN = 0.82


def hole_mask(path: Path) -> tuple[np.ndarray, int, int]:
    arr = np.array(Image.open(path).convert("RGBA"))
    h, w, _ = arr.shape
    alpha = arr[:, :, 3]
    transparent = alpha < 20
    outside = np.zeros(transparent.shape, bool)
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        if transparent[0, x]:
            q.append((x, 0))
            outside[0, x] = True
        if transparent[h - 1, x]:
            q.append((x, h - 1))
            outside[h - 1, x] = True
    for y in range(h):
        if transparent[y, 0]:
            q.append((0, y))
            outside[y, 0] = True
        if transparent[y, w - 1]:
            q.append((w - 1, y))
            outside[y, w - 1] = True

    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and transparent[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                q.append((nx, ny))

    return transparent & ~outside, w, h


def normalize_angle(rw: float, rh: float, angle: float) -> tuple[float, float, float]:
    if rw < rh:
        rw, rh = rh, rw
        angle += 90.0
    while angle > 45.0:
        angle -= 90.0
        rw, rh = rh, rw
    while angle < -45.0:
        angle += 90.0
        rw, rh = rh, rw
    return rw, rh, angle


def tune(index: int, cx: float, cy: float, width: float, height: float, rotate: float) -> dict:
    width = min(width * (1 - SHRINK), 88.0)
    height = height * (1 - SHRINK * 0.95)

    cx_adj = -2.8
    if cx > 53:
        cx_adj -= 1.2
    elif cx < 48:
        cx_adj += 0.4

    cy_adj = 0.35
    if cy > 46:
        cy_adj += 0.25

    focus = 56 + abs(rotate) * 0.55
    if cx > 53:
        focus += 2.5
    if rotate < -12:
        focus += 1.5

    manual: dict[int, dict] = {
        4: {"cx": 50.0, "cy": 45.5, "width": 75.0, "height": 53.5, "rotate": -10.5, "focusX": 61},
        8: {"cy": 44.0, "width": 73.0, "height": 75.5, "focusX": 57},
        11: {"cx": 51.0, "focusX": 64, "cxAdj": -3.5},
        13: {"cy": 51.5, "height": 66.0, "focusX": 63},
        14: {"cx": 53.5, "focusX": 64, "cxAdj": -4.0},
        16: {"cx": 49.5, "cy": 39.8, "width": 69.0, "height": 57.0, "focusX": 63},
        17: {"cx": 53.5, "focusX": 64, "cxAdj": -3.8},
    }

    row = {
        "index": index,
        "cx": round(cx + cx_adj + manual.get(index, {}).get("cxAdj", 0), 2),
        "cy": round(cy + cy_adj, 2),
        "width": round(width, 2),
        "height": round(height, 2),
        "rotate": round(rotate, 2),
        "straighten": round(-rotate * STRAIGHTEN, 2),
        "focusX": round(focus, 1),
        "nudgeX": 0,
        "nudgeY": 0.4,
    }
    row.update({k: v for k, v in manual.get(index, {}).items() if k not in ("cxAdj",)})
    if "cxAdj" in manual.get(index, {}):
        row["cx"] = round(cx + manual[index]["cxAdj"], 2)
    return row


def measure(path: Path) -> dict | None:
    hole, w, h = hole_mask(path)
    ys, xs = np.where(hole)
    if len(xs) < 100:
        return None

    points = np.column_stack([xs.astype(np.float32), ys.astype(np.float32)])
    (cx, cy), (rw, rh), angle = cv2.minAreaRect(points)
    rw, rh, angle = normalize_angle(float(rw), float(rh), float(angle))

    index = int(path.stem.split("-")[1])
    return tune(
        index,
        cx / w * 100,
        cy / h * 100,
        rw / w * 100,
        rh / h * 100,
        angle,
    )


def main() -> None:
    rows = []
    for path in sorted(PNG_DIR.glob("frame-*.png")):
        row = measure(path)
        if row:
            rows.append(row)
            print(path.name, row)

    OUT.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
