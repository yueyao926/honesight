import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {getFeed,type CommunityPost} from "../api/community";
import {getUnreadCount} from "../api/messages";
import PostCard from "../components/community/PostCard";
import UnreadMessageBadge from "../components/messages/UnreadMessageBadge";
import {useAuth} from "../contexts/AuthContext";

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
  return <main className="container-page">
    <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div><p className="section-eyebrow">LensCoach Community</p><h1 className="page-title mt-2">看见作品，也看见成长</h1><p className="mt-3 text-muted">分享摄影作品、参数与后期思路，获得真实反馈。</p></div>
      <div className="flex flex-wrap gap-2">
        <Link className="btn-secondary" to="/community/search">搜索</Link>
        {isAuthenticated&&<Link className="btn-secondary" to="/community/messages">消息<UnreadMessageBadge count={unread}/></Link>}
        {isAuthenticated&&<Link className="btn-secondary" to="/community/notifications">通知</Link>}
        <Link className="btn-primary" to="/community/post/create">发布</Link>
      </div>
    </header>
    <nav className="my-8 flex gap-2 overflow-auto border-b border-sand pb-3">{[['recommended','推荐'],['following','关注'],['latest','最新'],['hot','热门']].map(([v,l])=><button key={v} className={kind===v?'rounded-full bg-brand px-5 py-2 text-sm text-white':'btn-ghost'} onClick={()=>setKind(v)}>{l}</button>)}</nav>
    {error&&<p className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading&&!posts.length?<div className="columns-2 gap-4 lg:columns-3">{[1,2,3,4,5,6].map(n=><div key={n} className="mb-4 h-72 animate-pulse break-inside-avoid rounded-3xl bg-sand/60"/>)}</div>:posts.length?<><div className="columns-2 gap-4 lg:columns-3">{posts.map(p=><PostCard key={p.id} post={p} onChange={next=>setPosts(x=>x.map(a=>a.id===next.id?next:a))}/>)}</div>{cursor?<button className="btn-secondary mx-auto mt-6 block" disabled={loading} onClick={load}>{loading?'加载中…':'加载更多'}</button>:<p className="py-8 text-center text-sm text-muted">已经看到这里了</p>}</>:<div className="card text-center"><h2 className="font-display text-2xl">还没有摄影帖</h2><p className="mt-2 text-muted">成为第一个分享作品的人吧。</p></div>}
  </main>
}
