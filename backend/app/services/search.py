import re
import unicodedata
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.community import CommunityPost
from app.models.search import PostSearchDocument

SEMANTIC_EXPANSIONS = {
    "雨夜": ["雨天", "夜景", "街拍", "蓝调"], "雨天": ["雨夜", "倒影", "街拍"],
    "电影感": ["胶片", "氛围", "城市", "复古"], "胶片感": ["胶片", "复古", "颗粒", "校园"],
    "温柔": ["柔光", "人像", "暖色"], "清新": ["春天", "绿色", "明亮"],
    "建筑": ["城市", "几何", "线条"], "咖啡馆": ["咖啡", "室内", "暖色"],
    "逆光": ["轮廓光", "人像", "夕阳"], "街拍": ["城市", "纪实", "人文"],
}

def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).lower().strip()
    value = re.sub(r"[_\-/|,，;；]+", " ", value)
    return re.sub(r"\s+", " ", value)

def query_terms(query: str) -> list[str]:
    normalized = normalize_text(query); terms = [normalized]
    for key, values in SEMANTIC_EXPANSIONS.items():
        if key in normalized: terms.extend(values)
    return list(dict.fromkeys(t for t in terms if t))[:12]

def build_post_document(db: Session, post_id: int) -> PostSearchDocument | None:
    post = db.get(CommunityPost, post_id)
    if not post: return None
    document = db.scalar(select(PostSearchDocument).where(PostSearchDocument.post_id == post_id)) or PostSearchDocument(post_id=post_id)
    if post.status != "published" or post.visibility == "private" or post.deleted_at:
        document.index_status = "hidden"; document.search_text = ""; document.normalized_text = ""; document.semantic_terms = []
    else:
        tag_names = [tag.name for tag in post.tags]
        image_alt = [image.alt_text or "" for image in post.images]
        fields = [post.title, post.content, *tag_names, post.post_type, post.location_name, post.device_name, post.lens_name, post.aperture, post.shutter_speed, str(post.iso or ""), post.focal_length, post.editing_software, post.editing_notes, *image_alt]
        document.search_text = " ".join(str(v) for v in fields if v)
        document.normalized_text = normalize_text(document.search_text)
        document.semantic_terms = list(dict.fromkeys(tag_names + [x for term in query_terms(document.normalized_text) for x in SEMANTIC_EXPANSIONS.get(term, [])]))[:30]
        document.index_status = "ready"; document.indexed_at = datetime.now(timezone.utc); document.index_error = None
    db.add(document); return document

class TextEmbeddingProvider:
    """Optional provider boundary. No vectors are fabricated when unconfigured."""
    def available(self) -> bool: return False
    async def embed(self, texts: list[str]) -> list[list[float]]: raise RuntimeError("embedding provider not configured")

class ImageEmbeddingProvider(TextEmbeddingProvider): pass
class ImageCaptionProvider(TextEmbeddingProvider): pass
