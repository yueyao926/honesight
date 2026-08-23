import type { CommunityPost } from "../../api/community";
import SearchLetterLoader from "../search/SearchLetterLoader";
import CommunityFeedCard from "./CommunityFeedCard";
import MasonryGrid from "./MasonryGrid";

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
    return <SearchLetterLoader label="加载中" />;
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
        loading ? (
          <SearchLetterLoader label="加载中" />
        ) : (
          <button className="btn-secondary mx-auto mt-8 block" onClick={onLoadMore}>
            加载更多
          </button>
        )
      ) : (
        <p className="community-wall-end">已经看到这里了</p>
      )}
    </>
  );
}
