type SearchMagnifierIconProps = {
  className?: string;
};

export default function SearchMagnifierIcon({ className = "" }: SearchMagnifierIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="26" cy="26" r="16" stroke="currentColor" strokeWidth="3.5" strokeOpacity="0.25" />
      <line
        x1="36.5"
        y1="36.5"
        x2="49"
        y2="49"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeOpacity="0.25"
      />
      <circle cx="28" cy="28" r="16" stroke="currentColor" strokeWidth="3.5" />
      <line
        x1="39.5"
        y1="39.5"
        x2="52"
        y2="52"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
