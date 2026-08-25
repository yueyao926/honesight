import { getFeed, type CommunityPost } from "../api/community";

export type FeedCache = {
  items: CommunityPost[];
  next_cursor?: number | null;
};

const FEED_KINDS = ["recommended", "latest", "hot"] as const;

const pending = new Map<string, Promise<FeedCache>>();
const resolved = new Map<string, FeedCache>();
let cacheEpoch = 0;

function storeFeed(kind: string, data: FeedCache, epoch: number) {
  if (epoch !== cacheEpoch) return;
  resolved.set(kind, data);
  pending.delete(kind);
}

export function invalidateCommunityFeedCache(kinds?: string[]) {
  cacheEpoch += 1;
  const targets = kinds ?? [...FEED_KINDS];
  for (const kind of targets) {
    resolved.delete(kind);
    pending.delete(kind);
  }
}

export function readCachedFeed(kind: string): FeedCache | null {
  return resolved.get(kind) ?? null;
}

export function writeCachedFeed(kind: string, data: FeedCache) {
  resolved.set(kind, data);
}

function fetchFeed(kind: string) {
  const epoch = cacheEpoch;
  const request = getFeed(kind)
    .then((result) => {
      storeFeed(kind, result, epoch);
      return result;
    })
    .catch((error) => {
      if (epoch === cacheEpoch) {
        pending.delete(kind);
      }
      throw error;
    });

  pending.set(kind, request);
  return request;
}

export function prefetchCommunityFeed(kind = "recommended") {
  if (resolved.has(kind)) {
    return Promise.resolve(resolved.get(kind)!);
  }
  if (pending.has(kind)) {
    return pending.get(kind)!;
  }
  return fetchFeed(kind);
}

export function consumePrefetchedFeed(kind: string): Promise<FeedCache> | null {
  const inflight = pending.get(kind);
  if (inflight) {
    pending.delete(kind);
    return inflight;
  }
  const cached = resolved.get(kind);
  if (cached) {
    return Promise.resolve(cached);
  }
  return null;
}
