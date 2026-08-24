import { apiRequest } from "./client";
import type { PortfolioCollection, PortfolioCollectionDetail, PortfolioPhoto, PrivacySettings, Profile } from "../types";

export const getMyProfile = () => apiRequest<Profile>("/me/profile");
export const getPublicProfile = (id: string | number) => apiRequest<Profile>(`/users/${id}/profile`);
export const updateProfile = (payload: Partial<Profile>) => apiRequest<Profile>("/me/profile", { method: "PATCH", body: JSON.stringify(payload) });
export const getWorks = (id: string | number) => apiRequest<PortfolioPhoto[]>(`/users/${id}/works`);
export const getUserCollections = (id: string | number) => apiRequest<PortfolioCollection[]>(`/users/${id}/collections`);
export const getUserCollection = (userId: string | number, collectionId: string | number) =>
  apiRequest<PortfolioCollectionDetail>(`/users/${userId}/collections/${collectionId}`);
export const updateWork = (id: number, payload: Partial<PortfolioPhoto>) => apiRequest<PortfolioPhoto>(`/works/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
export const getFavorites = () => apiRequest<PortfolioPhoto[]>("/me/favorites");
export const favoriteWork = (id: number) => apiRequest<{ favorited: boolean }>(`/works/${id}/favorite`, { method: "POST" });
export const unfavoriteWork = (id: number) => apiRequest<void>(`/works/${id}/favorite`, { method: "DELETE" });
export const followUser = (id: number) => apiRequest<{ following: boolean }>(`/users/${id}/follow`, { method: "POST" });
export const unfollowUser = (id: number) => apiRequest<void>(`/users/${id}/follow`, { method: "DELETE" });
export const getFollowers = (id: number) => apiRequest<Profile[]>(`/users/${id}/followers`);
export const getFollowing = (id: number) => apiRequest<Profile[]>(`/users/${id}/following`);
export const getPrivacy = () => apiRequest<PrivacySettings>("/me/privacy");
export const updatePrivacy = (payload: PrivacySettings) => apiRequest<PrivacySettings>("/me/privacy", { method: "PUT", body: JSON.stringify(payload) });
export function uploadAvatar(file: Blob) { const body = new FormData(); body.append("file", file, "avatar.jpg"); return apiRequest<Profile>("/me/avatar", { method: "POST", body }); }
export const resetAvatar = () => apiRequest<Profile>("/me/avatar", { method: "DELETE" });
