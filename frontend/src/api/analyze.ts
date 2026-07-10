import { apiRequest } from "./client";
import type { PhotoAnalysis } from "../types";

export type AnalyzePayload = {
  portfolio_item_id: number;
  target_style?: string;
  target_platform?: string;
  style_reference_image_urls?: string[];
};

export type PreviewAnalyzePayload = {
  image_url: string;
  style_reference_image_urls: string[];
  target_style?: string;
  target_platform?: string;
  title?: string;
  description?: string;
  category?: string;
};

export function previewAnalyze(payload: PreviewAnalyzePayload) {
  return apiRequest<PhotoAnalysis>("/analyze/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function analyzePhoto(payload: AnalyzePayload) {
  return apiRequest<PhotoAnalysis>("/analyze/photo", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPhotoAnalysis(portfolioItemId: string | number) {
  return apiRequest<PhotoAnalysis>(`/portfolio/${portfolioItemId}/analysis`);
}

export const getLatestAnalysis = getPhotoAnalysis;
