type Props = {
  value: number;
  className?: string;
};

export default function StudioProgressBar({ value, className = "" }: Props) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <span className={`block h-1.5 rounded-full bg-sand ${className}`.trim()}>
      <span className="block h-1.5 rounded-full bg-ink" style={{ width: `${clamped}%` }} />
    </span>
  );
}
