from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

FOLDER = Path(__file__).resolve().parents[1] / "src" / "PNG"
SHRINK = 0.07


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


def measure(path: Path) -> dict | None:
    hole, w, h = hole_mask(path)
    ys, xs = np.where(hole)
    if len(xs) < 100:
        return None

    points = np.column_stack([xs.astype(np.float32), ys.astype(np.float32)])
    (cx, cy), (rw, rh), angle = cv2.minAreaRect(points)
    rw, rh, angle = normalize_angle(float(rw), float(rh), float(angle))
    rw *= 1 - SHRINK
    rh *= 1 - SHRINK

    return {
        "index": int(path.stem.split("-")[1]),
        "cx": round(cx / w * 100, 2),
        "cy": round(cy / h * 100, 2),
        "width": round(rw / w * 100, 2),
        "height": round(rh / h * 100, 2),
        "rotate": round(angle, 2),
    }


def main() -> None:
    results = []
    for path in sorted(FOLDER.glob("frame-*.png")):
        data = measure(path)
        if data:
            results.append(data)
            print(path.name, data)

    out = Path(__file__).resolve().parents[1] / "src" / "components" / "community" / "frameMeasurements.json"
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nWrote {len(results)} frames to {out}")


if __name__ == "__main__":
    main()
