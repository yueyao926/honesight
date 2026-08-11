import { apiRequest } from "./client";
import type { Preference } from "../types";

export type PreferencePayload = {
  skill_level?: string;
  target_platform?: string;
  preferred_styles?: string;
  common_subjects?: string;
  improvement_goals?: string;
  editing_tools?: string;
  photography_categories?: string[];
  shooting_devices?: string[];
  weekly_practice_minutes?: number;
  weekly_practice_day?: number;
  weekly_reminder_enabled?: boolean;
};

export function getMyPreferences() {
  return apiRequest<Preference>("/preferences/me");
}

export function createMyPreferences(payload: PreferencePayload) {
  return apiRequest<Preference>("/preferences/me", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMyPreferences(payload: PreferencePayload) {
  return apiRequest<Preference>("/preferences/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
