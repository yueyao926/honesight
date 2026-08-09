import { apiRequest } from "./client";

export type ImageProcessPayload = {
  image_url: string;
  target_style: string;
  target_platform: string;
  analysis_guidance?: string;
  edit_instruction?: string;
  reference_image_urls?: string[];
};

export type ImageProcessResult = {
  image_url: string;
  thumbnail_url?: string;
  model: string;
  prompt: string;
  editing_strategy?: string;
};

export function generateProcessedImage(payload: ImageProcessPayload) {
  return apiRequest<ImageProcessResult>("/image-process/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
