import type { CommunityPost } from "../../api/community";
import {
  getCardAspectScoreForPost,
  getNoteCardLayout,
  getPhotoAspectRatio,
  isNotePost,
  areSimilarCardSizes,
} from "./communityFeedLayout";

const MASONRY_GAP = 20;
const META_BASE = 54;
const SAME_COLUMN_PENALTY = 1_000_000;
const SAME_ROW_PENALTY = 750_000;

/** 预估卡片高度，用于最短列分配（不用于实际渲染尺寸） */
export function estimateCardHeight(post: CommunityPost, index: number, columnWidth: number): number {
  const titleLines = post.title.length > 18 ? 2 : 1;
  const metaHeight = META_BASE + (titleLines - 1) * 14;

  if (isNotePost(post)) {
    const layout = getNoteCardLayout(post, index);
    const bodyHeight = layout.size === "medium" ? 220 : 160;
    return bodyHeight + metaHeight;
  }

  const aspect = getPhotoAspectRatio(post, index);
  const imageHeight = columnWidth / aspect;
  return imageHeight + metaHeight;
}

export type MasonryPlacement<T> = {
  item: T;
  originalIndex: number;
};

type MasonryFeedEntry = {
  post: CommunityPost;
  originalIndex: number;
};

/** 将条目放入最短列，并避免同尺寸卡片相邻（同列或同一视觉行） */
export function distributeShortestColumn<T>(
  items: T[],
  columnCount: number,
  estimateHeight: (item: T, index: number) => number,
  gap = MASONRY_GAP,
  getAspectScore?: (item: T, index: number) => number,
): MasonryPlacement<T>[][] {
  const columns: MasonryPlacement<T>[][] = Array.from({ length: columnCount }, () => []);
  const heights = Array<number>(columnCount).fill(0);
  const lastAspect = Array<number | null>(columnCount).fill(null);

  items.forEach((item, originalIndex) => {
    const height = estimateHeight(item, originalIndex);
    const aspect = getAspectScore?.(item, originalIndex) ?? null;

    let bestCol = 0;
    let bestRank = Infinity;

    for (let col = 0; col < columnCount; col += 1) {
      let rank = heights[col];

      if (aspect !== null && lastAspect[col] !== null && areSimilarCardSizes(aspect, lastAspect[col]!)) {
        rank += SAME_COLUMN_PENALTY;
      }

      if (aspect !== null) {
        for (const neighbor of [col - 1, col + 1]) {
          if (neighbor < 0 || neighbor >= columnCount) continue;
          if (lastAspect[neighbor] === null) continue;

          const rowBand = Math.max(height, 100) * 0.16;
          if (Math.abs(heights[col] - heights[neighbor]) <= rowBand && areSimilarCardSizes(aspect, lastAspect[neighbor]!)) {
            rank += SAME_ROW_PENALTY;
          }
        }
      }

      if (rank < bestRank) {
        bestRank = rank;
        bestCol = col;
      }
    }

    columns[bestCol].push({ item, originalIndex });
    heights[bestCol] += height + gap;
    if (aspect !== null) lastAspect[bestCol] = aspect;
  });

  return columns;
}

/** 社区 feed：先错开尺寸，再按最短列 + 尺寸约束分配（含加载更多的全部帖子） */
export function distributeCommunityFeedPosts(
  posts: CommunityPost[],
  columnCount: number,
  columnWidth: number,
  reorder: (items: CommunityPost[], cols: number) => { post: CommunityPost; originalIndex: number }[],
): MasonryPlacement<MasonryFeedEntry>[][] {
  const feedEntries: MasonryFeedEntry[] = reorder(posts, columnCount).map(({ post, originalIndex }) => ({
    post,
    originalIndex,
  }));

  return distributeShortestColumn(
    feedEntries,
    columnCount,
    (entry) => estimateCardHeight(entry.post, entry.originalIndex, columnWidth),
    MASONRY_GAP,
    (entry) => getCardAspectScoreForPost(entry.post, entry.originalIndex),
  );
}

export function getColumnCount(width: number) {
  if (width <= 520) return 1;
  if (width <= 760) return 2;
  if (width <= 1100) return 3;
  return 5;
}

export function getMasonryGap(width: number) {
  return width <= 1100 ? 18 : MASONRY_GAP;
}
