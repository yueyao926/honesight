import type { CommunityPost } from "../../api/community";

type CommunityCameraNotesProps = {
  post: Pick<
    CommunityPost,
    | "device_name"
    | "lens_name"
    | "aperture"
    | "shutter_speed"
    | "iso"
    | "focal_length"
    | "location_name"
    | "published_at"
    | "created_at"
  >;
};

function formatAperture(value: string) {
  const trimmed = value.trim();
  if (/^f\s*\/?\s*/i.test(trimmed)) {
    return trimmed.replace(/^f\s*\/?\s*/i, "f / ");
  }
  return `f / ${trimmed}`;
}

function formatShutter(value: string) {
  const trimmed = value.trim().replace(/\s+/g, "");
  if (trimmed.includes("/")) {
    const [left, right] = trimmed.split("/");
    return `${left} / ${right}`;
  }
  return value.trim();
}

function formatFocalLength(value: string) {
  const trimmed = value.trim();
  return /mm$/i.test(trimmed) ? trimmed : `${trimmed}mm`;
}

function formatShotTime(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatShotDate(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function hasCameraNotes(post: CommunityCameraNotesProps["post"]) {
  return Boolean(
    post.device_name ||
      post.lens_name ||
      post.aperture ||
      post.shutter_speed ||
      post.iso ||
      post.focal_length ||
      post.location_name,
  );
}

export default function CommunityCameraNotes({ post }: CommunityCameraNotesProps) {
  if (!hasCameraNotes(post)) return null;

  const exifLines: string[] = [];
  if (post.device_name) exifLines.push(post.device_name.toUpperCase());
  if (post.lens_name) exifLines.push(post.lens_name);
  if (post.focal_length) exifLines.push(formatFocalLength(post.focal_length));
  if (post.aperture) exifLines.push(formatAperture(post.aperture));
  if (post.shutter_speed) exifLines.push(formatShutter(post.shutter_speed));
  if (post.iso) exifLines.push(`ISO ${post.iso}`);

  const when = post.published_at || post.created_at;
  const contextLines = [
    when ? formatShotTime(when) : null,
    when ? formatShotDate(when) : null,
    post.location_name || null,
  ].filter(Boolean) as string[];

  return (
    <>
      <p className="label mt-5">CAMERA</p>
      <div className="community-camera-notes">
        {exifLines.map((line, index) => (
          <p key={`exif-${index}-${line}`}>{line}</p>
        ))}
        {exifLines.length > 0 && contextLines.length > 0 && (
          <div className="community-camera-notes__gap" aria-hidden="true" />
        )}
        {contextLines.map((line, index) => (
          <p key={`ctx-${index}-${line}`}>{line}</p>
        ))}
      </div>
    </>
  );
}
