import { Link } from "react-router-dom";
import type { CommunityPost } from "../../api/community";
import { prefetchAssets } from "../../utils/prefetchAsset";
import CommunityCardMeta from "./CommunityCardMeta";
import { usePostCardSlideImages } from "./PostCardMedia";
import WorkPreviewFilmstrip from "./WorkPreviewFilmstrip";

type PhotoCardProps = {
  post: CommunityPost;
  onChange: (post: CommunityPost) => void;
};

export default function PhotoCard({ post, onChange }: PhotoCardProps) {
  const slides = usePostCardSlideImages(post);
  const alt = post.images[0]?.alt_text || post.title;

  function prefetchPostImages() {
    const sorted = [...post.images].sort((a, b) => a.sort_order - b.sort_order);
    prefetchAssets(sorted.map((image) => image.image_url));
  }

  return (
    <article className="community-masonry-item community-card photo-card">
      <Link
        to={`/community/post/${post.id}`}
        className="community-card-image-link"
        onMouseEnter={prefetchPostImages}
        onFocus={prefetchPostImages}
        onTouchStart={prefetchPostImages}
      >
        <WorkPreviewFilmstrip slides={slides} alt={alt} />
      </Link>
      <CommunityCardMeta post={post} onChange={onChange} />
    </article>
  );
}
