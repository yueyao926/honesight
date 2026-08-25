import { useState } from "react";
import { getAssetUrl } from "../../api/client";
import { likeComment, unlikeComment, type CommunityComment } from "../../api/community";
import HeartLikeButton from "../HeartLikeButton";

type CommentItemProps = {
  comment: CommunityComment;
  replies: CommunityComment[];
  onReply: (comment: CommunityComment, content: string) => Promise<void>;
  onChanged: (comment: CommunityComment) => void;
  onDelete: (commentId: number) => Promise<void>;
};

export default function CommentItem({ comment, replies, onReply, onChanged, onDelete }: CommentItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function toggleLike() {
    const previous = comment;
    onChanged({
      ...comment,
      is_liked: !comment.is_liked,
      like_count: comment.like_count + (comment.is_liked ? -1 : 1),
    });
    try {
      const result = await (comment.is_liked ? unlikeComment(comment.id) : likeComment(comment.id));
      onChanged({ ...comment, is_liked: result.liked, like_count: result.like_count });
    } catch {
      onChanged(previous);
    }
  }

  async function toggleReplyLike(reply: CommunityComment) {
    const previous = reply;
    onChanged({
      ...reply,
      is_liked: !reply.is_liked,
      like_count: reply.like_count + (reply.is_liked ? -1 : 1),
    });
    try {
      const result = await (reply.is_liked ? unlikeComment(reply.id) : likeComment(reply.id));
      onChanged({ ...reply, is_liked: result.liked, like_count: result.like_count });
    } catch {
      onChanged(previous);
    }
  }

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onReply(comment, text.trim());
      setText("");
      setReplying(false);
      setExpanded(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(target: CommunityComment) {
    if (!confirm("确定删除这条评论吗？")) return;
    setDeletingId(target.id);
    try {
      await onDelete(target.id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <article className="rounded-2xl bg-white/55 p-4">
      <div className="flex gap-3">
        {comment.author.avatar_url ? (
          <img
            className="h-9 w-9 rounded-full object-cover"
            src={getAssetUrl(comment.author.avatar_url)}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush text-sm">
            {comment.author.username[0]}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm">{comment.author.username}</strong>
            <time className="text-[11px] text-muted">
              {new Date(comment.created_at).toLocaleDateString()}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{comment.content}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted">
            <HeartLikeButton
              checked={comment.is_liked}
              onToggle={toggleLike}
              size="xs"
              count={comment.like_count}
              showCount
            />
            <button type="button" onClick={() => setReplying((value) => !value)}>
              回复
            </button>
            {comment.is_owner && (
              <button
                type="button"
                disabled={deletingId === comment.id}
                onClick={() => handleDelete(comment)}
              >
                删除
              </button>
            )}
          </div>
          {replying && (
            <div className="mt-3 flex gap-2">
              <input
                className="input !py-2"
                autoFocus
                maxLength={2000}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={`回复 ${comment.author.username}`}
              />
              <button
                type="button"
                className="btn-primary !px-4 !py-2"
                disabled={busy || !text.trim()}
                onClick={submit}
              >
                发送
              </button>
            </div>
          )}
        </div>
      </div>
      {replies.length > 0 && (
        <div className="ml-12 mt-3">
          <button type="button" className="text-xs text-ink" onClick={() => setExpanded((value) => !value)}>
            {expanded ? `收起 ${replies.length} 条回复` : `展开 ${replies.length} 条回复`}
          </button>
          {expanded && (
            <div className="mt-3 space-y-3 border-l border-sand pl-4">
              {replies.map((reply) => (
                <div key={reply.id} className="flex gap-3 text-sm">
                  {reply.author.avatar_url ? (
                    <img
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                      src={getAssetUrl(reply.author.avatar_url)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blush text-xs">
                      {reply.author.username[0]}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <strong>{reply.author.username}</strong>
                      <HeartLikeButton
                        checked={reply.is_liked}
                        onToggle={() => toggleReplyLike(reply)}
                        size="xs"
                        count={reply.like_count}
                        showCount
                      />
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words leading-6">{reply.content}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                      <button
                        type="button"
                        onClick={() => {
                          setReplying(true);
                          setText(`@${reply.author.username} `);
                        }}
                      >
                        回复
                      </button>
                      {reply.is_owner && (
                        <button
                          type="button"
                          disabled={deletingId === reply.id}
                          onClick={() => handleDelete(reply)}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
