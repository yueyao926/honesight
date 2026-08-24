from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PNG_DIR = ROOT / "src" / "PNG"
OUT = ROOT / "src" / "components" / "community" / "manifest.json"

CANVAS_W = 1122
CANVAS_H = 1402


def bbox_from_mask(path: Path) -> dict:
    arr = np.array(Image.open(path).convert("RGBA"))
    h, w, _ = arr.shape
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 128)
    if len(xs) == 0:
        return {"x": 0, "y": 0, "width": 100, "height": 100}

    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())

    return {
        "x": round(x0 / w * 100, 4),
        "y": round(y0 / h * 100, 4),
        "width": round((x1 - x0) / w * 100, 4),
        "height": round((y1 - y0) / h * 100, 4),
    }


def main() -> None:
    frames = []
    for path in sorted(PNG_DIR.glob("frame_*_mask.png")):
        match = path.stem.replace("frame_", "").replace("_mask", "")
        index = int(match)
        bbox = bbox_from_mask(path)
        frames.append(
            {
                "id": f"frame_{index:02d}",
                "index": index,
                "photo_bbox": bbox,
            }
        )
        print(path.name, bbox)

    manifest = {
        "canvas": {"width": CANVAS_W, "height": CANVAS_H},
        "frames": frames,
    }
    OUT.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
