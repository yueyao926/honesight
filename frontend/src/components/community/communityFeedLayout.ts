import type { CommunityPost } from "../../api/community";

export type NoteSize = "short" | "medium";
export type NoteVariant = "quote" | "note";
export type NoteDecoration = "stamp" | "wave" | null;

export type NoteCardLayout = {
  size: NoteSize;
  variant: NoteVariant;
  decoration: NoteDecoration;
};

/** 图片宽高比，优先真实 dimensions */
export function getPhotoAspectRatio(post: CommunityPost, index = 0): number {
  const image = post.images[0];
  if (image?.width && image?.height && image.height > 0) {
    return image.width / image.height;
  }
  const fallbacks = [0.65, 1.28, 0.78, 1.52, 0.95, 1.12, 0.72, 1.35];
  return fallbacks[(post.id + index) % fallbacks.length];
}

function getCardAspectScore(post: CommunityPost, index: number): number {
  if (isNotePost(post)) {
    const layout = getNoteCardLayout(post, index);
    return layout.size === "medium" ? 0.58 : 0.72;
  }
  return getPhotoAspectRatio(post, index);
}

export function getCardAspectScoreForPost(post: CommunityPost, index: number): number {
  return getCardAspectScore(post, index);
}

/** 粗分尺寸档位：竖图 / 方图 / 横图 */
export function getCardSizeBucket(aspect: number): "portrait" | "square" | "landscape" {
  if (aspect < 0.92) return "portrait";
  if (aspect > 1.08) return "landscape";
  return "square";
}

export function areSimilarCardSizes(a: number, b: number): boolean {
  if (getCardSizeBucket(a) !== getCardSizeBucket(b)) return false;
  return Math.abs(a - b) < 0.22;
}

/**
 * 重排帖子顺序，不改变轮询分列时每列的数量。
 * 按槽位 0→1→2… 依次填充，每步选与左侧（同行）、上方（同列）尺寸差异最大的卡片。
 */
export function reorderPostsForFeedVariety(posts: CommunityPost[], columnCount: number) {
  if (posts.length <= 1 || columnCount <= 1) {
    return posts.map((post, originalIndex) => ({ post, originalIndex }));
  }

  type Scored = { post: CommunityPost; aspect: number; originalIndex: number };
  const remaining: Scored[] = posts.map((post, originalIndex) => ({
    post,
    aspect: getCardAspectScore(post, originalIndex),
    originalIndex,
  }));

  const slots: (Scored | null)[] = new Array(posts.length).fill(null);

  for (let slot = 0; slot < posts.length; slot += 1) {
    const above = slot >= columnCount ? slots[slot - columnCount] : null;
    const left = slot > 0 && slot % columnCount !== 0 ? slots[slot - 1] : null;

    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i += 1) {
      let score = 0;
      if (above) {
        score += Math.abs(remaining[i].aspect - above.aspect) * 3;
        if (areSimilarCardSizes(remaining[i].aspect, above.aspect)) score -= 800;
      }
      if (left) {
        score += Math.abs(remaining[i].aspect - left.aspect) * 2;
        if (areSimilarCardSizes(remaining[i].aspect, left.aspect)) score -= 600;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    slots[slot] = remaining.splice(bestIdx, 1)[0];
  }

  return slots.map((entry) => ({ post: entry!.post, originalIndex: entry!.originalIndex }));
}

/** 无 cover_image_url 且无 images 的帖子渲染为文字卡 */
export function isNotePost(post: CommunityPost) {
  return !post.cover_image_url && post.images.length === 0;
}

export function getNoteCardLayout(post: CommunityPost, index: number): NoteCardLayout {
  const size: NoteSize = (post.id + index) % 3 === 0 ? "medium" : "short";
  const variant: NoteVariant =
    post.post_type === "retouch" ||
    post.post_type === "tutorial" ||
    post.post_type === "equipment"
      ? "note"
      : "quote";

  let decoration: NoteDecoration = null;
  if (variant === "quote" && post.id % 5 === 0) decoration = "stamp";
  else if (post.id % 7 === 2) decoration = "wave";

  return { size, variant, decoration };
}
