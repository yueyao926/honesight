from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.community import blocked, post_dict, visible
from app.api.deps import get_optional_user
from app.database import get_db
from app.models.community import CommunityPost, PostTag, Tag, UserBlock
from app.models.profile import UserFollow, UserPrivacySetting
from app.models.search import PostSearchDocument, SearchHistory
from app.models.user import User
from app.services.search import normalize_text, query_terms

router=APIRouter(prefix="/search",tags=["search"])

def save_history(db,user,q,kind):
    if user and q.strip():db.add(SearchHistory(user_id=user.id,query=q[:120],normalized_query=normalize_text(q)[:120],search_type=kind));db.commit()

def user_results(q,user,db,limit=20):
    n=normalize_text(q); pattern=f"%{n}%"
    score=case((func.lower(User.username)==n,100.0),(func.lower(User.username).like(f"{n}%"),80.0),else_=func.similarity(func.lower(User.username),n)*50)+case((User.signature.ilike(pattern),10.0),else_=0.0)
    query=select(User,score.label("score")).outerjoin(UserPrivacySetting,UserPrivacySetting.user_id==User.id).where(User.is_deleted.is_(False),or_(UserPrivacySetting.discoverable_by_username.is_(True),UserPrivacySetting.id.is_(None)),or_(User.username.ilike(pattern),User.signature.ilike(pattern),func.similarity(func.lower(User.username),n)>0.15))
    if user:query=query.where(~select(UserBlock.id).where(or_(and_(UserBlock.blocker_id==user.id,UserBlock.blocked_id==User.id),and_(UserBlock.blocker_id==User.id,UserBlock.blocked_id==user.id))).exists())
    rows=db.execute(query.order_by(desc("score")).limit(limit)).all();out=[]
    for u,s in rows:
        followers=db.scalar(select(func.count()).select_from(UserFollow).where(UserFollow.following_id==u.id)) or 0;works=db.scalar(select(func.count()).select_from(CommunityPost).where(CommunityPost.author_id==u.id,CommunityPost.status=="published")) or 0;following=bool(user and db.scalar(select(UserFollow.id).where(UserFollow.follower_id==user.id,UserFollow.following_id==u.id)))
        out.append({"id":u.id,"username":u.username,"avatar_url":u.avatar_url,"signature":u.signature,"bio":u.bio,"photography_level":u.photography_level,"follower_count":followers,"work_count":works,"is_following":following,"score":round(float(s or 0),3)})
    return out

def post_results(q,user,db,limit=24,post_type=None,location=None,device=None):
    terms=query_terms(q); conditions=[]
    for term in terms:conditions.extend([PostSearchDocument.normalized_text.ilike(f"%{term}%"),PostSearchDocument.search_text.ilike(f"%{term}%")])
    lexical=case((func.lower(CommunityPost.title)==normalize_text(q),20.0),(CommunityPost.title.ilike(f"%{q}%"),12.0),else_=0.0)
    score=lexical+func.greatest(func.similarity(PostSearchDocument.normalized_text,normalize_text(q))*10,0)+CommunityPost.hot_score*0.02
    query=select(CommunityPost,score.label("score")).join(PostSearchDocument,PostSearchDocument.post_id==CommunityPost.id).options(selectinload(CommunityPost.images),selectinload(CommunityPost.tags),selectinload(CommunityPost.author)).where(CommunityPost.status=="published",CommunityPost.deleted_at.is_(None),PostSearchDocument.index_status=="ready",or_(*conditions))
    if post_type:query=query.where(CommunityPost.post_type==post_type)
    if location:query=query.where(CommunityPost.location_name.ilike(f"%{location}%"))
    if device:query=query.where(CommunityPost.device_name.ilike(f"%{device}%"))
    rows=db.execute(query.order_by(desc("score"),CommunityPost.published_at.desc()).limit(limit*2)).unique().all();result=[];authors={}
    for post,s in rows:
        if visible(post,user,db) and authors.get(post.author_id,0)<3:result.append({**post_dict(post,user,db),"search_score":round(float(s or 0),3)});authors[post.author_id]=authors.get(post.author_id,0)+1
        if len(result)>=limit:break
    return result

