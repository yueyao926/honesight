import { getApiBaseUrl } from "./client";
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
  return uploadRequest(formData, onStage);
}


function uploadRequest(
  formData: FormData,
  onStage?: (stage: ImageUploadStage) => void,
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${getApiBaseUrl()}/upload/image`);
    const token = localStorage.getItem("lenscoach_token");
    if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.upload.onload = () => onStage?.("processing");
    request.onerror = () => reject(new Error("图片上传失败，请检查网络后重试"));
    request.onload = () => {
      if (request.status === 401) {
        localStorage.removeItem("lenscoach_token");
        localStorage.removeItem("lenscoach_user");
        window.location.href = "/login";
        reject(new Error("登录已过期，请重新登录"));
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(new Error(`图片上传失败（HTTP ${request.status}）`));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        const detail = payload && typeof payload === "object" && "detail" in payload
          ? String((payload as { detail: unknown }).detail)
          : `图片上传失败（HTTP ${request.status}）`;
        reject(new Error(detail));
        return;
      }
      resolve(payload as UploadedImage);
    };
    request.send(formData);
  });
}
