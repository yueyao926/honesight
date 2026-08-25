import { getAccessToken, getApiBaseUrl, refreshAuthSession } from "./client";
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

const UPLOAD_TIMEOUT_MS = 120_000;

export async function uploadImage(
  file: File,
  purpose: ImageUploadPurpose = "standard",
  onStage?: (stage: ImageUploadStage) => void,
) {
  onStage?.("optimizing");
  const optimized = await optimizeImageForUpload(file, purpose);
  onStage?.("uploading");
  return sendUpload(optimized, purpose, onStage);
}

function sendUpload(
  file: File,
  purpose: ImageUploadPurpose,
  onStage?: (stage: ImageUploadStage) => void,
  allowRefresh = true,
): Promise<UploadedImage> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", purpose);

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${getApiBaseUrl()}/upload/image`);
    request.withCredentials = true;
    request.timeout = UPLOAD_TIMEOUT_MS;
    const token = getAccessToken();
    if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.upload.onload = () => onStage?.("processing");
    request.onerror = () => reject(new Error("图片上传失败，请检查网络后重试"));
    request.ontimeout = () => reject(new Error("图片上传超时，请检查网络后重试"));
    request.onload = async () => {
      if (request.status === 401) {
        if (token && allowRefresh) {
          try {
            await refreshAuthSession();
            resolve(sendUpload(file, purpose, onStage, false));
          } catch {
            reject(new Error("登录已过期，请重新登录"));
          }
        } else {
          reject(new Error("登录已过期，请重新登录"));
        }
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
