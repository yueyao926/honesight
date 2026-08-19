from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PNG_DIR = ROOT / "src" / "PNG"
OUT = ROOT / "src" / "components" / "community" / "frameConfigs.json"

STRAIGHTEN = 0.82
INSET = 0.012
IMAGE_PAD = 0.03


def hole_mask(path: Path) -> tuple[np.ndarray, int, int]:
    arr = np.array(Image.open(path).convert("RGBA"))
    h, w, _ = arr.shape
    alpha = arr[:, :, 3]
    transparent = alpha < 20
    outside = np.zeros(transparent.shape, bool)
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if transparent[y, x] and not outside[y, x]:
                q.append((x, y))
                outside[y, x] = True
    for y in range(h):
        for x in (0, w - 1):
            if transparent[y, x] and not outside[y, x]:
                q.append((x, y))
                outside[y, x] = True

    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and transparent[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                q.append((nx, ny))

    hole = transparent & ~outside

    labeled = cv2.connectedComponents(hole.astype(np.uint8))[1]
    if labeled.max() > 0:
        sizes = np.bincount(labeled.ravel())
        sizes[0] = 0
        hole = labeled == int(sizes.argmax())

    return hole.astype(np.uint8), w, h


def order_corners(points: np.ndarray) -> np.ndarray:
    center = points.mean(axis=0)
    angles = np.arctan2(points[:, 1] - center[1], points[:, 0] - center[0])
    return points[np.argsort(angles)]


def inset_polygon(points: np.ndarray, ratio: float) -> np.ndarray:
    center = points.mean(axis=0)
    return center + (points - center) * (1 - ratio)


def quad_from_contour(contour: np.ndarray) -> np.ndarray:
    for eps_ratio in (0.002, 0.004, 0.006, 0.01, 0.015, 0.02, 0.03):
        epsilon = eps_ratio * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        if len(approx) == 4:
            return approx.reshape(4, 2).astype(np.float32)

    rect = cv2.minAreaRect(contour)
    return cv2.boxPoints(rect).astype(np.float32)


def measure(path: Path) -> dict | None:
    hole_u8, w, h = hole_mask(path)
    if hole_u8.sum() < 10000:
        return None

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
    closed = cv2.morphologyEx(hole_u8 * 255, cv2.MORPH_CLOSE, kernel)
    eroded = cv2.erode(closed, kernel, iterations=1)

    contours, _ = cv2.findContours(eroded, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    contour = max(contours, key=cv2.contourArea)
    box = quad_from_contour(contour)
    box = order_corners(box)
    box = inset_polygon(box, INSET)
    box[:, 0] = np.clip(box[:, 0], 0, w)
    box[:, 1] = np.clip(box[:, 1], 0, h)

    xs = box[:, 0]
    ys = box[:, 1]
    pad_x = (xs.max() - xs.min()) * IMAGE_PAD
    pad_y = (ys.max() - ys.min()) * IMAGE_PAD
    img_x = max(0.0, float(xs.min() - pad_x))
    img_y = max(0.0, float(ys.min() - pad_y))
    img_w = min(float(w) - img_x, float(xs.max() - xs.min() + pad_x * 2))
    img_h = min(float(h) - img_y, float(ys.max() - ys.min() + pad_y * 2))

    _, _, rect_angle = cv2.minAreaRect(contour)
    index = int(path.stem.split("-")[1])
    photo_polygon = [[round(float(x), 1), round(float(y), 1)] for x, y in box]

    return {
        "index": index,
        "viewBox": [0, 0, w, h],
        "photoPolygon": photo_polygon,
        "photoRect": [round(img_x, 1), round(img_y, 1), round(img_w, 1), round(img_h, 1)],
        "wrapperRotate": round(-rect_angle * STRAIGHTEN, 2),
    }


def main() -> None:
    rows = []
    for path in sorted(PNG_DIR.glob("frame-*.png")):
        row = measure(path)
        if row:
            rows.append(row)
            print(path.name, row["photoPolygon"], "rotate", row["wrapperRotate"])

    OUT.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
