import { apiRequest } from "./client";

export type UploadedImage = {
  image_url: string;
  thumbnail_url: string;
  width: number;
  height: number;
};

export function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<UploadedImage>("/upload/image", {
    method: "POST",
    body: formData,
  });
}
