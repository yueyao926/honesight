import {useEffect,useState} from "react";
import {getFeed,type CommunityPost} from "../api/community";
import CommunityFeed from "../components/community/CommunityFeed";
import {CommunityFeedActions,CommunityFeedTabs} from "../components/community/CommunityToolbar";
import {useAuth} from "../contexts/AuthContext";
import arrow19Svg from "../SVG/arrow-19.svg?url";
import filmRollSvg from "../SVG/胶卷.svg?url";

export default function Community(){
  const {isAuthenticated}=useAuth();
  const [kind,setKind]=useState('recommended');
  const [posts,setPosts]=useState<CommunityPost[]>([]);
  const [cursor,setCursor]=useState<number|null>();
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  async function load(){setLoading(true);try{const r=await getFeed(kind,cursor||undefined);setPosts(x=>[...x,...r.items.filter(p=>!x.some(a=>a.id===p.id))]);setCursor(r.next_cursor)}catch(e){setError(e instanceof Error?e.message:'加载失败')}finally{setLoading(false)}}
  useEffect(()=>{setPosts([]);setCursor(undefined);setLoading(true);getFeed(kind).then(r=>{setPosts(r.items);setCursor(r.next_cursor)}).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[kind]);
  return <main className="handwriting-page community-page">
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
          <p className="community-header-subtitle text-muted">分享摄影作品、参数与后期思路，获得真实反馈。</p>
        </div>
        <CommunityFeedActions isAuthenticated={isAuthenticated} />
      </header>
      <CommunityFeedTabs kind={kind} onKindChange={setKind} />
      <div className="community-content">
        {error&&<p className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-ink">{error}</p>}
        {posts.length || loading ? (
          <CommunityFeed
            posts={posts}
            loading={loading}
            cursor={cursor}
            onLoadMore={load}
            onPostChange={(next) => setPosts((items) => items.map((item) => (item.id === next.id ? next : item)))}
          />
        ) : (
          <div className="community-empty text-center">
            <img src={filmRollSvg} alt="" aria-hidden="true" draggable={false} className="community-empty-film" />
            <p className="community-empty-title">这里还安静得像一卷没冲洗的胶片。</p>
            <p className="community-empty-subtitle">成为第一个贴照片的人吧。</p>
          </div>
        )}
      </div>
    </div>
  </main>
}
