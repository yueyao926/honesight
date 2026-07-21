import { apiRequest } from "./client";

export type ImageProcessPayload = {
  image_url: string;
  target_style: string;
  edit_instruction?: string;
  reference_image_urls?: string[];
};

export type ImageProcessResult = {
  image_url: string;
  model: string;
  prompt: string;
};

export function generateProcessedImage(payload: ImageProcessPayload) {
  return apiRequest<ImageProcessResult>("/image-process/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
