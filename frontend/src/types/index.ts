export type User = {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type Preference = {
  id: number;
  user_id: number;
  skill_level?: string | null;
  target_platform?: string | null;
  preferred_styles?: string | null;
  common_subjects?: string | null;
  improvement_goals?: string | null;
  editing_tools?: string | null;
  created_at: string;
  updated_at: string;
};

export type PhotoTag = {
  id?: number;
  tag_type: string;
  name: string;
  confidence?: number | null;
  source?: string;
  model_version?: string | null;
  created_at?: string;
};

export type PortfolioPhoto = {
  id: number;
  user_id: number;
  collection_id: number;
  title: string;
  image_url: string;
  source: "direct_upload" | "ai_original" | "legacy" | string;
  tags: PhotoTag[];
  created_at: string;
  updated_at: string;
};

export type PortfolioCollection = {
  id: number;
  user_id: number;
  name: string;
  cover_image_url?: string | null;
  photo_count: number;
  created_at: string;
  updated_at: string;
};

export type PortfolioCollectionDetail = PortfolioCollection & {
  photos: PortfolioPhoto[];
};

/** @deprecated Use PortfolioPhoto. Kept for older analysis API typings. */
export type PortfolioItem = PortfolioPhoto;

export type BenchmarkDimension = {
  score: number;
  reason: string;
  problems: string[];
  suggestions: string[];
};

export type PhotoAnalysis = {
  id: number;
  portfolio_item_id: number;
  user_id: number;
  photo_type: string;
  detected_style: string;
  style_confidence: number;
  style_reasoning: string;
  exposure_score: number;
  focus_score: number;
  composition_score: number;
  color_score: number;
  exposure_weight: number;
  focus_weight: number;
  composition_weight: number;
  color_weight: number;
  overall_score: number;
  target_style_match_score: number;
  benchmark_detail: Record<string, BenchmarkDimension | string>;
  summary: string;
  composition_advice: string;
  lighting_advice: string;
  color_advice: string;
  editing_params: {
    lightroom?: Record<string, string>;
    mobile_apps?: Record<string, string>;
    [key: string]: unknown;
  };
  platform_suggestions: Record<string, Record<string, string>>;
  shooting_tips: string;
  next_step: string;
  analysis_mode: string;
  model_used: string;
  style_reference_image_urls?: string[];
  expected_effect_description?: string;
  analysis_report?: Record<string, unknown>;
  created_at: string;
};

export type Analysis = PhotoAnalysis;

export type ChatMessage = {
  id: number;
  portfolio_item_id: number;
  user_id: number;
  role: "user" | "assistant" | string;
  content: string;
  created_at: string;
};
