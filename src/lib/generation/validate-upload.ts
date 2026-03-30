import { ALLOWED_IMAGE_MIME } from "@/lib/generation/constants";
import { getMaxUploadBytes } from "@/lib/env";

export function validateImageFile(file: File | null): { ok: true; file: File } | { ok: false; message: string } {
  if (!file || file.size === 0) {
    return { ok: false, message: "Fajl je obavezan." };
  }
  const max = getMaxUploadBytes();
  if (file.size > max) {
    return { ok: false, message: `Fajl je prevelik (max ${max} bajtova).` };
  }
  const type = file.type.toLowerCase();
  if (!ALLOWED_IMAGE_MIME.has(type)) {
    return { ok: false, message: "Dozvoljeni su samo PNG, JPEG ili WebP." };
  }
  return { ok: true, file };
}

export function extForMime(mime: string): "png" | "jpg" | "webp" {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}
