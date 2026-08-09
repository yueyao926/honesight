import { apiRequest } from "./client";
import type { Inspiration } from "../types";

export const getDailyInspirations = () => apiRequest<Inspiration[]>("/inspirations/today");
export const getFavoriteInspirations = () => apiRequest<Inspiration[]>("/inspirations/favorites");
export const favoriteInspiration = (id: number) => apiRequest<Inspiration>(`/inspirations/${id}/favorite`, { method: "PUT" });
export const unfavoriteInspiration = (id: number) => apiRequest<void>(`/inspirations/${id}/favorite`, { method: "DELETE" });
