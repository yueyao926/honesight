export type User = {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: number; username: string; avatar_url?: string | null; signature?: string | null;
  bio?: string | null; location?: string | null; photography_level?: string | null;
  equipment?: string | null; created_at: string; work_count: number; following_count: number;
  follower_count: number; is_following: boolean; is_self: boolean; email?: string | null;
  email_verified?: boolean | null; favorite_count?: number | null;
};

export type PrivacySettings = {
  show_following: boolean; show_followers: boolean; allow_work_favorites: boolean;
  discoverable_by_username: boolean; allow_follow_notifications: boolean;
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
  photography_categories: string[];
  aesthetic_styles: string[];
  editing_software: string[];
  shooting_devices: string[];
  weekly_practice_minutes: number;
  weekly_practice_day: number;
  weekly_reminder_enabled: boolean;
  daily_recommendation_enabled: boolean;
  daily_recommendation_count: number;
  use_favorite_behavior: boolean;
  use_browsing_behavior: boolean;
  prioritize_following: boolean;
  show_tutorial_content: boolean;
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
  thumbnail_url?: string | null;
  source: "direct_upload" | "ai_original" | "legacy" | string;
  description?: string | null;
  visibility: "public" | "private";
  allow_favorite: boolean;
  favorite_count: number;
  view_count: number;
  is_favorited: boolean;
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

export type CompletionCriterion = {
  text: string;
  passed: boolean;
};

export type PracticeAttempt = {
  id: number;
  stage: string;
  image_url: string;
  image_urls: string[];
  self_reflection: string;
  skill_score: number;
  score_change: number | null;
  achieved_count: number;
  criteria_total: number;
  criterion_results: Array<{ criterion: string; achieved: boolean }>;
  difficulty_feedback?: "too_easy" | "just_right" | "too_hard" | null;
  strength: string;
  key_issue: string;
  action_step: string;
  reshoot_task: string;
  comparison_summary: string;
  created_at: string;
};

export type PracticeSession = {
  id: number;
  week_key: string;
  entry_mode: "improve" | "category";
  plan_role: "primary" | "optional";
  position: number;
  category: "人像" | "风景" | "拍物";
  skill_focus: string;
  level: number;
  cycle_week: number;
  cycle_label: string;
  time_minutes: number;
  source_image_url?: string | null;
  target_goal: string;
  photo_analysis?: {
    photo_type: string;
    intent: string;
    priority_issue: string;
    ability: string;
    recommended_level: number;
    confidence: number;
  } | null;
  title: string;
  brief: string;
  recommendation_basis: string;
  steps: string[];
  constraints: string[];
  success_criteria: string[];
  optional_challenge: string;
  simplified_task: { title?: string; time_minutes?: number; steps?: string[] };
  coach_note: string;
  status: "active" | "completed";
  progress: number;
  progress_stage: "not_started" | "started" | "submitted" | "completed";
  completion_percent: number;
  is_carryover: boolean;
  attempts: PracticeAttempt[];
  started_at?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};

export type PracticeProgress = {
  category: "人像" | "风景" | "拍物";
  ability: string;
  level: number;
  cycle_week: number;
  completed_count: number;
  remaining_for_level: number;
};

export type PracticeOverview = {
  current: PracticeSession | null;
  current_sessions: PracticeSession[];
  week_key: string;
  weekly_budget_minutes: number;
  scheduled_minutes: number;
  completed_minutes: number;
  can_add: boolean;
  history: PracticeSession[];
  progress: PracticeProgress[];
};

export type ChatMessage = {
  id: number;
  portfolio_item_id: number;
  user_id: number;
  role: "user" | "assistant" | string;
  content: string;
  created_at: string;
};

export type Inspiration = {
  id: number; source_type: string; title: string; description?: string | null;
  poetic_caption: string; appreciation_summary: string; composition_analysis: string;
  light_analysis: string; color_analysis: string; emotion_analysis: string; learning_tip: string;
  image_url: string; thumbnail_url: string; width?: number | null; height?: number | null;
  orientation?: string | null; photographer_name: string; photographer_url: string;
  source_name: string; source_page_url: string; license_code?: string | null;
  license_name?: string | null; license_url?: string | null; attribution_text: string;
  tags: string[]; is_favorite: boolean; recommendation_reason?: string | null;
};
