export type ImageMetadata = {
  width: number;
  height: number;
  orientation: number;
};

const HEADER_BYTES = 4 * 1024 * 1024;

function ascii(view: DataView, offset: number, length: number): string {
  if (offset < 0 || offset + length > view.byteLength) return "";
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

function jpegOrientation(view: DataView, start: number, end: number): number {
  if (ascii(view, start, 6) !== "Exif\0\0") return 1;
  const tiff = start + 6;
  if (tiff + 8 > end) return 1;
  const byteOrder = ascii(view, tiff, 2);
  const littleEndian = byteOrder === "II";
  if (!littleEndian && byteOrder !== "MM") return 1;
  if (view.getUint16(tiff + 2, littleEndian) !== 42) return 1;
  const ifdOffset = view.getUint32(tiff + 4, littleEndian);
  const ifd = tiff + ifdOffset;
  if (ifd + 2 > end) return 1;
  const count = view.getUint16(ifd, littleEndian);
  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > end) return 1;
    if (view.getUint16(entry, littleEndian) !== 0x0112) continue;
    const orientation = view.getUint16(entry + 8, littleEndian);
    return orientation >= 1 && orientation <= 8 ? orientation : 1;
  }
  return 1;
}

function parseJpeg(view: DataView): ImageMetadata | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  let orientation = 1;
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);

  while (offset + 4 <= view.byteLength) {
    while (offset < view.byteLength && view.getUint8(offset) === 0xff) offset += 1;
    if (offset >= view.byteLength) break;
    const marker = view.getUint8(offset);
    offset += 1;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda || offset + 2 > view.byteLength) break;

    const length = view.getUint16(offset);
    if (length < 2) return null;
    const segmentStart = offset + 2;
    const segmentEnd = offset + length;
    if (segmentEnd > view.byteLength) break;

    if (marker === 0xe1) {
      orientation = jpegOrientation(view, segmentStart, segmentEnd);
    }
    if (startOfFrameMarkers.has(marker) && segmentStart + 5 <= segmentEnd) {
      const height = view.getUint16(segmentStart + 1);
      const width = view.getUint16(segmentStart + 3);
      return width && height ? { width, height, orientation } : null;
    }
    offset = segmentEnd;
  }
  return null;
}

function parsePng(view: DataView): ImageMetadata | null {
  if (
    view.byteLength < 24
    || view.getUint32(0) !== 0x89504e47
    || view.getUint32(4) !== 0x0d0a1a0a
    || ascii(view, 12, 4) !== "IHDR"
  ) return null;
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width && height ? { width, height, orientation: 1 } : null;
}

function uint24LittleEndian(view: DataView, offset: number): number {
  return view.getUint8(offset)
    | (view.getUint8(offset + 1) << 8)
    | (view.getUint8(offset + 2) << 16);
}

function parseWebp(view: DataView): ImageMetadata | null {
  if (view.byteLength < 30 || ascii(view, 0, 4) !== "RIFF" || ascii(view, 8, 4) !== "WEBP") {
    return null;
  }
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const kind = ascii(view, offset, 4);
    const length = view.getUint32(offset + 4, true);
    const payload = offset + 8;
    if (payload + length > view.byteLength) return null;

    if (kind === "VP8X" && length >= 10) {
      return {
        width: uint24LittleEndian(view, payload + 4) + 1,
        height: uint24LittleEndian(view, payload + 7) + 1,
        orientation: 1,
      };
    }
    if (
      kind === "VP8 "
      && length >= 10
      && view.getUint8(payload + 3) === 0x9d
      && view.getUint8(payload + 4) === 0x01
      && view.getUint8(payload + 5) === 0x2a
    ) {
      return {
        width: view.getUint16(payload + 6, true) & 0x3fff,
        height: view.getUint16(payload + 8, true) & 0x3fff,
        orientation: 1,
      };
    }
    if (kind === "VP8L" && length >= 5 && view.getUint8(payload) === 0x2f) {
      const b1 = view.getUint8(payload + 1);
      const b2 = view.getUint8(payload + 2);
      const b3 = view.getUint8(payload + 3);
      const b4 = view.getUint8(payload + 4);
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
        orientation: 1,
      };
    }
    offset = payload + length + (length % 2);
  }
  return null;
}

export async function readImageMetadata(file: Blob): Promise<ImageMetadata | null> {
  const buffer = await file.slice(0, Math.min(file.size, HEADER_BYTES)).arrayBuffer();
  const view = new DataView(buffer);
  return parseJpeg(view) || parsePng(view) || parseWebp(view);
}
