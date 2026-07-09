import { apiRequest } from "./client";
import type { Analysis } from "../types";

export function analyzePhoto(portfolioItemId: number) {
  return apiRequest<Analysis>("/analyze/photo", {
    method: "POST",
    body: JSON.stringify({ portfolio_item_id: portfolioItemId }),
  });
}

export function getLatestAnalysis(portfolioItemId: string | number) {
  return apiRequest<Analysis>(`/portfolio/${portfolioItemId}/analysis`);
}