@router.get("")
def all_search(q:str=Query(min_length=1,max_length=120),viewer:User|None=Depends(get_optional_user),db:Session=Depends(get_db)):
    users=user_results(q,viewer,db,5);posts=post_results(q,viewer,db,12);tags=db.scalars(select(Tag).where(Tag.is_active.is_(True),Tag.name.ilike(f"%{q}%")).order_by(Tag.usage_count.desc()).limit(10)).all();save_history(db,viewer,q,"all");return {"query":q,"mode":"hybrid_lexical","semantic_available":False,"users":users,"posts":posts,"images":[p for p in posts if p["images"]],"tags":[{"id":t.id,"name":t.name,"slug":t.slug,"usage_count":t.usage_count} for t in tags]}

@router.get("/users")
def users(q:str=Query(min_length=1,max_length=120),limit:int=Query(20,le=50),viewer:User|None=Depends(get_optional_user),db:Session=Depends(get_db)):save_history(db,viewer,q,"users");return {"items":user_results(q,viewer,db,limit)}

@router.get("/posts")
def posts(q:str=Query(min_length=1,max_length=120),limit:int=Query(24,le=50),post_type:str|None=None,location:str|None=None,device:str|None=None,viewer:User|None=Depends(get_optional_user),db:Session=Depends(get_db)):save_history(db,viewer,q,"posts");return {"items":post_results(q,viewer,db,limit,post_type,location,device),"semantic_available":False}

@router.get("/images")
def images(q:str=Query(min_length=1,max_length=120),limit:int=Query(24,le=50),viewer:User|None=Depends(get_optional_user),db:Session=Depends(get_db)):return {"items":[p for p in post_results(q,viewer,db,limit) if p["images"]],"semantic_available":False}

@router.get("/tags")
def tags(q:str=Query(min_length=1,max_length=120),db:Session=Depends(get_db)):return {"items":[{"id":t.id,"name":t.name,"slug":t.slug,"usage_count":t.usage_count} for t in db.scalars(select(Tag).where(Tag.is_active.is_(True),or_(Tag.name.ilike(f"%{q}%"),func.similarity(Tag.name,q)>0.15)).order_by(Tag.usage_count.desc()).limit(30)).all()]}

@router.get("/suggestions")
def suggestions(q:str=Query("",max_length=80),viewer:User|None=Depends(get_optional_user),db:Session=Depends(get_db)):
    user_names=db.scalars(select(User.username).where(User.is_deleted.is_(False),User.username.ilike(f"%{q}%")).limit(5)).all() if q else [];tag_names=db.scalars(select(Tag.name).where(Tag.is_active.is_(True),Tag.name.ilike(f"%{q}%")).order_by(Tag.usage_count.desc()).limit(8)).all();history=db.scalars(select(SearchHistory.query).where(SearchHistory.user_id==viewer.id).order_by(SearchHistory.created_at.desc()).limit(6)).all() if viewer else [];return {"users":user_names,"tags":tag_names,"history":list(dict.fromkeys(history)),"related":query_terms(q)[1:6]}

@router.get("/history")
def history(viewer:User|None=Depends(get_optional_user),db:Session=Depends(get_db)):return {"items":db.scalars(select(SearchHistory).where(SearchHistory.user_id==viewer.id).order_by(SearchHistory.created_at.desc()).limit(30)).all() if viewer else []}

@router.delete("/history",status_code=204)
def clear_history(viewer:User|None=Depends(get_optional_user),db:Session=Depends(get_db)):
    if viewer:
        for row in db.scalars(select(SearchHistory).where(SearchHistory.user_id==viewer.id)):db.delete(row)
        db.commit()
