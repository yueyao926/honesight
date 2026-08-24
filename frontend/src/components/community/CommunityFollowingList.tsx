import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getFollowingPeople, type FollowingPerson } from "../../api/community";
import { getAssetUrl } from "../../api/client";
import SearchLetterLoader from "../search/SearchLetterLoader";
import animalSvg from "../../SVG/动物.svg?url";
import "./CommunityFollowingList.css";

function workCover(person: FollowingPerson, postId: number) {
  const post = person.posts.find((item) => item.id === postId);
  if (!post) return "";
  return post.cover_image_url || post.images[0]?.thumbnail_url || post.images[0]?.image_url || "";
}

export default function CommunityFollowingList() {
  const [people, setPeople] = useState<FollowingPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    getFollowingPeople()
      .then((result) => {
        if (active) setPeople(result.items);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <SearchLetterLoader label="加载中" />;
  }

  if (error) {
    return <p className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-ink">{error}</p>;
  }

  if (!people.length) {
    return (
      <div className="community-empty community-following-empty">
        <img src={animalSvg} alt="" aria-hidden="true" draggable={false} className="community-following-empty__icon" />
        <div className="community-following-empty__copy">
          <p className="community-empty-title">还没有关注任何人</p>
          <p className="community-empty-subtitle">去推荐或热门里看看，把喜欢的创作者加进来。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="community-following-list">
      {people.map((person) => (
        <article key={person.author.id} className="community-following-person">
          <Link to={`/users/${person.author.id}`} className="community-following-identity">
            {person.author.avatar_url ? (
              <img src={getAssetUrl(person.author.avatar_url)} alt="" className="community-following-avatar" />
            ) : (
              <span className="community-following-avatar community-following-avatar--fallback">
                {person.author.username.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0">
              <strong className="community-following-name">{person.author.username}</strong>
              <span className="community-following-meta">
                {person.work_count} 篇作品
                {person.author.signature ? ` · ${person.author.signature}` : ""}
              </span>
            </span>
          </Link>
          {person.posts.length ? (
            <div className="community-following-works">
              {person.posts.map((post) => {
                const cover = workCover(person, post.id);
                return (
                  <Link
                    key={post.id}
                    to={`/community/post/${post.id}`}
                    className="community-following-work"
                    title={post.title}
                  >
                    {cover ? (
                      <img src={getAssetUrl(cover)} alt={post.title} />
                    ) : (
                      <span className="community-following-work-note">{post.title || "随记"}</span>
                    )}
                  </Link>
                );
              })}
              {person.work_count > person.posts.length ? (
                <Link
                  to={`/users/${person.author.id}`}
                  className="community-following-more"
                  aria-label={`还有 ${person.work_count - person.posts.length} 篇作品`}
                >
                  ...
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="community-following-empty-works">还没有公开作品</p>
          )}
        </article>
      ))}
    </div>
  );
}
