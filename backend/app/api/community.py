from datetime import datetime, timezone
import re
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_optional_user
from app.database import get_db
from app.models.community import CommunityPost, Comment, CommentLike, ContentAction, FavoriteCollection, Notification, PostFavorite, PostImage, PostLike, PostTag, PostView, Report, Tag, UserBlock
from app.models.profile import UserFollow
from app.models.user import User
from app.schemas.community import CollectionPayload, CommentPayload, FavoritePayload, PostPayload, PostUpdate, ReportPayload
from app.services.search import build_post_document

router = APIRouter(prefix="/community", tags=["community"])

def blocked(db, a, b):
    return bool(a and b and db.scalar(select(UserBlock.id).where(or_(and_(UserBlock.blocker_id==a, UserBlock.blocked_id==b), and_(UserBlock.blocker_id==b, UserBlock.blocked_id==a)))))

def visible(post, viewer, db):
    if post.deleted_at or post.status not in {"published", "draft"}: return False
    if viewer and viewer.id == post.author_id: return True
    if post.status != "published" or post.visibility == "private" or blocked(db, viewer.id if viewer else None, post.author_id): return False
    if post.visibility == "followers": return bool(viewer and db.scalar(select(UserFollow.id).where(UserFollow.follower_id==viewer.id, UserFollow.following_id==post.author_id)))
    return True

def post_dict(post, viewer, db):
    return {"id":post.id,"author":{"id":post.author.id,"username":post.author.username,"avatar_url":post.author.avatar_url,"signature":post.author.signature},"title":post.title,"content":post.content,"post_type":post.post_type,"visibility":post.visibility,"status":post.status,"allow_comments":post.allow_comments,"allow_ai_review":post.allow_ai_review,"allow_original_download":post.allow_original_download,"location_name":post.location_name,"device_name":post.device_name,"lens_name":post.lens_name,"aperture":post.aperture,"shutter_speed":post.shutter_speed,"iso":post.iso,"focal_length":post.focal_length,"editing_software":post.editing_software,"editing_notes":post.editing_notes,"cover_image_url":post.cover_image_url,"images":[{"id":i.id,"image_url":i.image_url,"thumbnail_url":i.thumbnail_url,"sort_order":i.sort_order,"width":i.width,"height":i.height,"image_role":i.image_role,"alt_text":i.alt_text} for i in post.images],"tags":[{"name":t.name,"slug":t.slug,"category":t.category} for t in post.tags],"view_count":post.view_count,"like_count":post.like_count,"favorite_count":post.favorite_count,"comment_count":post.comment_count,"share_count":post.share_count,"published_at":post.published_at,"created_at":post.created_at,"updated_at":post.updated_at,"is_liked":bool(viewer and db.scalar(select(PostLike.id).where(PostLike.user_id==viewer.id,PostLike.post_id==post.id))),"is_favorited":bool(viewer and db.scalar(select(PostFavorite.id).where(PostFavorite.user_id==viewer.id,PostFavorite.post_id==post.id))),"is_following_author":bool(viewer and db.scalar(select(UserFollow.id).where(UserFollow.follower_id==viewer.id,UserFollow.following_id==post.author_id))),"is_owner":bool(viewer and viewer.id==post.author_id)}

def load_post(db, post_id):
    return db.scalar(select(CommunityPost).options(selectinload(CommunityPost.images),selectinload(CommunityPost.tags),selectinload(CommunityPost.author)).where(CommunityPost.id==post_id))

def sync(post, payload, db):
    data=payload.model_dump(exclude={"images","tags","copyright_confirmed"})
    for k,v in data.items(): setattr(post,k,v.strip() if isinstance(v,str) else v)
    post.images.clear(); db.flush()
    for image in payload.images: post.images.append(PostImage(**image.model_dump()))
    post.image_count=len(payload.images); post.cover_image_url=payload.images[0].thumbnail_url or payload.images[0].image_url if payload.images else None
    db.execute(delete(PostTag).where(PostTag.post_id==post.id)); db.flush()
    for raw in payload.tags:
        name=raw.strip()[:60]
        if not name: continue
        slug=re.sub(r"[^a-z0-9\u4e00-\u9fff]+","-",name.lower()).strip("-")
        tag=db.scalar(select(Tag).where(Tag.name==name)) or Tag(name=name,slug=slug or f"tag-{post.id}")
        db.add(tag); db.flush(); db.add(PostTag(post_id=post.id,tag_id=tag.id)); tag.usage_count += 1

