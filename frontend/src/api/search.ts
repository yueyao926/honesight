import {apiRequest} from "./client";import type {CommunityPost} from "./community";
export type UserSearchResult={id:number;username:string;avatar_url?:string|null;signature?:string|null;bio?:string|null;photography_level?:string|null;follower_count:number;work_count:number;is_following:boolean};
export type SearchResult={query:string;mode:string;semantic_available:boolean;users:UserSearchResult[];posts:CommunityPost[];images:CommunityPost[];tag_posts?:CommunityPost[];tags:{id:number;name:string;slug:string;usage_count:number}[]};
export const searchAll=(q:string)=>apiRequest<SearchResult>(`/search?q=${encodeURIComponent(q)}`);
export const searchUsers=(q:string)=>apiRequest<{items:UserSearchResult[]}>(`/search/users?q=${encodeURIComponent(q)}`);
export const suggestions=(q:string)=>apiRequest<{users:string[];tags:string[];history:string[];related:string[]}>(`/search/suggestions?q=${encodeURIComponent(q)}`);
export const clearSearchHistory=()=>apiRequest<void>("/search/history",{method:"DELETE"});
