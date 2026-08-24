import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svg = fs.readFileSync(path.join(__dirname, "../src/SVG/camera_person_extracted.svg"), "utf8");
const paths = [...svg.matchAll(/<path d="([^"]+)" fill="([^"]+)"\/>/g)].map((m, i) => ({
  i: i + 1,
  d: m[1],
  fill: m[2],
}));

const headShellIdx = new Set([2]);
const headFeatureIdx = new Set([48, 49, 50, 51, 52, 53]);

const body = paths.filter((p) => p.i === 1);
const headShell = paths.filter((p) => headShellIdx.has(p.i));
const headFeatures = paths.filter((p) => headFeatureIdx.has(p.i));
const camera = paths.filter((p) => p.i !== 1 && !headShellIdx.has(p.i) && !headFeatureIdx.has(p.i));

const serialize = (items) =>
  JSON.stringify(
    items.map(({ d, fill }) => ({ d, fill })),
    null,
    2,
  );

const out = `export type CameraPersonPath = { d: string; fill: string };

export const BODY_PATHS: CameraPersonPath[] = ${serialize(body)};

export const HEAD_SHELL_PATHS: CameraPersonPath[] = ${serialize(headShell)};

export const HEAD_FEATURE_PATHS: CameraPersonPath[] = ${serialize(headFeatures)};

export const CAMERA_PATHS: CameraPersonPath[] = ${serialize(camera)};
`;

fs.writeFileSync(path.join(__dirname, "../src/components/practice/cameraPersonPaths.ts"), out);
console.log(`body=${body.length} headShell=${headShell.length} headFeatures=${headFeatures.length} camera=${camera.length}`);
