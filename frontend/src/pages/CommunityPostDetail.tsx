import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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
import { followUser, unfollowUser } from "../api/profile";
import { getAssetUrl } from "../api/client";
import CommentSection from "../components/community/CommentSection";
import CommunityCameraNotes from "../components/community/CommunityCameraNotes";
import CommunityPostDetailActions from "../components/community/CommunityPostDetailActions";
import CommunityBackLink from "../components/community/CommunityBackLink";
import OutlineLiftButton from "../components/ui/OutlineLiftButton";
import { useAuth } from "../contexts/AuthContext";
import arrow20Svg from "../SVG/arrow-20.svg?url";

function FireFlameIcon() {
  return (
    <svg className="outline-lift-button__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 18C8 20.4148 9.79086 21 12 21C15.7587 21 17 18.5 14.5 13.5C11 18 10.5 11 11 9C9.5 12 8 14.8177 8 18Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 21C17.0495 21 20 18.0956 20 13.125C20 8.15444 12 3 12 3C12 3 4 8.15444 4 13.125C4 18.0956 6.95054 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CommunityPostDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [post, setPost] = useState<CommunityPost>();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [error, setError] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const asideRef = useRef<HTMLElement>(null);

  const updateScrollHint = useCallback(() => {
    const aside = asideRef.current;
    if (!aside) return;

    const overflow = aside.scrollHeight - aside.clientHeight > 32;
    const nearBottom = aside.scrollTop + aside.clientHeight >= aside.scrollHeight - 32;
    setShowScrollHint(overflow && !nearBottom);
  }, []);

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

  useEffect(() => {
    updateScrollHint();
  }, [post, comments, updateScrollHint]);

  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;

    aside.addEventListener("scroll", updateScrollHint, { passive: true });
    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(aside);

    return () => {
      aside.removeEventListener("scroll", updateScrollHint);
      observer.disconnect();
    };
  }, [post, updateScrollHint]);

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

  async function toggleFollow() {
    if (!isAuthenticated) {
      nav("/login", { state: { from: location } });
      return;
    }
    if (!post || post.is_owner || followBusy) return;
    setFollowBusy(true);
    try {
      if (post.is_following_author) await unfollowUser(post.author.id);
      else await followUser(post.author.id);
      setPost({ ...post, is_following_author: !post.is_following_author });
    } catch (err) {
      setError(err instanceof Error ? err.message : "关注失败");
    } finally {
      setFollowBusy(false);
    }
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

        <aside ref={asideRef} className="community-post-detail__aside">
          <div className="community-post-detail__aside-inner">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Link to={`/users/${post.author.id}`} className="shrink-0">
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
                </Link>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link to={`/users/${post.author.id}`} className="min-w-0 truncate">
                      <strong>{post.author.username}</strong>
                    </Link>
                    {!post.is_owner && (
                      <OutlineLiftButton
                        size="sm"
                        className="shrink-0"
                        variant="ghost"
                        disabled={followBusy}
                        onClick={() => void toggleFollow()}
                      >
                        <FireFlameIcon />
                        {post.is_following_author ? "已关注" : "关注"}
                      </OutlineLiftButton>
                    )}
                  </div>
                  {post.author.signature && (
                    <p className="truncate text-xs text-muted">{post.author.signature}</p>
                  )}
                </div>
              </div>
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

            <CommunityPostDetailActions
              post={post}
              onToggleLike={toggleLike}
              onToggleFavorite={toggleFavorite}
              onShare={() => {
                const shareUrl = window.location.href;
                return navigator.share
                  ? navigator.share({ title: post.title, url: shareUrl })
                  : navigator.clipboard.writeText(shareUrl);
              }}
            />

            <CommentSection
              postId={post.id}
              allowComments={post.allow_comments}
              comments={comments}
              setComments={setComments}
              showScrollHint={showScrollHint}
              onCommentsChange={(count) =>
                setPost((current) => (current ? { ...current, comment_count: count } : current))
              }
            />
          </div>
        </aside>
      </article>
    </main>
  );
}
