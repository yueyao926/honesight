import { useEffect, useRef, useState } from "react";
import { HEART_PATH, HEART_VIEWBOX } from "./heartIconPath";
import "./HeartLikeButton.css";

type HeartLikeButtonProps = {
  checked: boolean;
  onToggle: () => void;
  size?: "md" | "sm" | "xs";
  count?: number;
  showCount?: boolean;
  /** 为 true 时显示「赞 {数量}」，否则仅显示数量或「赞」 */
  showLikeLabel?: boolean;
  className?: string;
  title?: string;
};

export default function HeartLikeButton({
  checked,
  onToggle,
  size = "md",
  count,
  showCount = false,
  showLikeLabel = false,
  className = "",
  title = "Like",
}: HeartLikeButtonProps) {
  const sizeClass = size === "md" ? "" : ` heart-container--${size}`;
  const prevChecked = useRef(checked);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    if (checked && !prevChecked.current) {
      setLiking(true);
      const timer = window.setTimeout(() => setLiking(false), 550);
      prevChecked.current = checked;
      return () => window.clearTimeout(timer);
    }
    prevChecked.current = checked;
  }, [checked]);

  return (
    <span className={`heart-like-row ${className}`.trim()}>
      <span className={`heart-container${sizeClass}${liking ? " heart-container--liking" : ""}`} title={title}>
        <input
          type="checkbox"
          className="heart-checkbox"
          checked={checked}
          onChange={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          aria-label={checked ? "取消点赞" : "点赞"}
        />
        <div className="svg-container">
          <svg viewBox={HEART_VIEWBOX} className="svg-outline" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d={HEART_PATH} fillRule="evenodd" clipRule="evenodd" />
          </svg>
          <svg viewBox={HEART_VIEWBOX} className="svg-filled" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d={HEART_PATH} fillRule="evenodd" clipRule="evenodd" />
          </svg>
        </div>
      </span>
      {showCount && (
        <span className={`heart-like-count${size !== "md" ? " heart-like-count--sm" : ""}`}>
          {showLikeLabel
            ? `赞 ${count ?? 0}`
            : count && count > 0
              ? count
              : "赞"}
        </span>
      )}
    </span>
  );
}
