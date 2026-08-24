import { Link } from "react-router-dom";
import { getAssetUrl } from "../../api/client";
import type { Conversation } from "../../api/messages";
import UnreadMessageBadge from "./UnreadMessageBadge";
import selectedMarkSvg from "../../SVG/misc-58.svg?url";
import "./ConversationList.css";

export default function ConversationList({ items, active }: { items: Conversation[]; active?: number }) {
  return (
    <div className="space-y-2">
      {items.map((conversation) => {
        const selected = active === conversation.id;
        return (
          <Link
            key={conversation.id}
            to={`/community/messages/${conversation.id}`}
            className={`conversation-item${selected ? " conversation-item--active" : ""}`}
          >
            <span className="conversation-item-mark" aria-hidden="true">
              {selected ? <img src={selectedMarkSvg} alt="" /> : null}
            </span>
            {conversation.peer.avatar_url ? (
              <img className="h-12 w-12 shrink-0 rounded-full object-cover" src={getAssetUrl(conversation.peer.avatar_url)} alt="" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sand">
                {conversation.peer.username[0]}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex justify-between">
                <strong>{conversation.peer.username}</strong>
                <UnreadMessageBadge count={conversation.unread_count} />
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {conversation.waiting_for_reply
                  ? "等待对方回复"
                  : conversation.is_request
                    ? "新的消息请求"
                    : conversation.last_message?.content || "还没有消息"}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
