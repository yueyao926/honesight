import {useEffect,useState} from "react";
import {getAssetUrl} from "../../api/client";
import type {DirectMessage} from "../../api/messages";
import "./MessageBubble.css";

export default function MessageBubble({message,own}:{message:DirectMessage;own:boolean}){
  const [open,setOpen]=useState(false);
  const isImageOnly=message.status!=="deleted"&&Boolean(message.image_url)&&!message.content&&!message.shared_post;
  const time=new Date(message.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const imageSrc=message.image_url?getAssetUrl(message.image_url):"";

  useEffect(()=>{
    if(!open)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[open]);

  return (
    <div className={`flex ${own?"justify-end":"justify-start"}`}>
      <div className={`message-bubble ${own?"message-bubble--own":"message-bubble--peer"}${isImageOnly?" message-bubble--image":""}`}>
        {message.status==="deleted"?<span className="text-sm opacity-70">消息已删除</span>:<>
          {imageSrc&&<button type="button" className="message-bubble__image-btn" onClick={()=>setOpen(true)} aria-label="查看大图"><img className="message-bubble__image" src={imageSrc} alt="私信图片"/></button>}
          {message.shared_post&&<a className="mb-2 block rounded-2xl bg-black/10 p-3" href={`/community/post/${message.shared_post.id}`}><strong>{message.shared_post.title}</strong></a>}
          {message.content&&<p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>}
        </>}
        <p className="message-bubble__time">{time}</p>
      </div>
      {open&&imageSrc&&<div className="message-image-lightbox" role="dialog" aria-modal="true" aria-label="查看大图" onClick={()=>setOpen(false)}><img src={imageSrc} alt="私信图片大图" onClick={event=>event.stopPropagation()}/></div>}
    </div>
  );
}
