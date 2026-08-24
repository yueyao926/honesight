import { useCallback, useEffect, useMemo, useRef } from "react";
import { getAssetUrl } from "../../api/client";
import type { CommunityPost } from "../../api/community";

export type PostCardSlide = {
  url: string;
  id?: number;
  width?: number | null;
  height?: number | null;
};

/** 社区流图片：优先 images（按 sort_order），fallback 到 cover_image_url */
export function usePostCardSlideImages(post: CommunityPost): PostCardSlide[] {
  return useMemo(() => {
    const sorted = [...post.images].sort((a, b) => a.sort_order - b.sort_order);
    const slides = sorted
      .map((image) => ({
        id: image.id,
        url: getAssetUrl(image.thumbnail_url || image.image_url),
        width: image.width,
        height: image.height,
      }))
      .filter((slide) => Boolean(slide.url));
    if (slides.length) return slides;
    if (post.cover_image_url) {
      return [{ url: getAssetUrl(post.cover_image_url) }];
    }
    return [];
  }, [post]);
}
