import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deletePost,
  favoritePost,
  getComments,
  getPost,
  likePost,
  unfavoritePost,
  unlikePost,
  type CommunityComment,
  type CommunityPost,
} from "../api/community";
import { getAssetUrl } from "../api/client";
import CommentSection from "../components/community/CommentSection";
import CommunityCameraNotes from "../components/community/CommunityCameraNotes";
import CommunityBackLink from "../components/community/CommunityBackLink";
import HeartLikeButton from "../components/HeartLikeButton";
import arrow20Svg from "../SVG/arrow-20.svg?url";

export default function CommunityPostDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [post, setPost] = useState<CommunityPost>();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [error, setError] = useState("");
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (!id) return;
    Promise.all([getPost(Number(id)), getComments(Number(id))])
      .then(([p, c]) => {
        setPost(p);
        setComments(c);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    setActiveImage(0);
  }, [post?.id]);

  useEffect(() => {
    if (!post || post.images.length <= 1) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        setActiveImage((index) => (index === 0 ? post!.images.length - 1 : index - 1));
      }
      if (event.key === "ArrowRight") {
        setActiveImage((index) => (index === post!.images.length - 1 ? 0 : index + 1));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [post]);

  if (error && !post) {
    return (
      <main className="handwriting-page container-page">
        <CommunityBackLink />
        <div className="card">{error}</div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="handwriting-page container-page">
        <CommunityBackLink />
        <div className="inspiration-skeleton" />
      </main>
    );
  }

  async function toggleLike() {
    const r = await (post!.is_liked ? unlikePost(post!.id) : likePost(post!.id));
    setPost({ ...post!, is_liked: r.liked, like_count: r.like_count });
  }

  async function toggleFavorite() {
    const r = await (post!.is_favorited ? unfavoritePost(post!.id) : favoritePost(post!.id));
    setPost({ ...post!, is_favorited: r.favorited, favorite_count: r.favorite_count });
  }

  const imageCount = post.images.length;
  const currentImage = post.images[activeImage] ?? post.images[0];

  function showPrevImage() {
    setActiveImage((index) => (index === 0 ? imageCount - 1 : index - 1));
  }

  function showNextImage() {
    setActiveImage((index) => (index === imageCount - 1 ? 0 : index + 1));
  }

  return (
    <main className="handwriting-page container-page community-post-detail-page">
      <CommunityBackLink />
      <article className="community-post-detail grid gap-8 lg:grid-cols-[1.25fr_.75fr]">
        <section className="community-post-detail__media">
          <div className="community-post-detail__viewer">
            <div className="community-post-detail__stage">
              {imageCount > 1 && (
                <button
                  type="button"
                  className="community-post-detail__nav community-post-detail__nav--prev"
                  aria-label="上一张"
                  onClick={showPrevImage}
                >
                  <img
                    src={arrow20Svg}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="community-post-detail__nav-icon community-post-detail__nav-icon--prev"
                  />
                </button>
              )}

              {currentImage && (
                <img
                  key={currentImage.id ?? activeImage}
                  className="community-post-detail__image"
                  src={getAssetUrl(currentImage.image_url)}
                  alt={currentImage.alt_text || post.title}
                />
              )}

              {imageCount > 1 && (
                <button
                  type="button"
                  className="community-post-detail__nav community-post-detail__nav--next"
                  aria-label="下一张"
                  onClick={showNextImage}
                >
                  <img
                    src={arrow20Svg}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="community-post-detail__nav-icon"
                  />
                </button>
              )}
            </div>

            {imageCount > 1 && (
              <span className="community-post-detail__counter" aria-live="polite">
                {activeImage + 1} / {imageCount}
              </span>
            )}
          </div>
        </section>

        <aside className="community-post-detail__aside">
          <div className="community-post-detail__aside-inner">
            <div className="flex items-center justify-between">
              <Link to={`/users/${post.author.id}`} className="flex items-center gap-3">
                {post.author.avatar_url ? (
                  <img
                    className="h-11 w-11 rounded-full object-cover"
                    src={getAssetUrl(post.author.avatar_url)}
                    alt=""
                  />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blush">
                    {post.author.username[0]}
                  </span>
                )}
                <div>
                  <strong>{post.author.username}</strong>
                  <p className="text-xs text-muted">{post.author.signature}</p>
                </div>
              </Link>
              {post.is_owner && (
                <div className="flex gap-2">
                  <Link className="btn-ghost" to={`/community/post/${post.id}/edit`}>
                    编辑
                  </Link>
                  <button
                    className="btn-ghost"
                    onClick={async () => {
                      if (confirm("确定删除这篇帖子吗？")) {
                        await deletePost(post.id);
                        nav("/community");
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              )}
            </div>

            <p className="label mt-8">TITLE</p>
            <h1 className="font-display text-4xl font-semibold">{post.title}</h1>

            <p className="label mt-5">NOTE</p>
            <p className="whitespace-pre-wrap leading-8">{post.content}</p>

            <p className="label mt-5">TAG</p>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <span className="rounded-full bg-blush px-3 py-1 text-sm text-ink" key={t.slug}>
                  #{t.name}
                </span>
              ))}
            </div>

            <CommunityCameraNotes post={post} />

            <div className="community-post-detail__actions mt-7 flex flex-wrap items-center gap-3 border-y border-sand py-5">
              <HeartLikeButton
                checked={post.is_liked}
                onToggle={toggleLike}
                count={post.like_count}
                showCount
              />
              <button
                className={post.is_favorited ? "btn-primary" : "btn-secondary"}
                onClick={toggleFavorite}
              >
                收藏 {post.favorite_count}
              </button>
              <button
                className="btn-secondary"
                onClick={() =>
                  navigator.share
                    ? navigator.share({ title: post.title, url: location.href })
                    : navigator.clipboard.writeText(location.href)
                }
              >
                分享
              </button>
            </div>

            <CommentSection
              postId={post.id}
              allowComments={post.allow_comments}
              comments={comments}
              setComments={setComments}
              onCreated={() =>
                setPost((current) =>
                  current ? { ...current, comment_count: current.comment_count + 1 } : current,
                )
              }
            />
          </div>
        </aside>
      </article>
    </main>
  );
}
