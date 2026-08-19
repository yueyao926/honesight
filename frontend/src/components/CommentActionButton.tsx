import { Link } from "react-router-dom";
import "./CommentActionButton.css";

type CommentActionLinkProps = {
  to: string;
  count: number;
  size?: "md" | "sm";
  className?: string;
};

function CommentIcon({ size = "md" }: { size?: "md" | "sm" }) {
  const sizeClass = size === "sm" ? " comment-action-button--sm" : "";
  return (
    <span className={`comment-action-button${sizeClass}`} title="评论">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path strokeWidth="1.5" d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" />
        <path strokeWidth="1.5" d="M8 12H16" />
        <path strokeWidth="1.5" d="M12 16V8" />
      </svg>
    </span>
  );
}

export default function CommentActionLink({
  to,
  count,
  size = "md",
  className = "",
}: CommentActionLinkProps) {
  return (
    <Link
      to={to}
      className={`comment-action-link community-wall-action ${className}`.trim()}
      aria-label={`评论 ${count}`}
    >
      <CommentIcon size={size} />
      <span className="comment-action-count">{count}</span>
    </Link>
  );
}

export { CommentIcon };
