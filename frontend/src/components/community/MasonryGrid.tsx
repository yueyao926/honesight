import { Children, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CommunityPost } from "../../api/community";
import { reorderPostsForFeedVariety } from "./communityFeedLayout";
import {
  distributeCommunityFeedPosts,
  getColumnCount,
  getMasonryGap,
} from "./masonryLayout";

type MasonryFeedEntry = {
  post: CommunityPost;
  originalIndex: number;
};

type MasonryGridProps = {
  posts?: CommunityPost[];
  renderItem?: (post: CommunityPost, index: number) => ReactNode;
  children?: ReactNode;
  className?: string;
};

export { getColumnCount };

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    function measure() {
      setWidth(element!.getBoundingClientRect().width);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export default function MasonryGrid({ posts, renderItem, children, className = "" }: MasonryGridProps) {
  const { ref, width } = useContainerWidth();
  const columnCount = getColumnCount(width || (typeof window !== "undefined" ? window.innerWidth : 1280));
  const gap = getMasonryGap(width);
  const columnWidth = width > 0 ? (width - gap * (columnCount - 1)) / columnCount : 0;

  const distributedColumns = useMemo(() => {
    if (!posts?.length || !renderItem || columnWidth <= 0) return null;

    return distributeCommunityFeedPosts(posts, columnCount, columnWidth, reorderPostsForFeedVariety);
  }, [posts, renderItem, columnCount, columnWidth]);

  const fallbackColumns = useMemo(() => {
    if (distributedColumns || children == null) return null;
    const buckets: ReactNode[][] = Array.from({ length: columnCount }, () => []);
    Children.forEach(children, (child, index) => {
      if (!isValidElement(child)) return;
      buckets[index % columnCount].push(child);
    });
    return buckets;
  }, [distributedColumns, children, columnCount]);

  const columns = distributedColumns ?? fallbackColumns;

  return (
    <div ref={ref} className={`community-masonry${className ? ` ${className}` : ""}`}>
      {columns?.map((column, columnIndex) => (
        <div key={columnIndex} className="community-masonry-column">
          {distributedColumns
            ? column.map((placement) => {
                const entry = (placement as { item: MasonryFeedEntry }).item;
                return renderItem!(entry.post, entry.originalIndex);
              })
            : (column as ReactNode[])}
        </div>
      ))}
    </div>
  );
}

const SKELETON_VARIANTS = [
  "ratio-4-5",
  "ratio-3-2",
  "ratio-4-3",
  "ratio-3-4",
  "ratio-16-9",
  "ratio-4-5",
  "note-medium",
  "ratio-1-1",
  "ratio-3-4",
] as const;

export function MasonryGridSkeleton() {
  return (
    <MasonryGrid className="community-masonry--loading" aria-hidden="true">
      {SKELETON_VARIANTS.map((variant, index) => (
        <div
          key={variant + index}
          className={`community-masonry-item community-masonry-skeleton community-masonry-skeleton--${variant}`}
        />
      ))}
    </MasonryGrid>
  );
}
