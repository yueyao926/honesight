export default function UnreadMessageBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={`unread-hand-circle${label.length > 1 ? " unread-hand-circle--wide" : ""}`}
      aria-label={`${count} 条未读`}
    >
      {label}
    </span>
  );
}
