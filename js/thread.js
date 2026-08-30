// Thread detail page: reads a thread and writes replies to a Firestore subcollection.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs, increment, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { auth, db, isFirebaseConfigured } from "./firebase.js";
import { removePostImages, uploadPostImages, validateImages } from "./media.js";
import { $, displayName, firebaseMessage, formatDate, isAdmin, showToast } from "./util.js";
import { initTheme } from "./theme.js";
import { getFirstLoginAt, syncPublicProfile } from "./user.js?v=20260830-1";
import { initAccountMenu } from "./profile-ui.js";

initTheme();
initAccountMenu();
const id = new URLSearchParams(location.search).get("id");
const detail = $("#thread-detail"), replyList = $("#reply-list"), replyForm = $("#reply-form"), replyButton = $("#reply-button");
const deleteThreadButton = $("#delete-thread-button");
const imageDialog = $("#image-dialog"), imageDialogImage = $("#image-dialog-image");
let currentUser = null;
let unsubscribeReplies = null;
let currentThread = null;
let latestReplies = null;
let threadDeleteTimer = null;
const ADMIN_EMAIL = "tomohiro6231@gmail.com";
const ADMIN_AUTHOR_NAME = "管理者";
const ADMIN_AUTHOR_COLOR = "#c026d3";
function isAdminUser(user) { return user?.email?.toLowerCase() === ADMIN_EMAIL; }
function isAdminPost(name, color) { return name === ADMIN_AUTHOR_NAME && color?.toLowerCase() === ADMIN_AUTHOR_COLOR; }
function hasProfileLink(name, visible) { return visible === true || (visible === undefined && name && name !== "名無しさん"); }
function canDeletePost(post) { return Boolean(currentUser && post && (isAdmin(currentUser) || (post.authorId === currentUser.uid && post.createdAt?.toMillis && Date.now() - post.createdAt.toMillis() < 5 * 60 * 1000))); }
function updateThreadDeleteButton() { clearTimeout(threadDeleteTimer); const administrator = isAdmin(currentUser); const ownEmptyThread = canDeletePost(currentThread) && currentThread?.replyCount === 0; deleteThreadButton.hidden = !(administrator || ownEmptyThread); deleteThreadButton.classList.toggle("user-delete-icon-button", !administrator && ownEmptyThread); if (!administrator && ownEmptyThread) { const remaining = currentThread.createdAt.toMillis() + 5 * 60 * 1000 - Date.now(); threadDeleteTimer = setTimeout(updateThreadDeleteButton, Math.max(0, remaining) + 50); } }
function postAuthor(user, name, color) {
  return isAdminUser(user)
    ? { name: ADMIN_AUTHOR_NAME, color: ADMIN_AUTHOR_COLOR }
    : { name: name?.trim() || "名無しさん", color };
}
function lockAuthorInputs(user) {
  const nameInput = $("#reply-author"), colorInput = $("#reply-author-color");
  const locked = isAdminUser(user);
  nameInput.disabled = locked; colorInput.disabled = locked;
  if (locked) { nameInput.value = ADMIN_AUTHOR_NAME; colorInput.value = ADMIN_AUTHOR_COLOR; }
}
// Notifications are optional. A missing notification file must never stop the board itself.
void import("./notifications-mobile.js?v=20260802-3")
  .then(({ initNotifications }) => initNotifications(() => currentUser))
  .catch((error) => console.warn("Notification UI is unavailable.", error));

function requestPostNotification(post) {
  void import("./notify-api-mobile.js?v=20260828-1")
    .then(({ requestPostNotification: send }) => send(currentUser, post))
    .catch((error) => console.warn("Notification delivery is unavailable.", error));
}

