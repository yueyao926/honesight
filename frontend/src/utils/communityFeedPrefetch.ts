import { getFeed, type CommunityPost } from "../api/community";

type FeedCache = {
  items: CommunityPost[];
  next_cursor?: number | null;
};

const cache = new Map<string, Promise<FeedCache>>();

export function prefetchCommunityFeed(kind = "recommended") {
  if (cache.has(kind)) return cache.get(kind)!;
  const request = getFeed(kind);
  cache.set(kind, request);
  request.catch(() => cache.delete(kind));
  return request;
}

export function consumePrefetchedFeed(kind: string): Promise<FeedCache> | null {
  const pending = cache.get(kind);
  if (!pending) return null;
  cache.delete(kind);
  return pending;
}
