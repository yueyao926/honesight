import { useEffect, useState } from "react";
import { getAssetUrl } from "../../api/client";
import type { CommunityImage } from "../../api/community";

type PostDetailImageProps = {
  image: CommunityImage;
  alt: string;
};

export default function PostDetailImage({ image, alt }: PostDetailImageProps) {
  const thumbUrl = getAssetUrl(image.thumbnail_url || image.image_url);
  const fullUrl = getAssetUrl(image.image_url);
  const progressive = Boolean(image.thumbnail_url && image.thumbnail_url !== image.image_url);

  const [displaySrc, setDisplaySrc] = useState(thumbUrl);
  const [fullReady, setFullReady] = useState(!progressive);

  useEffect(() => {
    setDisplaySrc(thumbUrl);
    setFullReady(!progressive);
    if (!progressive) return;

    const loader = new Image();
    loader.decoding = "async";
    loader.src = fullUrl;
    loader.onload = () => {
      setDisplaySrc(fullUrl);
      setFullReady(true);
    };
    return () => {
      loader.onload = null;
    };
  }, [thumbUrl, fullUrl, progressive]);

  return (
    <img
      className={`community-post-detail__image${fullReady ? "" : " community-post-detail__image--loading"}`}
      src={displaySrc}
      alt={alt}
      loading="eager"
      decoding="async"
      fetchPriority="high"
    />
  );
}
