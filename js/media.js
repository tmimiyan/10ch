// Firebase Storage helpers for safely uploading up to three images per post.
import { deleteObject, getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";
import { storage } from "./firebase.js";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function validateImage(file) {
  if (!file) return "";
  if (!ALLOWED_TYPES.has(file.type)) return "JPEG、PNG、GIF、WebP の画像を選択してください。";
  if (file.size > MAX_IMAGE_SIZE) return "画像は 5MB 以下にしてください。";
  return "";
}

export function validateImages(files) {
  if (files.length > 3) return "画像は1回の投稿につき3枚までです。";
  for (const file of files) {
    const error = validateImage(file);
    if (error) return error;
  }
  return "";
}

export async function uploadPostImage(file, uid) {
  if (!file) return null;
  const error = validateImage(file);
  if (error) throw new Error(error);
  const extension = file.type.split("/")[1].replace("jpeg", "jpg");
  const imageRef = ref(storage, `post-images/${uid}/${crypto.randomUUID()}.${extension}`);
  await uploadBytes(imageRef, file, { contentType: file.type });
  return { path: imageRef.fullPath, url: await getDownloadURL(imageRef) };
}

export async function uploadPostImages(files, uid) {
  const images = [];
  try {
    for (const file of files) images.push(await uploadPostImage(file, uid));
    return images;
  } catch (error) {
    await removePostImages(images).catch(console.warn);
    throw error;
  }
}

export async function removePostImage(image) {
  if (image?.path) await deleteObject(ref(storage, image.path));
}

export async function removePostImages(images) {
  await Promise.all(images.map((image) => removePostImage(image)));
}
