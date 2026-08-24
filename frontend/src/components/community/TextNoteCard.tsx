import { Link } from "react-router-dom";
import type { CommunityPost } from "../../api/community";
import arrow31Svg from "../../SVG/arrow-31.svg?url";
import type { NoteCardLayout } from "./communityFeedLayout";
import CommunityCardMeta from "./CommunityCardMeta";

const NOTE_LABELS: Record<string, string> = {
  retouch: "后期思路分享",
  tutorial: "摄影教程",
  equipment: "设备经验",
  advice: "求建议",
  location: "拍摄地点",
  before_after: "前后对比",
};

type TextNoteCardProps = {
  post: CommunityPost;
  layout: NoteCardLayout;
  onChange?: (post: CommunityPost) => void;
};

function excerpt(text: string, max = 120) {
  const plain = text.replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max).trim()}…`;
}

function noteLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\-•·\d.)、]+/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
}

export default function TextNoteCard({ post, layout, onChange }: TextNoteCardProps) {
  const label = NOTE_LABELS[post.post_type] || "摄影笔记";
  const lines = noteLines(post.content);
  const sizeClass = layout.size === "medium" ? "text-note-card--medium" : "text-note-card--short";
  const decorationClass = layout.decoration ? ` text-note-card--${layout.decoration}` : "";

  return (
    <article className={`community-masonry-item community-card text-note-card ${sizeClass}${decorationClass}`.trim()}>
      <Link to={`/community/post/${post.id}`} className="text-note-card__body-link">
        <div className="text-note-card__body">
          {layout.variant === "note" ? (
            <>
              <div className="text-note-card__head">
                <span className="text-note-card__label">{label}</span>
                <img
                  src={arrow31Svg}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="text-note-card__arrow"
                />
              </div>
              <ul className="text-note-card__list">
                {(lines.length ? lines : [excerpt(post.content, 80)]).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h3 className="text-note-card__title">{post.title}</h3>
              <p className="text-note-card__excerpt">{excerpt(post.content || post.title, 100)}</p>
            </>
          )}
          {layout.decoration === "stamp" && (
            <span className="text-note-card__stamp" aria-hidden="true">
              SEE MORE
            </span>
          )}
        </div>
      </Link>
      <CommunityCardMeta post={post} onChange={onChange} className="text-note-card__meta" />
    </article>
  );
}
