import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {getFeed,type CommunityPost} from "../api/community";
import {getUnreadCount} from "../api/messages";
import PostCard from "../components/community/PostCard";
import CommunityPublishButton from "../components/community/CommunityPublishButton";
import UnreadMessageBadge from "../components/messages/UnreadMessageBadge";
import {useAuth} from "../contexts/AuthContext";
import feedTabLineSvg from "../SVG/line-3.svg?url";
import filmRollSvg from "../SVG/胶卷.svg?url";
import cameraSvg from "../SVG/相机.svg?url";

const FEED_TABS = [
  ["recommended", "推荐"],
  ["following", "关注"],
  ["latest", "最新"],
  ["hot", "热门"],
] as const;

export default function Community(){
  const {isAuthenticated}=useAuth();
  const [kind,setKind]=useState('recommended');
  const [posts,setPosts]=useState<CommunityPost[]>([]);
  const [cursor,setCursor]=useState<number|null>();
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [unread,setUnread]=useState(0);
  async function load(){setLoading(true);try{const r=await getFeed(kind,cursor||undefined);setPosts(x=>[...x,...r.items.filter(p=>!x.some(a=>a.id===p.id))]);setCursor(r.next_cursor)}catch(e){setError(e instanceof Error?e.message:'加载失败')}finally{setLoading(false)}}
  useEffect(()=>{setPosts([]);setCursor(undefined);setLoading(true);getFeed(kind).then(r=>{setPosts(r.items);setCursor(r.next_cursor)}).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[kind]);
  useEffect(()=>{if(isAuthenticated)getUnreadCount().then(r=>setUnread(r.unread_count)).catch(()=>{})},[isAuthenticated]);
  return <main className="handwriting-page container-page">
    <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div><p className="section-eyebrow">HoneSight Community</p><h1 className="page-title mt-2">看见作品，也看见成长</h1><p className="mt-3 text-muted">分享摄影作品、参数与后期思路，获得真实反馈。</p></div>
      <div className="flex flex-wrap gap-2">
        <Link className="hand-drawn-outline-button" to="/community/search">搜索</Link>
        {isAuthenticated&&<Link className="hand-drawn-outline-button" to="/community/messages">消息<UnreadMessageBadge count={unread}/></Link>}
        {isAuthenticated&&<Link className="hand-drawn-outline-button" to="/community/notifications">通知</Link>}
        <CommunityPublishButton />
      </div>
    </header>
    <nav className="community-feed-tabs" aria-label="社区内容分类">
      {FEED_TABS.map(([value, label]) => {
        const isActive = kind === value;
        return (
          <button
            key={value}
            type="button"
            className={`community-feed-tab${isActive ? " community-feed-tab--active" : ""}`}
            onClick={() => setKind(value)}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="community-feed-tab-label">{label}</span>
            {isActive && (
              <img
                src={feedTabLineSvg}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="community-feed-tab-line"
              />
            )}
          </button>
        );
      })}
    </nav>
    {error&&<p className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-ink">{error}</p>}
    {loading && !posts.length ? (
      <div className="community-wall" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="community-wall-post community-wall-post--skeleton">
            <div className="community-wall-photo-link">
              <div className="community-wall-polaroid community-wall-polaroid--skeleton" />
            </div>
            <div className="community-wall-notes">
              <div className="community-wall-skeleton-line community-wall-skeleton-line--short" />
              <div className="community-wall-skeleton-line community-wall-skeleton-line--title" />
              <div className="community-wall-skeleton-line" />
              <div className="community-wall-skeleton-line community-wall-skeleton-line--meta" />
            </div>
          </div>
        ))}
      </div>
    ) : posts.length ? (
      <>
        <div className="community-wall">
          {posts.map((p, index) => (
            <PostCard
              key={p.id}
              index={index}
              post={p}
              onChange={(next) => setPosts((x) => x.map((a) => (a.id === next.id ? next : a)))}
            />
          ))}
        </div>
        {cursor ? (
          <button className="btn-secondary mx-auto mt-8 block" disabled={loading} onClick={load}>
            {loading ? "加载中…" : "加载更多"}
          </button>
        ) : (
          <p className="community-wall-end">已经看到这里了</p>
        )}
        <div className="community-wall-footer">
          <img src={cameraSvg} alt="" aria-hidden="true" draggable={false} className="community-wall-footer-icon" />
          <button type="button" className="community-wall-footer-link" onClick={() => setKind("hot")}>
            没有灵感？去看看大家的作品吧！ →
          </button>
        </div>
      </>
    ) : (
      <div className="community-empty text-center">
        <img src={filmRollSvg} alt="" aria-hidden="true" draggable={false} className="community-empty-film" />
        <p className="community-empty-title">这里还安静得像一卷没冲洗的胶片。</p>
        <p className="community-empty-subtitle">成为第一个贴照片的人吧。</p>
      </div>
    )}
  </main>
}
