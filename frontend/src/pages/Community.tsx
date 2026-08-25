import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getFeed, type CommunityPost } from "../api/community";
import { consumePrefetchedFeed, readCachedFeed, writeCachedFeed } from "../utils/communityFeedPrefetch";
import CommunityFeed from "../components/community/CommunityFeed";
import CommunityFollowingList from "../components/community/CommunityFollowingList";
import { CommunityFeedActions, CommunityFeedTabs } from "../components/community/CommunityToolbar";
import { useAuth } from "../contexts/AuthContext";
import SquigglyText from "../components/ui/SquigglyText";
import arrow19Svg from "../SVG/arrow-19.svg?url";
import filmRollSvg from "../SVG/胶卷.svg?url";

const FEED_KINDS = new Set(["recommended", "latest", "hot"]);

type FeedSlice = {
  posts: CommunityPost[];
  cursor?: number | null;
  error: string;
};

function emptyFeedSlice(): FeedSlice {
  return { posts: [], cursor: undefined, error: "" };
}

function sliceFromCache(kind: string): FeedSlice | null {
  const cached = readCachedFeed(kind);
  if (!cached) return null;
  return { posts: cached.items, cursor: cached.next_cursor, error: "" };
}

export default function Community() {
  const { isAuthenticated } = useAuth();
  const [kind, setKind] = useState("recommended");
  const [mountedTabs, setMountedTabs] = useState(() => new Set(["recommended"]));
  const [feedState, setFeedState] = useState<FeedSlice>(() => sliceFromCache("recommended") ?? emptyFeedSlice());
  const [loading, setLoading] = useState(() => !readCachedFeed("recommended"));
  const activeKindRef = useRef(kind);

  useEffect(() => {
    activeKindRef.current = kind;
  }, [kind]);

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(kind)) return prev;
      const next = new Set(prev);
      next.add(kind);
      return next;
    });
  }, [kind]);

  useEffect(() => {
    if (!FEED_KINDS.has(kind)) return;

    const cached = sliceFromCache(kind);
    if (cached) {
      setFeedState(cached);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setFeedState(emptyFeedSlice());

    const request = consumePrefetchedFeed(kind) ?? getFeed(kind);
    request
      .then((result) => {
        if (!active || activeKindRef.current !== kind) return;
        writeCachedFeed(kind, result);
        setFeedState({
          posts: result.items,
          cursor: result.next_cursor,
          error: "",
        });
      })
      .catch((error) => {
        if (!active || activeKindRef.current !== kind) return;
        setFeedState({
          posts: [],
          cursor: undefined,
          error: error instanceof Error ? error.message : "加载失败",
        });
      })
      .finally(() => {
        if (active && activeKindRef.current === kind) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [kind]);

  const loadMore = useCallback(async () => {
    if (!FEED_KINDS.has(kind)) return;

    const current = sliceFromCache(kind) ?? feedState;
    setLoading(true);
    try {
      const result = await getFeed(kind, current.cursor || undefined);
      const merged = [
        ...current.posts,
        ...result.items.filter((post) => !current.posts.some((item) => item.id === post.id)),
      ];
      writeCachedFeed(kind, { items: merged, next_cursor: result.next_cursor });
      setFeedState({
        posts: merged,
        cursor: result.next_cursor,
        error: "",
      });
    } catch (error) {
      setFeedState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "加载失败",
      }));
    } finally {
      setLoading(false);
    }
  }, [kind, feedState]);

  const updatePost = useCallback((next: CommunityPost) => {
    setFeedState((prev) => ({
      ...prev,
      posts: prev.posts.map((item) => (item.id === next.id ? next : item)),
    }));
    const cached = readCachedFeed(kind);
    if (cached) {
      writeCachedFeed(kind, {
        items: cached.items.map((item) => (item.id === next.id ? next : item)),
        next_cursor: cached.next_cursor,
      });
    }
  }, [kind]);

  return (
    <main className="handwriting-page community-page">
      <div className="community-container">
        <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="community-header-intro">
            <span className="section-eyebrow community-header-eyebrow">HoneSight Community</span>
            <h1 className="page-title community-header-title">
              <span className="community-title-line">
                <span className="community-title-text">看见作品，也看见成长</span>
                <img src={arrow19Svg} alt="" aria-hidden="true" draggable={false} className="community-title-arrow" />
              </span>
            </h1>
            <p className="community-header-subtitle text-muted">
              <SquigglyText as="span" stepDuration={70} scale={[2, 3.5]} baseFrequency={0.018}>
                分享摄影作品、参数与后期思路，获得真实反馈。
              </SquigglyText>
            </p>
          </div>
          <CommunityFeedActions isAuthenticated={isAuthenticated} />
        </header>
        <CommunityFeedTabs kind={kind} onKindChange={setKind} />
        <div className="community-content">
          {mountedTabs.has("following") && (
            <div hidden={kind !== "following"}>
              {isAuthenticated ? (
                <CommunityFollowingList />
              ) : (
                <div className="community-empty text-center">
                  <p className="community-empty-title">登录后即可查看关注的人</p>
                  <p className="community-empty-subtitle">
                    <Link to="/login" className="underline">去登录</Link>
                    ，再回来看他们的作品。
                  </p>
                </div>
              )}
            </div>
          )}

          {FEED_KINDS.has(kind) && (
            <>
              {feedState.error && (
                <p className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-ink">{feedState.error}</p>
              )}
              {feedState.posts.length || loading ? (
                <CommunityFeed
                  posts={feedState.posts}
                  loading={loading}
                  cursor={feedState.cursor}
                  onLoadMore={loadMore}
                  onPostChange={updatePost}
                />
              ) : (
                <div className="community-empty text-center">
                  <img src={filmRollSvg} alt="" aria-hidden="true" draggable={false} className="community-empty-film" />
                  <p className="community-empty-title">这里还安静得像一卷没冲洗的胶片。</p>
                  <p className="community-empty-subtitle">成为第一个贴照片的人吧。</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
