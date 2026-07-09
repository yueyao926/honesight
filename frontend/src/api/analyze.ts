import { apiRequest } from "./client";
import type { PhotoAnalysis } from "../types";

export type AnalyzePayload = {
  portfolio_item_id: number;
  target_style?: string;
  target_platform?: string;
};

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
