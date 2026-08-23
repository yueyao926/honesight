import type { CommunityPost } from "../../api/community";
import "./CommunityCameraNotes.css";

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

function NoteRow({ items }: { items: string[] }) {
  if (!items.length) return null;

  return (
    <div className="community-camera-notes__row">
      {items.map((item, index) => (
        <span className="community-camera-notes__item" key={`${item}-${index}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

export default function CommunityCameraNotes({ post }: CommunityCameraNotesProps) {
  if (!hasCameraNotes(post)) return null;

  const gearItems = [
    post.lens_name || null,
    post.focal_length ? formatFocalLength(post.focal_length) : null,
  ].filter(Boolean) as string[];

  const exposureItems = [
    post.aperture ? formatAperture(post.aperture) : null,
    post.shutter_speed ? formatShutter(post.shutter_speed) : null,
    post.iso ? `ISO ${post.iso}` : null,
  ].filter(Boolean) as string[];

  const when = post.published_at || post.created_at;
  const contextItems = [
    when ? formatShotTime(when) : null,
    when ? formatShotDate(when) : null,
    post.location_name || null,
  ].filter(Boolean) as string[];

  return (
    <>
      <p className="label mt-5">CAMERA</p>
      <div className="community-camera-notes">
        {post.device_name && (
          <p className="community-camera-notes__device">{post.device_name.toUpperCase()}</p>
        )}
        <NoteRow items={gearItems} />
        <NoteRow items={exposureItems} />
        {contextItems.length > 0 && (
          <p className="community-camera-notes__row community-camera-notes__row--context community-camera-notes__item">
            {contextItems.join(" · ")}
          </p>
        )}
      </div>
    </>
  );
}
