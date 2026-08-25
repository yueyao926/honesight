import { getFeed, type CommunityPost } from "../api/community";

export type FeedCache = {
  items: CommunityPost[];
  next_cursor?: number | null;
};

const pending = new Map<string, Promise<FeedCache>>();
const resolved = new Map<string, FeedCache>();

export function readCachedFeed(kind: string): FeedCache | null {
  return resolved.get(kind) ?? null;
}

export function writeCachedFeed(kind: string, data: FeedCache) {
  resolved.set(kind, data);
}

export function prefetchCommunityFeed(kind = "recommended") {
  if (resolved.has(kind)) {
    return Promise.resolve(resolved.get(kind)!);
  }
  if (pending.has(kind)) {
    return pending.get(kind)!;
  }

  const request = getFeed(kind)
    .then((result) => {
      resolved.set(kind, result);
      pending.delete(kind);
      return result;
    })
    .catch((error) => {
      pending.delete(kind);
      throw error;
    });

  pending.set(kind, request);
  return request;
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
