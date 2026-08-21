import { Link } from "react-router-dom";
import CommunityPublishButton from "./CommunityPublishButton";
import UnreadMessageBadge from "../messages/UnreadMessageBadge";
import feedTabLineSvg from "../../SVG/line-3.svg?url";
import { getUnreadCount } from "../../api/messages";
import { useEffect, useState } from "react";

const FEED_TABS = [
  ["recommended", "推荐"],
  ["following", "关注"],
  ["latest", "最新"],
  ["hot", "热门"],
] as const;

type CommunityToolbarProps = {
  kind: string;
  onKindChange: (kind: string) => void;
  isAuthenticated: boolean;
};

export function CommunityFeedActions({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    getUnreadCount()
      .then((result) => setUnread(result.unread_count))
      .catch(() => {});
  }, [isAuthenticated]);

  return (
    <div className="flex flex-wrap gap-2">
      <Link className="hand-drawn-outline-button" to="/community/search">
        搜索
      </Link>
      {isAuthenticated && (
        <Link className="hand-drawn-outline-button" to="/community/messages">
          消息
          <UnreadMessageBadge count={unread} />
        </Link>
      )}
      {isAuthenticated && (
        <Link className="hand-drawn-outline-button" to="/community/notifications">
          通知
        </Link>
      )}
      <CommunityPublishButton />
    </div>
  );
}

export function CommunityFeedTabs({ kind, onKindChange }: Pick<CommunityToolbarProps, "kind" | "onKindChange">) {
  return (
    <nav className="community-feed-tabs" aria-label="社区内容分类">
      {FEED_TABS.map(([value, label]) => {
        const isActive = kind === value;
        return (
          <button
            key={value}
            type="button"
            className={`community-feed-tab${isActive ? " community-feed-tab--active" : ""}`}
            onClick={() => onKindChange(value)}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="community-feed-tab-label">{label}</span>
            {isActive && (
              <img
                src={feedTabLineSvg}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="community-feed-tab-line"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export default function CommunityToolbar({ kind, onKindChange, isAuthenticated }: CommunityToolbarProps) {
  return (
    <>
      <CommunityFeedActions isAuthenticated={isAuthenticated} />
      <CommunityFeedTabs kind={kind} onKindChange={onKindChange} />
    </>
  );
}
