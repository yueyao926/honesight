import type { CommunityPost } from "../../api/community";
import arrow7Svg from "../../SVG/arrow-7.svg?url";
import favoriteTagSvg from "../../SVG/收藏标签.svg?url";
import HeartLikeButton from "../HeartLikeButton";
type CommunityPostDetailActionsProps = {
  post: CommunityPost;
  onToggleLike: () => void;
  onToggleFavorite: () => void;
  onShare: () => void;
};

export default function CommunityPostDetailActions({
  post,
  onToggleLike,
  onToggleFavorite,
  onShare,
}: CommunityPostDetailActionsProps) {
  return (
    <div className="community-post-detail__actions">
      <div className="post-detail-action post-detail-action--like">
        <HeartLikeButton
          checked={post.is_liked}
          onToggle={onToggleLike}
          count={post.like_count}
          showCount
          showLikeLabel
        />
      </div>

      <div className="post-detail-action post-detail-action--favorite">
        <button
          type="button"
          className={`post-detail-action__favorite-btn${post.is_favorited ? " is-active" : ""}`}
          onClick={onToggleFavorite}
          aria-label={post.is_favorited ? "取消收藏" : "收藏"}
          aria-pressed={post.is_favorited}
        >
          <img
            src={favoriteTagSvg}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="post-detail-action__favorite-icon"
          />
        </button>
        <button
          type="button"
          className="post-detail-action__label post-detail-action__label-btn"
          onClick={onToggleFavorite}
        >
          收藏 {post.favorite_count}
        </button>
      </div>

      <button type="button" className="post-detail-action post-detail-action--share" onClick={onShare} aria-label="分享">
        <img
          src={arrow7Svg}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="post-detail-action__icon post-detail-action__share-icon"
        />
        <span className="post-detail-action__label">分享</span>
      </button>
    </div>
  );
}
