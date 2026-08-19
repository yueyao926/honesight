/** Polaroid frame + mask pairs from frontend/src/PNG/frame_XX.png */

import manifest from "./manifest.json";
import frameConfigs from "./frameConfigs.json";

const FRAME_MODULE = import.meta.glob<string>("../../PNG/frame_*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const MASK_MODULE = import.meta.glob<string>("../../PNG/frame_*_mask.png", {
  eager: true,
  query: "?url",
  import: "default",
});

export type PhotoBbox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FrameConfig = {
  index: number;
  id: string;
  photoBbox: PhotoBbox;
  wrapperRotate: number;
};

type FrameAsset = {
  index: number;
  frameUrl: string;
  maskUrl: string;
  config: FrameConfig;
};

const BBOX_BY_INDEX: Record<number, PhotoBbox> = Object.fromEntries(
  manifest.frames.map((row) => [row.index, row.photo_bbox as PhotoBbox]),
);

const ROTATE_BY_INDEX: Record<number, number> = Object.fromEntries(
  frameConfigs.map((row) => [row.index, row.wrapperRotate ?? 0]),
);

const DEFAULT_CONFIG: FrameConfig = {
  index: 0,
  id: "frame_00",
  photoBbox: { x: 10, y: 12, width: 80, height: 65 },
  wrapperRotate: 0,
};

const MASK_BY_INDEX: Record<number, string> = {};
for (const [path, url] of Object.entries(MASK_MODULE)) {
  const match = path.match(/frame_(\d+)_mask\.png$/i);
  if (match) MASK_BY_INDEX[Number(match[1])] = url;
}

const FRAMES: FrameAsset[] = Object.entries(FRAME_MODULE)
  .map(([path, url]) => {
    if (path.includes("_mask")) return null;
    const match = path.match(/frame_(\d+)\.png$/i);
    if (!match) return null;
    const index = Number(match[1]);
    const maskUrl = MASK_BY_INDEX[index];
    if (!maskUrl) return null;
    return {
      index,
      frameUrl: url,
      maskUrl,
      config: {
        index,
        id: `frame_${String(index).padStart(2, "0")}`,
        photoBbox: BBOX_BY_INDEX[index] ?? DEFAULT_CONFIG.photoBbox,
        wrapperRotate: ROTATE_BY_INDEX[index] ?? 0,
      },
    };
  })
  .filter((frame): frame is FrameAsset => frame !== null)
  .sort((a, b) => a.index - b.index);

/** Stable frame per post; consecutive IDs get different frames. */
export function pickFrameForPost(postId: number) {
  if (!FRAMES.length) {
    return { index: 0, frameUrl: "", maskUrl: "", config: DEFAULT_CONFIG };
  }
  const idx = ((postId - 1) % FRAMES.length + FRAMES.length) % FRAMES.length;
  return FRAMES[idx];
}