import { apiRequest } from "./client";
import {
  optimizeImageForUpload,
  type ImageUploadPurpose,
  type ImageUploadStage,
} from "../utils/imageUpload";

export type UploadedImage = {
  image_url: string;
  thumbnail_url: string;
  width: number;
  height: number;
};

export async function uploadImage(
  file: File,
  purpose: ImageUploadPurpose = "standard",
  onStage?: (stage: ImageUploadStage) => void,
) {
  onStage?.("optimizing");
  const optimized = await optimizeImageForUpload(file, purpose);
  onStage?.("uploading");

  const formData = new FormData();
  formData.append("file", optimized);
  formData.append("purpose", purpose);
  return apiRequest<UploadedImage>("/upload/image", {
    method: "POST",
    body: formData,
  });
}
