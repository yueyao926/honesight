import { apiRequest } from "./client";
import { uploadImage } from "./upload";

export type CommunityImage={id?:number;image_url:string;thumbnail_url?:string|null;sort_order:number;width?:number|null;height?:number|null;image_role:string;alt_text?:string|null};
export type CommunityPost={id:number;author:{id:number;username:string;avatar_url?:string|null;signature?:string|null};title:string;content:string;post_type:string;visibility:string;status:string;allow_comments:boolean;allow_ai_review:boolean;allow_original_download:boolean;location_name?:string|null;device_name?:string|null;lens_name?:string|null;aperture?:string|null;shutter_speed?:string|null;iso?:number|null;focal_length?:string|null;editing_software?:string|null;editing_notes?:string|null;cover_image_url?:string|null;images:CommunityImage[];tags:{name:string;slug:string;category:string}[];view_count:number;like_count:number;favorite_count:number;comment_count:number;share_count:number;published_at?:string|null;created_at:string;updated_at:string;is_liked:boolean;is_favorited:boolean;is_following_author:boolean;is_owner:boolean};
export type PostInput=Omit<Partial<CommunityPost>,"id"|"author"|"tags"|"images">&{title:string;content:string;post_type:string;visibility:string;status:string;images:Omit<CommunityImage,"id">[];tags:string[];copyright_confirmed:boolean};
export type CommunityComment={id:number;content:string;parent_id?:number|null;reply_to_user_id?:number|null;like_count:number;reply_count:number;created_at:string;is_liked:boolean;is_owner:boolean;author:{id:number;username:string;avatar_url?:string|null}};

export const getFeed=(kind="recommended",cursor?:number)=>apiRequest<{items:CommunityPost[];next_cursor?:number|null}>(`/community/feed/${kind}${cursor?`?cursor=${cursor}`:""}`);
export const getPost=(id:number)=>apiRequest<CommunityPost>(`/community/posts/${id}`);
export const createPost=(data:PostInput)=>apiRequest<CommunityPost>("/community/posts",{method:"POST",body:JSON.stringify(data)});
export const updatePost=(id:number,data:PostInput)=>apiRequest<CommunityPost>(`/community/posts/${id}`,{method:"PATCH",body:JSON.stringify(data)});
export const deletePost=(id:number)=>apiRequest<void>(`/community/posts/${id}`,{method:"DELETE"});
export const likePost=(id:number)=>apiRequest<{liked:boolean;like_count:number}>(`/community/posts/${id}/like`,{method:"POST"});
export const unlikePost=(id:number)=>apiRequest<{liked:boolean;like_count:number}>(`/community/posts/${id}/like`,{method:"DELETE"});
export const favoritePost=(id:number)=>apiRequest<{favorited:boolean;favorite_count:number}>(`/community/posts/${id}/favorite`,{method:"POST",body:"{}"});
export const unfavoritePost=(id:number)=>apiRequest<{favorited:boolean;favorite_count:number}>(`/community/posts/${id}/favorite`,{method:"DELETE"});
export const getComments=(id:number)=>apiRequest<CommunityComment[]>(`/community/posts/${id}/comments`);
export const addComment=(id:number,content:string,parent_id?:number)=>apiRequest<{id:number}>(`/community/posts/${id}/comments`,{method:"POST",body:JSON.stringify({content,parent_id})});
export const likeComment=(id:number)=>apiRequest<{liked:boolean;like_count:number}>(`/community/comments/${id}/like`,{method:"POST"});
export const unlikeComment=(id:number)=>apiRequest<{liked:boolean;like_count:number}>(`/community/comments/${id}/like`,{method:"DELETE"});
export const deleteComment=(id:number)=>apiRequest<void>(`/community/comments/${id}`,{method:"DELETE"});
export const uploadCommunityImage=(file:File)=>uploadImage(file,"community");
export const getNotifications=()=>apiRequest<any[]>("/community/notifications");
export const markNotificationsRead=()=>apiRequest("/community/notifications/read-all",{method:"POST"});
