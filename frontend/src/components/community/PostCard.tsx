import { Link } from "react-router-dom";
import { getAssetUrl } from "../../api/client";
import { likePost, unlikePost, type CommunityPost } from "../../api/community";

export default function PostCard({post,onChange}:{post:CommunityPost;onChange:(p:CommunityPost)=>void}){
  async function toggle(e:React.MouseEvent){e.preventDefault();e.stopPropagation();const old=post;onChange({...post,is_liked:!post.is_liked,like_count:post.like_count+(post.is_liked?-1:1)});try{await(post.is_liked?unlikePost(post.id):likePost(post.id))}catch{onChange(old)}}
  return <article className="mb-5 break-inside-avoid overflow-hidden rounded-3xl bg-white/80 shadow-card">
    <Link to={`/community/post/${post.id}`} className="block">
      {post.cover_image_url&&<div className="relative"><img className="h-auto w-full" src={getAssetUrl(post.cover_image_url)} alt={post.images[0]?.alt_text||post.title} loading="lazy"/>{post.images.length>1&&<span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">{post.images.length} 张</span>}</div>}
      <div className="p-5"><div className="mb-2 flex gap-2"><span className="rounded-full bg-blush px-2 py-1 text-[11px] text-brand-deep">{post.post_type}</span></div><h2 className="font-display text-xl font-semibold">{post.title}</h2><div className="mt-4 flex items-center justify-between text-sm text-muted"><Link to={`/users/${post.author.id}`} onClick={e=>e.stopPropagation()} className="flex items-center gap-2">{post.author.avatar_url?<img className="h-7 w-7 rounded-full object-cover" src={getAssetUrl(post.author.avatar_url)} alt=""/>:<span className="flex h-7 w-7 items-center justify-center rounded-full bg-blush">{post.author.username[0]}</span>}<span>{post.author.username}</span></Link><button aria-label={post.is_liked?"取消点赞":"点赞"} className={post.is_liked?"text-brand-deep":""} onClick={toggle}>♡ {post.like_count}</button></div></div>
    </Link>
  </article>
}
