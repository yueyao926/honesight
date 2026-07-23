import {useMemo,useState} from "react";
import {addComment,getComments,type CommunityComment} from "../../api/community";
import CommentItem from "./CommentItem";

export default function CommentSection({postId,allowComments,comments,setComments,onCreated}:{postId:number;allowComments:boolean;comments:CommunityComment[];setComments:React.Dispatch<React.SetStateAction<CommunityComment[]>>;onCreated:()=>void}){
  const [text,setText]=useState('');const [busy,setBusy]=useState(false);const roots=useMemo(()=>comments.filter(c=>!c.parent_id),[comments]);const replies=useMemo(()=>{const map=new Map<number,CommunityComment[]>();comments.filter(c=>c.parent_id).forEach(c=>map.set(c.parent_id!,[...(map.get(c.parent_id!)||[]),c]));return map},[comments]);
  async function submit(content=text,parentId?:number){if(!content.trim())return;setBusy(true);try{await addComment(postId,content.trim(),parentId);setComments(await getComments(postId));onCreated();if(!parentId)setText('')}finally{setBusy(false)}}
  function changed(next:CommunityComment){setComments(items=>items.map(c=>c.id===next.id?next:c))}
  return <section className="mt-7"><h2 className="font-display text-2xl">评论 {comments.length}</h2>{allowComments&&<div className="mt-4 flex gap-2"><input className="input" maxLength={2000} value={text} onChange={e=>setText(e.target.value)} placeholder="真诚交流你的观察…"/><button className="btn-primary" disabled={busy||!text.trim()} onClick={()=>submit(text)}>发送</button></div>}<div className="mt-5 space-y-4">{roots.map(c=><CommentItem key={c.id} comment={c} replies={replies.get(c.id)||[]} onReply={(target,content)=>submit(content,target.parent_id||target.id)} onChanged={changed}/>)}{!roots.length&&<p className="py-6 text-center text-sm text-muted">还没有评论，来分享第一条观察吧。</p>}</div></section>
}