function syncAuth(user) { currentUser = user; if (!user) { location.replace("./login.html"); return; } lockAuthorInputs(user); getFirstLoginAt(user).catch(console.warn); syncPublicProfile(user).catch(console.warn); $(".login-link").hidden = Boolean(user); replyButton.disabled = !user; updateThreadDeleteButton(); $("#login-notice").textContent = `${displayName(user)} として投稿します。`; if (latestReplies) renderReplies(latestReplies); loadThread(); }
onAuthStateChanged(auth, syncAuth);
function empty(message) { detail.innerHTML = `<p class="empty-state">${message}</p>`; }
// The crown is generated only for the administrator's enforced name/color pair.
function authorNode(name, color, authorId, profileVisible) { const linked = hasProfileLink(name, profileVisible) && authorId; const author = document.createElement(linked ? "a" : "span"); author.textContent = name || "名無しさん"; if (linked) author.href = `./profile.html?uid=${encodeURIComponent(authorId)}`; if (/^#[0-9a-f]{6}$/i.test(color || "")) author.style.color = color; if (isAdminPost(name, color)) author.append(document.createTextNode(" 👑")); return author; }
function isFirstThreeDays(firstLoginAt) { return firstLoginAt?.toMillis && Date.now() - firstLoginAt.toMillis() < 3 * 24 * 60 * 60 * 1000; }
function appendLinkedText(element, text) { const urlPattern = /(https?:\/\/[^\s<>]+)/g; const trailingPunctuation = /[),.、。！？]+$/; String(text).split(urlPattern).forEach((part) => { if (!part) return; if (!/^https?:\/\//.test(part)) { element.append(document.createTextNode(part)); return; } const url = part.replace(trailingPunctuation, ""); element.append(document.createElement("a")); const link = element.lastElementChild; link.href = url; link.textContent = url; link.target = "_blank"; link.rel = "noopener noreferrer"; if (url !== part) element.append(document.createTextNode(part.slice(url.length))); }); }
function imageRecords(post) { const paths = Array.isArray(post.imagePaths) ? post.imagePaths : (post.imagePath ? [post.imagePath] : []); return paths.filter((path) => typeof path === "string").map((path) => ({ path })); }
function openImage(url, alt) { imageDialogImage.src = url; imageDialogImage.alt = alt; imageDialog.showModal(); }
function postImages(urls, legacyUrl) { const candidates = Array.isArray(urls) ? urls : (legacyUrl ? [legacyUrl] : []); const container = document.createElement("div"); container.className = "post-images"; candidates.slice(0, 3).forEach((url, index) => { if (typeof url !== "string") return; try { if (new URL(url).protocol !== "https:") return; } catch { return; } const image = document.createElement("img"); const alt = `投稿に添付された画像 ${index + 1}`; image.className = "post-image"; image.src = url; image.alt = alt; image.loading = "lazy"; image.tabIndex = 0; image.setAttribute("role", "button"); image.setAttribute("aria-label", `${alt}を拡大表示`); image.addEventListener("click", () => openImage(url, alt)); image.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openImage(url, alt); } }); container.append(image); }); return container.childElementCount ? container : null; }
async function deleteReply(replyId, reply) { if (!canDeletePost(reply) || !id || !confirm("このレスを削除しますか？")) return; try { const threadRef = doc(db, "threads", id); const batch = writeBatch(db); batch.delete(doc(threadRef, "replies", replyId)); batch.update(threadRef, { replyCount: increment(-1) }); await batch.commit(); await removePostImages(imageRecords(reply)); showToast("レスを削除しました。"); } catch (error) { showToast(firebaseMessage(error)); } }
function replyNode(reply, number, replyId) { const article = document.createElement("article"); article.className = "reply"; const meta = document.createElement("div"); meta.className = "reply-meta"; const author = authorNode(reply.authorName, reply.authorColor, reply.authorId, reply.authorProfileVisible); meta.append(`#${number}  `, author); if (isFirstThreeDays(reply.authorFirstLoginAt)) meta.append(" 🍀"); meta.append(`　${formatDate(reply.createdAt)}`); article.append(meta); if (reply.body) { const body = document.createElement("p"); body.className = "post-body"; appendLinkedText(body, reply.body); article.append(body); } const images = postImages(reply.imageUrls, reply.imageUrl); if (images) article.append(images); if (canDeletePost(reply)) { const administrator = isAdmin(currentUser); const button = document.createElement("button"); button.className = `button reply-delete delete-icon-button ${administrator ? "button-danger" : "user-delete-icon-button"}`; button.type = "button"; button.setAttribute("aria-label", "レスを削除"); button.title = "レスを削除"; const icon = document.createElement("i"); icon.className = "fas fa-trash"; icon.setAttribute("aria-hidden", "true"); button.append(icon); button.addEventListener("click", () => deleteReply(replyId, reply)); article.append(button); if (!administrator) { const remaining = reply.createdAt.toMillis() + 5 * 60 * 1000 - Date.now(); setTimeout(() => button.remove(), Math.max(0, remaining) + 50); } } return article; }
function renderReplies(snapshot) { latestReplies = snapshot; replyList.replaceChildren(); $("#reply-count").textContent = `${snapshot.size} 件`; if (!snapshot.size) { replyList.innerHTML = '<p class="empty-state">まだレスはありません。最初のレスを投稿しよう。</p>'; return; } let number = 1; snapshot.forEach((reply) => replyList.append(replyNode(reply.data(), number++, reply.id))); }
async function loadThread() {
  if (!id) { empty("スレッドが指定されていません。"); return; }
  if (!isFirebaseConfigured) { empty("Firebase の設定後にスレッドを表示します。"); return; }
  try {
    const threadRef = doc(db, "threads", id); const snapshot = await getDoc(threadRef);
    if (!snapshot.exists()) { empty("このスレッドは見つかりませんでした。"); return; }
    const thread = snapshot.data(); currentThread = thread; updateThreadDeleteButton(); document.title = `${thread.title} | 10ちゃんねる`;
    detail.replaceChildren(); const title = document.createElement("h1"); title.textContent = thread.title; const meta = document.createElement("div"); meta.className = "thread-meta"; meta.append(authorNode(thread.authorName, thread.authorColor, thread.authorId, thread.authorProfileVisible), `　${formatDate(thread.createdAt)}`); detail.append(title, meta); if (thread.firstPost) { const body = document.createElement("p"); body.className = "post-body"; appendLinkedText(body, thread.firstPost); detail.append(body); } const images = postImages(thread.imageUrls, thread.imageUrl); if (images) detail.append(images);
    // onSnapshot receives the current replies first, then pushes every later update from other accounts.
    const repliesQuery = query(collection(threadRef, "replies"), orderBy("createdAt", "asc"));
    unsubscribeReplies = onSnapshot(repliesQuery, renderReplies, (error) => showToast(firebaseMessage(error)));
  } catch (error) { empty(firebaseMessage(error)); }
}
async function deleteThread() { const administrator = isAdmin(currentUser); const ownEmptyThread = canDeletePost(currentThread) && currentThread?.replyCount === 0; if ((!administrator && !ownEmptyThread) || !id || !currentThread || !confirm(administrator ? "このスレッドと全レスを削除しますか？この操作は取り消せません。" : "このスレッドを削除しますか？")) return; deleteThreadButton.disabled = true; try { const threadRef = doc(db, "threads", id); if (administrator) { const replies = await getDocs(query(collection(threadRef, "replies"), orderBy("createdAt", "asc"))); const imageRecordsToRemove = [currentThread, ...replies.docs.map((reply) => reply.data())].flatMap(imageRecords); const refs = [...replies.docs.map((reply) => reply.ref), threadRef]; for (let start = 0; start < refs.length; start += 450) { const batch = writeBatch(db); refs.slice(start, start + 450).forEach((ref) => batch.delete(ref)); await batch.commit(); } await removePostImages(imageRecordsToRemove).catch(console.warn); } else { const batch = writeBatch(db); batch.delete(threadRef); await batch.commit(); await removePostImages(imageRecords(currentThread)).catch(console.warn); } unsubscribeReplies?.(); location.replace("./index.html"); } catch (error) { showToast(firebaseMessage(error)); deleteThreadButton.disabled = false; } }
replyForm.addEventListener("submit", async (event) => { event.preventDefault(); if (!currentUser) { showToast("投稿にはログインが必要です。"); location.href = "./login.html"; return; } const body = $("#reply-body").value.trim(); const inputAuthorName = $("#reply-author").value.trim(); if (!isAdminUser(currentUser) && inputAuthorName.includes("👑")) { showToast("王冠の絵文字は管理者専用です。"); return; } const author = postAuthor(currentUser, inputAuthorName, $("#reply-author-color").value); const authorProfileVisible = isAdminUser(currentUser) || Boolean(inputAuthorName && inputAuthorName !== "名無しさん"); const imageFiles = [...$("#reply-image").files]; if ((!body && !imageFiles.length) || !id) { showToast("本文または画像を入力してください。"); return; } const imageError = validateImages(imageFiles); if (imageError) { showToast(imageError); return; } replyButton.disabled = true; let images = []; try { const firstLoginAt = await getFirstLoginAt(currentUser); const threadRef = doc(db, "threads", id); images = await uploadPostImages(imageFiles, currentUser.uid); const replyRef = doc(collection(threadRef, "replies")); const batch = writeBatch(db); batch.set(replyRef, { body, authorId: currentUser.uid, authorName: author.name, authorColor: author.color, authorProfileVisible, authorFirstLoginAt: firstLoginAt, imageUrls: images.map((image) => image.url), imagePaths: images.map((image) => image.path), imageUrl: images[0]?.url || null, createdAt: serverTimestamp(), }); batch.update(threadRef, { replyCount: increment(1) }); await batch.commit(); requestPostNotification({ type: "reply", threadId: id, replyId: replyRef.id }); replyForm.reset(); lockAuthorInputs(currentUser); } catch (error) { await removePostImages(images).catch(console.warn); showToast(firebaseMessage(error)); } finally { replyButton.disabled = false; } });
deleteThreadButton.addEventListener("click", deleteThread);
window.addEventListener("pagehide", () => unsubscribeReplies?.());
$("#image-dialog-close").addEventListener("click", () => imageDialog.close());
imageDialog.addEventListener("click", (event) => { if (event.target === imageDialog) imageDialog.close(); });
