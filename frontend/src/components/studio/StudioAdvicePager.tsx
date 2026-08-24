import { useEffect, useState, type ReactNode } from "react";
import arrow24Svg from "../../SVG/arrow-24.svg?url";

export type StudioAdvicePage = {
  id: string;
  content: ReactNode;
};

type Props = {
  pages: StudioAdvicePage[];
  resetKey?: string;
  className?: string;
};

export default function StudioAdvicePager({ pages, resetKey = "", className = "" }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [resetKey]);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(pages.length - 1, 0)));
  }, [pages.length]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(current - 1, 0));
      }
      if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(current + 1, pages.length - 1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pages.length]);

  if (pages.length === 0) return null;

  const safeIndex = Math.min(index, pages.length - 1);
  const page = pages[safeIndex];
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < pages.length - 1;

  return (
    <div className={`studio-advice-pager ${className}`.trim()} aria-live="polite">
      <div className="studio-advice-pager__shell">
        <button
          type="button"
          className="studio-advice-pager__arrow studio-advice-pager__arrow--prev"
          onClick={() => setIndex((current) => Math.max(current - 1, 0))}
          disabled={!canPrev}
          aria-label="上一页"
        >
          <img src={arrow24Svg} alt="" aria-hidden="true" draggable={false} className="studio-advice-pager__icon studio-advice-pager__icon--prev" />
        </button>

        <div className="studio-advice-pager__page" key={page.id}>
          {page.content}
        </div>

        <button
          type="button"
          className="studio-advice-pager__arrow studio-advice-pager__arrow--next"
          onClick={() => setIndex((current) => Math.min(current + 1, pages.length - 1))}
          disabled={!canNext}
          aria-label="下一页"
        >
          <img src={arrow24Svg} alt="" aria-hidden="true" draggable={false} className="studio-advice-pager__icon" />
        </button>
      </div>

      <div className="studio-advice-pager__footer">
        <span className="studio-advice-pager__count">
          {safeIndex + 1} / {pages.length}
        </span>
      </div>
    </div>
  );
}
