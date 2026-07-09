import { apiRequest } from "./client";

export function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<{ image_url: string }>("/upload/image", {
    method: "POST",
    body: formData,
  });
}
