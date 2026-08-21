import { Link } from "react-router-dom";
import "./CommentActionButton.css";

type CommentActionLinkProps = {
  to: string;
  count: number;
  size?: "md" | "sm";
  icon?: "plus" | "bubble";
  className?: string;
};

function CommentIcon({ size = "md", icon = "plus" }: { size?: "md" | "sm"; icon?: "plus" | "bubble" }) {
  const sizeClass = size === "sm" ? " comment-action-button--sm" : "";
  return (
    <span className={`comment-action-button${sizeClass}`} title="评论">
      {icon === "bubble" ? (
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path
            strokeWidth="1.5"
            d="M8 10H16M8 14H13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4523C3.22094 16.8088 3.28001 17.2161 3.17712 17.6006L2.58181 19.8267C2.32248 20.793 3.20701 21.6775 4.17335 21.4182L6.39941 20.8229C6.78393 20.72 7.19121 20.7791 7.54771 20.9565C8.88839 21.6244 10.4003 22 12 22Z"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path strokeWidth="1.5" d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" />
          <path strokeWidth="1.5" d="M8 12H16" />
          <path strokeWidth="1.5" d="M12 16V8" />
        </svg>
      )}
    </span>
  );
}

export default function CommentActionLink({
  to,
  count,
  size = "md",
  icon = "plus",
  className = "",
}: CommentActionLinkProps) {
  return (
    <Link
      to={to}
      className={`comment-action-link community-wall-action ${className}`.trim()}
      aria-label={`评论 ${count}`}
    >
      <CommentIcon size={size} icon={icon} />
      <span className="comment-action-count">{count}</span>
    </Link>
  );
}

export { CommentIcon };
