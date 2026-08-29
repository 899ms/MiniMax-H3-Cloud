import { stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

const SUPPORTED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export async function resolveImageInput(value, { label = "首帧图片" } = {}) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label}路径不能为空`);
  }

  const imagePath = resolve(value);
  const fileInfo = await stat(imagePath).catch(() => null);
  if (!fileInfo?.isFile()) {
    throw new Error(`${label}不存在或不是普通文件：${imagePath}`);
  }

  const extension = extname(imagePath).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(`${label}格式只支持 PNG、JPG、JPEG 和 WebP`);
  }

  return imagePath;
}

export function resolveReferenceImageInput(value) {
  return resolveImageInput(value, { label: "参考图" });
}

export async function resolveReferenceImageInputs(values) {
  const inputs = values === undefined
    ? []
    : Array.isArray(values)
      ? values
      : [values];
  if (inputs.length > 9) {
    throw new Error("参考图最多支持 9 张");
  }
  return Promise.all(inputs.map((value) => resolveReferenceImageInput(value)));
}

export function resolveLastFrameImageInput(value) {
  return resolveImageInput(value, { label: "尾帧图片" });
}
