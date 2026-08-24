import inspirationCardBorderSvg from "../../SVG/Vector.svg?url";

type PracticeCategoryCardProps = {
  children: string;
  selected?: boolean;
  onClick: () => void;
};

export default function PracticeCategoryCard({ children, selected, onClick }: PracticeCategoryCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`practice-category-card ${selected ? "is-selected" : "is-idle"}`}
    >
      <span className="drawn-vector-frame">
        <span className="drawn-vector-frame-inner">
          <span className="text-xs text-muted">分类练习</span>
          <span className="mt-1.5 block font-display font-semibold practice-category-card-title">{children}</span>
        </span>
        <img
          src={inspirationCardBorderSvg}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="drawn-vector-frame-border"
        />
      </span>
    </button>
  );
}
