import { apiRequest } from "./client";
import type { PortfolioItem } from "../types";

export type PortfolioPayload = {
  title: string;
  description?: string;
  image_url: string;
  category?: string;
  target_style?: string;
  target_platform?: string;
};

export function listPortfolio() {
  return apiRequest<PortfolioItem[]>("/portfolio");
}

export function createPortfolioItem(payload: PortfolioPayload) {
  return apiRequest<PortfolioItem>("/portfolio", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPortfolioItem(id: string | number) {
  return apiRequest<PortfolioItem>(`/portfolio/${id}`);
}

export function updatePortfolioItem(id: string | number, payload: Partial<PortfolioPayload>) {
  return apiRequest<PortfolioItem>(`/portfolio/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deletePortfolioItem(id: string | number) {
  return apiRequest<void>(`/portfolio/${id}`, { method: "DELETE" });
}

export function savePortfolioWithAnalysis(payload: {
  image_url: string;
  title: string;
  description?: string;
  category?: string;
  target_style?: string;
  target_platform?: string;
  analysis_report: Record<string, unknown>;
}) {
  return apiRequest<{ item: PortfolioItem; analysis_id: number }>("/portfolio/save-with-analysis", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
