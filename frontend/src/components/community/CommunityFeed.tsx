import type { CommunityPost } from "../../api/community";
import CommunityFeedCard from "./CommunityFeedCard";
import MasonryGrid, { MasonryGridSkeleton } from "./MasonryGrid";

type CommunityFeedProps = {
  posts: CommunityPost[];
  loading: boolean;
  cursor?: number | null;
  onLoadMore: () => void;
  onPostChange: (post: CommunityPost) => void;
};

export default function CommunityFeed({
  posts,
  loading,
  cursor,
  onLoadMore,
  onPostChange,
}: CommunityFeedProps) {
  if (loading && !posts.length) {
    return <MasonryGridSkeleton />;
  }

  if (!posts.length) {
    return null;
  }

  return (
    <>
      <MasonryGrid
        posts={posts}
        renderItem={(post, index) => (
          <CommunityFeedCard
            key={post.id}
            index={index}
            post={post}
            onChange={onPostChange}
          />
        )}
      />
      {cursor ? (
        <button className="btn-secondary mx-auto mt-8 block" disabled={loading} onClick={onLoadMore}>
          {loading ? "加载中…" : "加载更多"}
        </button>
      ) : (
        <p className="community-wall-end">已经看到这里了</p>
      )}
    </>
  );
}