@router.post("/posts", status_code=201)
def create_post(payload:PostPayload,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    post=CommunityPost(author_id=user.id); db.add(post); db.flush(); sync(post,payload,db)
    if post.status=="published": post.published_at=datetime.now(timezone.utc)
    db.commit(); build_post_document(db,post.id); db.commit(); return post_dict(load_post(db,post.id),user,db)

@router.get("/posts/{post_id}")
def detail(post_id:int,viewer:User|None=Depends(get_optional_user),db:Session=Depends(get_db)):
    post=load_post(db,post_id)
    if not post or not visible(post,viewer,db): raise HTTPException(404,"帖子不存在或不可见")
    try:
        db.add(PostView(user_id=viewer.id if viewer else None,post_id=post.id)); db.flush(); post.view_count+=1; db.commit()
    except IntegrityError: db.rollback()
    return post_dict(load_post(db,post_id),viewer,db)

@router.patch("/posts/{post_id}")
def update(post_id:int,payload:PostUpdate,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    post=load_post(db,post_id)
    if not post or post.author_id!=user.id: raise HTTPException(403,"只能编辑自己的帖子")
    sync(post,payload,db)
    if post.status=="published" and not post.published_at: post.published_at=datetime.now(timezone.utc)
    db.commit(); build_post_document(db,post.id); db.commit(); return post_dict(load_post(db,post_id),user,db)

@router.delete("/posts/{post_id}",status_code=204)
def remove_post(post_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    post=db.get(CommunityPost,post_id)
    if not post or post.author_id!=user.id: raise HTTPException(403,"无权删除")
    post.status="deleted"; post.deleted_at=datetime.now(timezone.utc); db.commit(); build_post_document(db,post.id); db.commit()

@router.post("/posts/{post_id}/restore")
def restore(post_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    post=db.get(CommunityPost,post_id)
    if not post or post.author_id!=user.id: raise HTTPException(403,"无权恢复")
    post.status="draft"; post.deleted_at=None; db.commit(); return {"restored":True}

@router.get("/feed/{kind}")
def feed(kind:str,limit:int=Query(20,ge=1,le=50),cursor:int|None=None,tag:str|None=None,viewer:User|None=Depends(get_optional_user),db:Session=Depends(get_db)):
    q=select(CommunityPost).options(selectinload(CommunityPost.images),selectinload(CommunityPost.tags),selectinload(CommunityPost.author)).where(CommunityPost.status=="published",CommunityPost.visibility=="public",CommunityPost.deleted_at.is_(None))
    if cursor:q=q.where(CommunityPost.id<cursor)
    if kind=="following":
        if not viewer: raise HTTPException(401,"请先登录")
        q=q.join(UserFollow,UserFollow.following_id==CommunityPost.author_id).where(UserFollow.follower_id==viewer.id)
    if tag:q=q.join(PostTag).join(Tag).where(Tag.slug==tag)
    order=CommunityPost.hot_score.desc() if kind in {"hot","recommended"} else CommunityPost.published_at.desc()
    rows=db.scalars(q.order_by(order,CommunityPost.id.desc()).limit(limit+1)).unique().all(); items=rows[:limit]
    return {"items":[post_dict(p,viewer,db) for p in items],"next_cursor":items[-1].id if len(rows)>limit else None}

@router.get("/me/drafts")
def drafts(user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    rows=db.scalars(select(CommunityPost).options(selectinload(CommunityPost.images),selectinload(CommunityPost.tags),selectinload(CommunityPost.author)).where(CommunityPost.author_id==user.id,CommunityPost.status=="draft",CommunityPost.deleted_at.is_(None)).order_by(CommunityPost.updated_at.desc())).unique().all(); return [post_dict(p,user,db) for p in rows]

def notify(db,post,user,kind,comment_id=None):
    if post.author_id!=user.id and not blocked(db,post.author_id,user.id): db.add(Notification(recipient_id=post.author_id,actor_id=user.id,notification_type=kind,post_id=post.id,comment_id=comment_id))

@router.post("/posts/{post_id}/like")
def like(post_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    post=load_post(db,post_id)
    if not post or not visible(post,user,db): raise HTTPException(404,"帖子不可见")
    if not db.scalar(select(PostLike.id).where(PostLike.user_id==user.id,PostLike.post_id==post.id)):
        db.add(PostLike(user_id=user.id,post_id=post.id)); post.like_count+=1; post.hot_score+=3; notify(db,post,user,"post_like"); db.commit()
    return {"liked":True,"like_count":post.like_count}

@router.delete("/posts/{post_id}/like")
def unlike(post_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    row=db.scalar(select(PostLike).where(PostLike.user_id==user.id,PostLike.post_id==post_id)); post=db.get(CommunityPost,post_id)
    if row: db.delete(row); post.like_count=max(0,post.like_count-1); db.commit()
    return {"liked":False,"like_count":post.like_count if post else 0}

def default_collection(db,user_id):
    row=db.scalar(select(FavoriteCollection).where(FavoriteCollection.user_id==user_id,FavoriteCollection.is_default.is_(True)))
    if not row: row=FavoriteCollection(user_id=user_id,name="默认收藏夹",is_default=True); db.add(row); db.flush()
    return row

@router.post("/posts/{post_id}/favorite")
def favorite(post_id:int,payload:FavoritePayload,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    post=load_post(db,post_id)
    if not post or not visible(post,user,db): raise HTTPException(404,"帖子不可见")
    collection=db.get(FavoriteCollection,payload.collection_id) if payload.collection_id else default_collection(db,user.id)
    if not collection or collection.user_id!=user.id: raise HTTPException(403,"收藏夹不可用")
    if not db.scalar(select(PostFavorite.id).where(PostFavorite.user_id==user.id,PostFavorite.post_id==post_id)):
        db.add(PostFavorite(user_id=user.id,post_id=post_id,collection_id=collection.id)); post.favorite_count+=1; collection.post_count+=1; notify(db,post,user,"post_favorite"); db.commit()
    return {"favorited":True,"favorite_count":post.favorite_count}

@router.delete("/posts/{post_id}/favorite")
def unfavorite(post_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    row=db.scalar(select(PostFavorite).where(PostFavorite.user_id==user.id,PostFavorite.post_id==post_id)); post=db.get(CommunityPost,post_id)
    if row: collection=db.get(FavoriteCollection,row.collection_id); db.delete(row); post.favorite_count=max(0,post.favorite_count-1); collection.post_count=max(0,collection.post_count-1); db.commit()
    return {"favorited":False,"favorite_count":post.favorite_count if post else 0}

@router.get("/posts/{post_id}/comments")
def comments(post_id:int,viewer:User|None=Depends(get_optional_user),db:Session=Depends(get_db)):
    post=load_post(db,post_id)
    if not post or not visible(post,viewer,db): raise HTTPException(404,"帖子不存在或不可见")
    rows=db.scalars(select(Comment).options(selectinload(Comment.author)).where(Comment.post_id==post_id,Comment.deleted_at.is_(None),Comment.status=="published").order_by(Comment.created_at)).all()
    return [{"id":c.id,"content":c.content,"parent_id":c.parent_id,"reply_to_user_id":c.reply_to_user_id,"like_count":c.like_count,"reply_count":c.reply_count,"created_at":c.created_at,"is_liked":bool(viewer and db.scalar(select(CommentLike.id).where(CommentLike.user_id==viewer.id,CommentLike.comment_id==c.id))),"is_owner":bool(viewer and viewer.id==c.author_id),"author":{"id":c.author.id,"username":c.author.username,"avatar_url":c.author.avatar_url}} for c in rows]

@router.post("/posts/{post_id}/comments",status_code=201)
def add_comment(post_id:int,payload:CommentPayload,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    post=load_post(db,post_id)
    if not post or not visible(post,user,db) or not post.allow_comments: raise HTTPException(403,"评论已关闭或帖子不可见")
    parent=db.get(Comment,payload.parent_id) if payload.parent_id else None
    if parent and (parent.post_id!=post_id or parent.parent_id): raise HTTPException(400,"仅支持两级评论")
    if parent and blocked(db,user.id,parent.author_id): raise HTTPException(403,"暂时无法回复该评论")
    values=payload.model_dump();
    if parent and not values.get("reply_to_user_id"): values["reply_to_user_id"]=parent.author_id
    row=Comment(post_id=post_id,author_id=user.id,**values); db.add(row); db.flush(); post.comment_count+=1; post.hot_score+=4
    if parent: parent.reply_count+=1
    if parent and parent.author_id!=user.id and not blocked(db,parent.author_id,user.id): db.add(Notification(recipient_id=parent.author_id,actor_id=user.id,notification_type="comment_reply",post_id=post.id,comment_id=row.id))
    elif not parent: notify(db,post,user,"post_comment",row.id)
    db.commit(); return {"id":row.id,"created_at":row.created_at}

@router.post("/comments/{comment_id}/like")
def like_comment(comment_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    comment=db.scalar(select(Comment).where(Comment.id==comment_id).with_for_update())
    post=load_post(db,comment.post_id) if comment else None
    if not comment or comment.deleted_at or not post or not visible(post,user,db): raise HTTPException(404,"评论不存在或不可见")
    if not db.scalar(select(CommentLike.id).where(CommentLike.user_id==user.id,CommentLike.comment_id==comment_id)):
        db.add(CommentLike(user_id=user.id,comment_id=comment_id));comment.like_count+=1
        if comment.author_id!=user.id and not blocked(db,comment.author_id,user.id): db.add(Notification(recipient_id=comment.author_id,actor_id=user.id,notification_type="comment_like",post_id=comment.post_id,comment_id=comment.id))
        db.commit()
    return {"liked":True,"like_count":comment.like_count}

@router.delete("/comments/{comment_id}/like")
def unlike_comment(comment_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    comment=db.scalar(select(Comment).where(Comment.id==comment_id).with_for_update())
    if not comment: raise HTTPException(404,"评论不存在")
    row=db.scalar(select(CommentLike).where(CommentLike.user_id==user.id,CommentLike.comment_id==comment_id))
    if row: db.delete(row);comment.like_count=max(0,comment.like_count-1);db.commit()
    return {"liked":False,"like_count":comment.like_count}

@router.delete("/comments/{comment_id}",status_code=204)
def delete_comment(comment_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    comment=db.scalar(select(Comment).where(Comment.id==comment_id).with_for_update())
    if not comment or comment.deleted_at: raise HTTPException(404,"评论不存在")
    if comment.author_id!=user.id: raise HTTPException(403,"只能删除自己的评论")
    post=db.get(CommunityPost,comment.post_id)
    if not post: raise HTTPException(404,"帖子不存在")
    now=datetime.now(timezone.utc)
    comment.deleted_at=now
    post.comment_count=max(0,post.comment_count-1)
    if comment.parent_id:
        parent=db.get(Comment,comment.parent_id)
        if parent and not parent.deleted_at: parent.reply_count=max(0,parent.reply_count-1)
    else:
        replies=db.scalars(select(Comment).where(Comment.parent_id==comment_id,Comment.deleted_at.is_(None))).all()
        for reply in replies:
            reply.deleted_at=now
            post.comment_count=max(0,post.comment_count-1)
        comment.reply_count=0
    db.commit()

@router.get("/me/favorite-collections")
def collections(user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    default_collection(db,user.id); db.commit(); return db.scalars(select(FavoriteCollection).where(FavoriteCollection.user_id==user.id).order_by(FavoriteCollection.is_default.desc(),FavoriteCollection.created_at)).all()

@router.post("/me/favorite-collections",status_code=201)
def create_collection(payload:CollectionPayload,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    row=FavoriteCollection(user_id=user.id,**payload.model_dump()); db.add(row); db.commit(); db.refresh(row); return row

@router.get("/notifications")
def notifications(user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    rows=db.scalars(select(Notification).options(selectinload(Notification.actor)).where(Notification.recipient_id==user.id).order_by(Notification.created_at.desc()).limit(50)).all(); return [{"id":n.id,"type":n.notification_type,"post_id":n.post_id,"comment_id":n.comment_id,"is_read":n.is_read,"created_at":n.created_at,"actor":{"id":n.actor.id,"username":n.actor.username,"avatar_url":n.actor.avatar_url} if n.actor else None} for n in rows]

@router.post("/notifications/read-all")
def read_all(user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    for n in db.scalars(select(Notification).where(Notification.recipient_id==user.id,Notification.is_read.is_(False))): n.is_read=True
    db.commit(); return {"read":True}

@router.get("/search")
def search(q:str=Query(min_length=1,max_length=80),viewer:User|None=Depends(get_optional_user),db:Session=Depends(get_db)):
    pattern=f"%{q}%"; posts=db.scalars(select(CommunityPost).options(selectinload(CommunityPost.images),selectinload(CommunityPost.tags),selectinload(CommunityPost.author)).where(CommunityPost.status=="published",CommunityPost.visibility=="public",CommunityPost.deleted_at.is_(None),or_(CommunityPost.title.ilike(pattern),CommunityPost.content.ilike(pattern))).limit(30)).unique().all(); users=db.scalars(select(User).where(User.is_deleted.is_(False),User.username.ilike(pattern)).limit(10)).all(); tags=db.scalars(select(Tag).where(Tag.is_active.is_(True),Tag.name.ilike(pattern)).limit(10)).all(); return {"posts":[post_dict(p,viewer,db) for p in posts],"users":[{"id":u.id,"username":u.username,"avatar_url":u.avatar_url} for u in users],"tags":[{"name":t.name,"slug":t.slug} for t in tags]}

@router.post("/reports",status_code=201)
def report(payload:ReportPayload,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    row=Report(reporter_id=user.id,**payload.model_dump()); db.add(row); db.commit(); return {"id":row.id,"status":row.status}

@router.post("/users/{user_id}/block")
def block(user_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    if user_id==user.id: raise HTTPException(400,"不能拉黑自己")
    if not db.scalar(select(UserBlock.id).where(UserBlock.blocker_id==user.id,UserBlock.blocked_id==user_id)): db.add(UserBlock(blocker_id=user.id,blocked_id=user_id))
    db.execute(delete(UserFollow).where(or_(and_(UserFollow.follower_id==user.id,UserFollow.following_id==user_id),and_(UserFollow.follower_id==user_id,UserFollow.following_id==user.id)))); db.commit(); return {"blocked":True}
