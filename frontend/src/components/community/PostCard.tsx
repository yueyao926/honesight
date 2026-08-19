import { type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { getAssetUrl } from "../../api/client";
import { likePost, unlikePost, type CommunityPost } from "../../api/community";
import PolaroidFrame from "./PolaroidFrame";
import { pickFrameForPost } from "./communityFrameAssets";

/** Stable clockwise corrections (deg): one ~0.9, others 0.1~0.7. */
const CORRECTIONS = [0.15, 10.9, 0.35, 0.65, 0.2, 0.75] as const;

function excerpt(text: string, max = 64) {
  const plain = text.replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trim()}…`;
}

/** Hand-scattered offset per post + slot. */
function noteStyle(postId: number, slot: number): CSSProperties {
  const n = ((postId * 7919 + slot * 997) >>> 0) % 1000;
  return {
    marginLeft: `${(n % 17) - 6}px`,
    marginTop: `${(n % 9) - 2}px`,
  };
}

type PostCardProps = {
  post: CommunityPost;
  index: number;
  onChange: (post: CommunityPost) => void;
};

export default function PostCard({ post, index, onChange }: PostCardProps) {
  const frame = pickFrameForPost(post.id);
  const correction = CORRECTIONS[index % CORRECTIONS.length];
  const hoverFloatOnly = index % CORRECTIONS.length === 1;
  const tags = post.tags.slice(0, 3);
  const coverAlt = post.images[0]?.alt_text || post.title;
  const body = post.content.trim();
  const signature = post.author.signature?.trim();
  const metaParts = [
    post.location_name,
    post.device_name,
    post.images.length > 1 ? `${post.images.length} 张` : null,
  ].filter(Boolean);

  async function toggleLike(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
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
    <article className="community-wall-post">
      <Link to={`/community/post/${post.id}`} className="community-wall-photo-link">
        {frame.frameUrl && frame.maskUrl && (
          <div
            className={`polaroid-visual${hoverFloatOnly ? " polaroid-visual--hover-float-only" : ""}`}
            style={{ "--base-rotate": `${correction}deg` } as CSSProperties}
          >
            <PolaroidFrame
              frameUrl={frame.frameUrl}
              maskUrl={frame.maskUrl}
              photoBbox={frame.config.photoBbox}
              photoUrl={post.cover_image_url ? getAssetUrl(post.cover_image_url) : undefined}
              alt={coverAlt}
            />
          </div>
        )}
      </Link>

      <div className="community-wall-notes">
        <Link
          to={`/users/${post.author.id}`}
          className="community-wall-note community-wall-note--user"
          style={noteStyle(post.id, 0)}
          onClick={(e) => e.stopPropagation()}
        >
          @{post.author.username}
        </Link>

        {tags.length > 0 && (
          <p className="community-wall-note community-wall-note--tags" style={noteStyle(post.id, 1)}>
            {tags.map((t) => t.name).join(" · ")}
          </p>
        )}

        <Link
          to={`/community/post/${post.id}`}
          className="community-wall-note community-wall-note--title"
          style={noteStyle(post.id, 2)}
        >
          {post.title}
        </Link>

        {body && (
          <p className="community-wall-note community-wall-note--body" style={noteStyle(post.id, 3)}>
            「{excerpt(body)}」
          </p>
        )}

        {signature && (
          <p className="community-wall-note community-wall-note--signature" style={noteStyle(post.id, 4)}>
            {excerpt(signature, 36)}
          </p>
        )}

        {metaParts.length > 0 && (
          <p className="community-wall-note community-wall-note--meta" style={noteStyle(post.id, 5)}>
            {metaParts.join(" · ")}
          </p>
        )}

        <div className="community-wall-actions">
          <button
            type="button"
            aria-label={post.is_liked ? "取消点赞" : "点赞"}
            className={`community-wall-action${post.is_liked ? " community-wall-action--active" : ""}`}
            onClick={toggleLike}
          >
            <span aria-hidden="true">♡</span> {post.like_count}
          </button>
          <Link to={`/community/post/${post.id}`} className="community-wall-action">
            <span className="community-wall-action-bubble" aria-hidden="true">
              ○
            </span>{" "}
            {post.comment_count}
          </Link>
        </div>
      </div>
    </article>
  );
}
