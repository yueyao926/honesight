from sqlalchemy import select
from app.database import SessionLocal
from app.models.community import CommunityPost
from app.services.search import build_post_document

def main() -> None:
    with SessionLocal() as db:
        ids=db.scalars(select(CommunityPost.id)).all()
        for number,post_id in enumerate(ids,1):
            build_post_document(db,post_id)
            if number%100==0:db.commit()
        db.commit();print(f"Indexed {len(ids)} community posts")

if __name__=="__main__":main()
