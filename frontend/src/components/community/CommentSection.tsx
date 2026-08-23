import { useMemo, useState } from "react";
import { addComment, deleteComment, getComments, type CommunityComment } from "../../api/community";
import CommentComposer from "./CommentComposer";
import CommentItem from "./CommentItem";

export default function CommentSection({
  postId,
  allowComments,
  comments,
  setComments,
  onCommentsChange,
  showScrollHint = false,
}: {
  postId: number;
  allowComments: boolean;
  comments: CommunityComment[];
  setComments: React.Dispatch<React.SetStateAction<CommunityComment[]>>;
  onCommentsChange: (count: number) => void;
  showScrollHint?: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const roots = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const replies = useMemo(() => {
    const map = new Map<number, CommunityComment[]>();
    comments
      .filter((c) => c.parent_id)
      .forEach((c) => map.set(c.parent_id!, [...(map.get(c.parent_id!) || []), c]));
    return map;
  }, [comments]);

  async function refreshComments() {
    const next = await getComments(postId);
    setComments(next);
    onCommentsChange(next.length);
  }

  async function submit(content = text, parentId?: number) {
    if (!content.trim()) return;
    setBusy(true);
    try {
      await addComment(postId, content.trim(), parentId);
      await refreshComments();
      if (!parentId) setText("");
    } finally {
      setBusy(false);
    }
  }

  function changed(next: CommunityComment) {
    setComments((items) => items.map((c) => (c.id === next.id ? next : c)));
  }

  async function removeComment(commentId: number) {
    await deleteComment(commentId);
    await refreshComments();
  }

  return (
    <section className="mt-7">
      <h2 className="font-display text-2xl">评论 {comments.length}</h2>
      {allowComments && (
        <div className="comment-composer-row">
          <CommentComposer
            value={text}
            onChange={setText}
            onSubmit={() => submit(text)}
            busy={busy}
          />
          {showScrollHint && (
            <p className="community-post-detail__scroll-hint" aria-hidden="true">
              下面还有内容，请下滑
            </p>
          )}
        </div>
      )}
      <div className="mt-5 space-y-4">
        {roots.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            replies={replies.get(c.id) || []}
            onReply={(target, content) => submit(content, target.parent_id || target.id)}
            onChanged={changed}
            onDelete={removeComment}
          />
        ))}
        {!roots.length && (
          <p className="py-6 text-center text-sm text-muted">还没有评论，来分享第一条观察吧。</p>
        )}
      </div>
    </section>
  );
}
