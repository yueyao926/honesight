import { Link } from "react-router-dom";
import type { CommunityPost } from "../../api/community";
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

  return (
    <article className="community-masonry-item community-card photo-card">
      <Link to={`/community/post/${post.id}`} className="community-card-image-link">
        <WorkPreviewFilmstrip slides={slides} alt={alt} />
      </Link>
      <CommunityCardMeta post={post} onChange={onChange} />
    </article>
  );
}
