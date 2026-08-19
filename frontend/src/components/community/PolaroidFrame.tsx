import type { CSSProperties } from "react";
import type { PhotoBbox } from "./communityFrameAssets";

type PolaroidFrameProps = {
  frameUrl: string;
  maskUrl: string;
  photoBbox: PhotoBbox;
  photoUrl?: string;
  alt?: string;
};

export default function PolaroidFrame({
  frameUrl,
  maskUrl,
  photoBbox,
  photoUrl,
  alt = "",
}: PolaroidFrameProps) {
  return (
    <div
      className="community-wall-polaroid"
      style={
        {
          "--mask-image": `url(${maskUrl})`,
          "--photo-x": `${photoBbox.x}%`,
          "--photo-y": `${photoBbox.y}%`,
          "--photo-w": `${photoBbox.width}%`,
          "--photo-h": `${photoBbox.height}%`,
        } as CSSProperties
      }
    >
      <div className="community-wall-polaroid-photo-layer">
        <div className="community-wall-polaroid-photo-wrapper">
          {photoUrl ? (
            <img
              className="community-wall-polaroid-photo"
              src={photoUrl}
              alt={alt}
              loading="lazy"
            />
          ) : (
            <div className="community-wall-polaroid-photo community-wall-polaroid-photo--empty" aria-hidden="true" />
          )}
        </div>
      </div>
      <img
        className="community-wall-polaroid-frame"
        src={frameUrl}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
    </div>
  );
}
