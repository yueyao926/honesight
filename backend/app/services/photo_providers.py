import asyncio
import math
from abc import ABC, abstractmethod
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from app.core.config import get_settings


@dataclass
class ProviderPhoto:
    source_type: str; external_id: str; title: str; description: str | None; image_url: str; thumbnail_url: str
    width: int | None; height: int | None; photographer_name: str; photographer_url: str; source_name: str
    source_page_url: str; attribution_text: str; license_code: str | None = None; license_name: str | None = None
    license_url: str | None = None; tags: str = ""; license_verified: bool = False; moderation_status: str = "pending"


def safe_public_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.hostname) and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}


class PhotoProvider(ABC):
    @abstractmethod
    async def search(self, query: str, count: int) -> list[ProviderPhoto]: ...

    async def _get(self, url: str, **kwargs) -> dict:
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=8) as client:
                    response = await client.get(url, **kwargs)
                    response.raise_for_status()
                    return response.json()
            except (httpx.TimeoutException, httpx.HTTPStatusError):
                if attempt: raise
                await asyncio.sleep(.25)
        return {}


class UnsplashProvider(PhotoProvider):
    async def search(self, query: str, count: int) -> list[ProviderPhoto]:
        key = get_settings().unsplash_access_key
        if not key: return []
        requested = min(max(count, 1), 200)
        per_page = min(requested, 30)
        pages = math.ceil(requested / per_page)
        photos = []
        seen: set[str] = set()
        for page in range(1, pages + 1):
            page_size = min(per_page, requested - len(photos))
            data = await self._get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "page": page, "per_page": page_size, "order_by": "latest", "content_filter": "high"},
                headers={"Authorization": f"Client-ID {key}"},
            )
            results = data.get("results", [])
            if not results: break
            for item in results:
                external_id = str(item.get("id") or "")
                if not external_id or external_id in seen: continue
                seen.add(external_id)
                user = item.get("user") or {}; urls = item.get("urls") or {}; links = item.get("links") or {}
                api_tags = [tag.get("title", "") for tag in item.get("tags", []) if isinstance(tag, dict)]
                tags = ",".join(dict.fromkeys([query, *api_tags]))
                raw = ProviderPhoto("unsplash", external_id, item.get("description") or item.get("alt_description") or "摄影作品", item.get("alt_description"), urls.get("regular", ""), urls.get("small", ""), item.get("width"), item.get("height"), user.get("name") or "Unknown", (user.get("links") or {}).get("html", ""), "Unsplash", links.get("html", ""), f"摄影：{user.get('name') or 'Unknown'} · Unsplash", license_code="Unsplash License", license_name="Unsplash License", license_url="https://unsplash.com/license", tags=tags, license_verified=True, moderation_status="approved")
                if all(safe_public_url(v) for v in (raw.image_url, raw.thumbnail_url, raw.photographer_url, raw.source_page_url)): photos.append(raw)
                if len(photos) >= requested: break
            if len(photos) >= requested: break
        return photos[:requested]


class OpenverseProvider(PhotoProvider):
    ALLOWED = {"cc0", "pdm", "by", "by-sa"}
    async def search(self, query: str, count: int) -> list[ProviderPhoto]:
        settings = get_settings(); headers = {}
        if settings.openverse_client_id: headers["Authorization"] = f"Bearer {settings.openverse_client_id}"
        data = await self._get("https://api.openverse.org/v1/images/", params={"q": query, "page_size": min(count, 20), "license": ",".join(self.ALLOWED)}, headers=headers)
        result = []
        for item in data.get("results", []):
            code = (item.get("license") or "").lower(); creator = item.get("creator"); source_page = item.get("foreign_landing_url")
            if code not in self.ALLOWED or not creator or not source_page or not item.get("license_url"): continue
            photo = ProviderPhoto("openverse", str(item.get("id")), item.get("title") or "摄影作品", None, item.get("url") or "", item.get("thumbnail") or item.get("url") or "", item.get("width"), item.get("height"), creator, item.get("creator_url") or source_page, item.get("source") or "Openverse", source_page, item.get("attribution") or f"{item.get('title')} by {creator}", code.upper(), code.upper(), item.get("license_url"), ",".join(t.get("name", "") for t in item.get("tags", []) if isinstance(t, dict)))
            if all(safe_public_url(v) for v in (photo.image_url, photo.thumbnail_url, photo.photographer_url, photo.source_page_url, photo.license_url or "")): result.append(photo)
        return result


class CommunityProvider(PhotoProvider):
    async def search(self, query: str, count: int) -> list[ProviderPhoto]:
        return []
