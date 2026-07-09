import { apiRequest } from "./client";
import type { ChatMessage } from "../types";

export function getPhotoChat(portfolioItemId: string | number) {
  return apiRequest<ChatMessage[]>(`/portfolio/${portfolioItemId}/chat`);
}

export function sendPhotoChatMessage(portfolioItemId: string | number, message: string) {
  return apiRequest<{ reply: string; created_at: string }>(`/portfolio/${portfolioItemId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
