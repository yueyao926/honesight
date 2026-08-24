import { Link } from "react-router-dom";
import { getAssetUrl } from "../../api/client";
import { likePost, unlikePost, type CommunityPost } from "../../api/community";
import CommentActionLink from "../CommentActionButton";
import HeartLikeButton from "../HeartLikeButton";

type CommunityCardMetaProps = {
  post: CommunityPost;
  onChange?: (post: CommunityPost) => void;
  className?: string;
};

export default function CommunityCardMeta({ post, onChange, className = "" }: CommunityCardMetaProps) {
  async function toggleLike() {
    if (!onChange) return;
    const previous = post;
    onChange({
      ...post,
      is_liked: !post.is_liked,
      like_count: post.like_count + (post.is_liked ? -1 : 1),
    });
    try {
      await (post.is_liked ? unlikePost(post.id) : likePost(post.id));
    } catch {
      onChange(previous);
    }
  }

  return (
    <div className={`community-card-meta${className ? ` ${className}` : ""}`}>
      <div className="community-card-meta__main">
        <Link
          to={`/users/${post.author.id}`}
          className="community-card-meta__author"
          onClick={(event) => event.stopPropagation()}
        >
          {post.author.avatar_url ? (
            <img className="community-card-meta__avatar" src={getAssetUrl(post.author.avatar_url)} alt="" />
          ) : (
            <span className="community-card-meta__avatar community-card-meta__avatar--fallback">
              {post.author.username[0]}
            </span>
          )}
          <span className="community-card-meta__copy">
            <span className="community-card-meta__username">{post.author.username}</span>
            <span className="community-card-meta__title">{post.title}</span>
          </span>
        </Link>
        <div className="community-card-meta__actions" onClick={(event) => event.stopPropagation()}>
          <div className="community-card-meta__like">
            <HeartLikeButton checked={post.is_liked} onToggle={toggleLike} size="xs" />
            <span>{post.like_count}</span>
          </div>
          <CommentActionLink
            to={`/community/post/${post.id}`}
            count={post.comment_count}
            size="sm"
            icon="bubble"
            className="community-card-meta__comment"
          />
        </div>
      </div>
    </div>
  );
}
