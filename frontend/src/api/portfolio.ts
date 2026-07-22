import { apiRequest } from "./client";
import type { PhotoTag, PortfolioCollection, PortfolioCollectionDetail, PortfolioPhoto } from "../types";

export function listPortfolio() {
  return apiRequest<PortfolioCollection[]>("/portfolio");
}

export function createPortfolio(name: string) {
  return apiRequest<PortfolioCollection>("/portfolio", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function getPortfolio(id: string | number) {
  return apiRequest<PortfolioCollectionDetail>(`/portfolio/${id}`);
}

export function renamePortfolio(id: string | number, name: string) {
  return apiRequest<PortfolioCollection>(`/portfolio/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deletePortfolio(id: string | number) {
  return apiRequest<void>(`/portfolio/${id}`, { method: "DELETE" });
}

export function addPortfolioPhoto(id: string | number, payload: { image_url: string; title?: string; tags?: PhotoTag[] }) {
  return apiRequest<PortfolioPhoto>(`/portfolio/${id}/photos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deletePortfolioPhoto(collectionId: string | number, photoId: string | number) {
  return apiRequest<void>(`/portfolio/${collectionId}/photos/${photoId}`, { method: "DELETE" });
}

export function saveOriginalToPortfolio(payload: {
  image_url: string;
  title?: string;
  collection_id?: number;
  collection_name?: string;
  tags?: PhotoTag[];
}) {
  return apiRequest<{ collection: PortfolioCollection; photo: PortfolioPhoto }>("/portfolio/save-original", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type PortfolioPhotoSource = "ai_original" | "quick_preview" | "ai_refined" | "user_improved";

export function savePhotoToPortfolio(payload: {
  image_url: string;
  source: PortfolioPhotoSource;
  title?: string;
  collection_id?: number;
  collection_name?: string;
  tags?: PhotoTag[];
}) {
  return apiRequest<{ collection: PortfolioCollection; photo: PortfolioPhoto }>("/portfolio/save-photo", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
