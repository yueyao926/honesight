import type { FormEvent, KeyboardEvent } from "react";
import "./CommentComposer.css";

type CommentComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  placeholder?: string;
  maxLength?: number;
};

export default function CommentComposer({
  value,
  onChange,
  onSubmit,
  busy = false,
  placeholder = "真诚交流你的观察…",
  maxLength = 2000,
}: CommentComposerProps) {
  function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (busy || !value.trim()) return;
    onSubmit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <form className="comment-composer" onSubmit={handleSubmit}>
      <div className="comment-message-box">
        <input
          type="text"
          name="comment"
          className="comment-message-box__input"
          autoComplete="off"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="submit"
          className="comment-message-box__send"
          aria-label="发送评论"
          disabled={busy || !value.trim()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 664 663" aria-hidden="true">
            <path
              fill="none"
              d="M646.293 331.888L17.7538 17.6187L155.245 331.888M646.293 331.888L17.753 646.157L155.245 331.888M646.293 331.888L318.735 330.228L155.245 331.888"
            />
            <path
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeWidth="33.67"
              stroke="currentColor"
              d="M646.293 331.888L17.7538 17.6187L155.245 331.888M646.293 331.888L17.753 646.157L155.245 331.888M646.293 331.888L318.735 330.228L155.245 331.888"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}
