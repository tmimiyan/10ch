// Shared presentation helpers. User content is always inserted with textContent, never innerHTML.
export const $ = (selector, root = document) => root.querySelector(selector);
// This must match the administrator email checked by the Firebase security rules.
export const ADMIN_EMAIL = "tomohiro6231@gmail.com";
export const isAdmin = (user) => user?.email?.toLowerCase() === ADMIN_EMAIL;
export const ADMIN_AUTHOR_NAME = "管理者";
export const ADMIN_AUTHOR_COLOR = "#c026d3";

// Keep the administrator identity consistent in both the form UI and saved posts.
export function postAuthor(user, name, color) {
  if (isAdmin(user)) return { name: ADMIN_AUTHOR_NAME, color: ADMIN_AUTHOR_COLOR };
  return { name: name?.trim() || "名無しさん", color };
}

export function lockAuthorInputs(user, nameInput, colorInput) {
  const locked = isAdmin(user);
  nameInput.disabled = locked;
  colorInput.disabled = locked;
  if (locked) {
    nameInput.value = ADMIN_AUTHOR_NAME;
    colorInput.value = ADMIN_AUTHOR_COLOR;
    nameInput.title = "管理者アカウントでは投稿者名は固定です。";
    colorInput.title = "管理者アカウントでは投稿者名の色は固定です。";
  } else {
    nameInput.removeAttribute("title");
    colorInput.removeAttribute("title");
  }
}

export function formatDate(timestamp) {
  if (!timestamp?.toDate) return "投稿日時を取得中";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(timestamp.toDate());
}

export function displayName(user) {
  return user?.displayName?.trim() || "名無しさん";
}

export function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 3500);
}

export function firebaseMessage(error) {
  console.error(error);
  if (error?.code === "permission-denied") return "権限がありません。ログイン状態と Firestore ルールを確認してください。";
  if (error?.code === "storage/unauthorized") return "画像を保存する権限がありません。Firebase Storage のルールを確認してください。";
  if (error?.code === "storage/quota-exceeded") return "画像保存容量の上限に達しています。Firebase Storage の容量を確認してください。";
  if (error?.code === "unavailable") return "ネットワークに接続できません。接続を確認して再試行してください。";
  return "処理に失敗しました。もう一度お試しください。";
}
