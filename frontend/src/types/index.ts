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

export type PortfolioItem = {
  id: number;
  user_id: number;
  title: string;
  description?: string | null;
  image_url: string;
  category?: string | null;
  target_style?: string | null;
  target_platform?: string | null;
  created_at: string;
  updated_at: string;
};

export type Analysis = {
  id: number;
  portfolio_item_id: number;
  user_id: number;
  summary: string;
  composition_advice: string;
  lighting_advice: string;
  color_advice: string;
  editing_params: string;
  model_used: string;
  created_at: string;
};
