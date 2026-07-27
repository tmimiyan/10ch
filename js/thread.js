// Thread detail page: reads a thread and writes replies to a Firestore subcollection.
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { collection, doc, getDoc, increment, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { auth, db, isFirebaseConfigured } from "./firebase.js";
import { removePostImages, uploadPostImages, validateImages } from "./media.js";
import { $, displayName, firebaseMessage, formatDate, showToast } from "./util.js";
import { initTheme } from "./theme.js";

initTheme();
const id = new URLSearchParams(location.search).get("id");
const detail = $("#thread-detail"), replyList = $("#reply-list"), replyForm = $("#reply-form"), replyButton = $("#reply-button");
const imageDialog = $("#image-dialog"), imageDialogImage = $("#image-dialog-image");
let currentUser = null;
let unsubscribeReplies = null;

function syncAuth(user) { currentUser = user; $(".login-link").hidden = Boolean(user); $(".logout-button").hidden = !user; replyButton.disabled = !user; $("#login-notice").textContent = user ? `${displayName(user)} として投稿します。` : "投稿にはログインが必要です。"; }
onAuthStateChanged(auth, syncAuth); $(".logout-button").addEventListener("click", () => signOut(auth));
function empty(message) { detail.innerHTML = `<p class="empty-state">${message}</p>`; }
function authorNode(name, color) { const author = document.createElement("span"); author.textContent = name || "名無しさん"; if (/^#[0-9a-f]{6}$/i.test(color || "")) author.style.color = color; return author; }
function openImage(url, alt) { imageDialogImage.src = url; imageDialogImage.alt = alt; imageDialog.showModal(); }
function postImages(urls, legacyUrl) { const candidates = Array.isArray(urls) ? urls : (legacyUrl ? [legacyUrl] : []); const container = document.createElement("div"); container.className = "post-images"; candidates.slice(0, 3).forEach((url, index) => { if (typeof url !== "string") return; try { if (new URL(url).protocol !== "https:") return; } catch { return; } const image = document.createElement("img"); const alt = `投稿に添付された画像 ${index + 1}`; image.className = "post-image"; image.src = url; image.alt = alt; image.loading = "lazy"; image.tabIndex = 0; image.setAttribute("role", "button"); image.setAttribute("aria-label", `${alt}を拡大表示`); image.addEventListener("click", () => openImage(url, alt)); image.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openImage(url, alt); } }); container.append(image); }); return container.childElementCount ? container : null; }
function replyNode(reply, number) { const article = document.createElement("article"); article.className = "reply"; const meta = document.createElement("div"); meta.className = "reply-meta"; meta.append(`#${number}  `, authorNode(reply.authorName, reply.authorColor), `　${formatDate(reply.createdAt)}`); article.append(meta); if (reply.body) { const body = document.createElement("p"); body.className = "post-body"; body.textContent = reply.body; article.append(body); } const images = postImages(reply.imageUrls, reply.imageUrl); if (images) article.append(images); return article; }
function renderReplies(snapshot) { replyList.replaceChildren(); $("#reply-count").textContent = `${snapshot.size} 件`; if (!snapshot.size) { replyList.innerHTML = '<p class="empty-state">まだレスはありません。最初のレスを投稿しよう。</p>'; return; } let number = 1; snapshot.forEach((reply) => replyList.append(replyNode(reply.data(), number++))); }
async function loadThread() {
  if (!id) { empty("スレッドが指定されていません。"); return; }
  if (!isFirebaseConfigured) { empty("Firebase の設定後にスレッドを表示します。"); return; }
  try {
    const threadRef = doc(db, "threads", id); const snapshot = await getDoc(threadRef);
    if (!snapshot.exists()) { empty("このスレッドは見つかりませんでした。"); return; }
    const thread = snapshot.data(); document.title = `${thread.title} | 10ちゃんねる`;
    detail.replaceChildren(); const title = document.createElement("h1"); title.textContent = thread.title; const meta = document.createElement("div"); meta.className = "thread-meta"; meta.append(authorNode(thread.authorName, thread.authorColor), `　${formatDate(thread.createdAt)}`); detail.append(title, meta); if (thread.firstPost) { const body = document.createElement("p"); body.className = "post-body"; body.textContent = thread.firstPost; detail.append(body); } const images = postImages(thread.imageUrls, thread.imageUrl); if (images) detail.append(images);
    // onSnapshot receives the current replies first, then pushes every later update from other accounts.
    const repliesQuery = query(collection(threadRef, "replies"), orderBy("createdAt", "asc"));
    unsubscribeReplies = onSnapshot(repliesQuery, renderReplies, (error) => showToast(firebaseMessage(error)));
  } catch (error) { empty(firebaseMessage(error)); }
}
replyForm.addEventListener("submit", async (event) => { event.preventDefault(); if (!currentUser) { showToast("投稿にはログインが必要です。"); location.href = "./login.html"; return; } const body = $("#reply-body").value.trim(); const authorName = $("#reply-author").value.trim() || "名無しさん"; const authorColor = $("#reply-author-color").value; const imageFiles = [...$("#reply-image").files]; if ((!body && !imageFiles.length) || !id) { showToast("本文または画像を入力してください。"); return; } const imageError = validateImages(imageFiles); if (imageError) { showToast(imageError); return; } replyButton.disabled = true; let images = []; try { const threadRef = doc(db, "threads", id); images = await uploadPostImages(imageFiles, currentUser.uid); const replyRef = doc(collection(threadRef, "replies")); const batch = writeBatch(db); batch.set(replyRef, { body, authorId: currentUser.uid, authorName, authorColor, imageUrls: images.map((image) => image.url), imagePaths: images.map((image) => image.path), imageUrl: images[0]?.url || null, createdAt: serverTimestamp() }); batch.update(threadRef, { replyCount: increment(1) }); await batch.commit(); replyForm.reset(); } catch (error) { await removePostImages(images).catch(console.warn); showToast(firebaseMessage(error)); } finally { replyButton.disabled = false; } });
loadThread();
window.addEventListener("pagehide", () => unsubscribeReplies?.());
$("#image-dialog-close").addEventListener("click", () => imageDialog.close());
imageDialog.addEventListener("click", (event) => { if (event.target === imageDialog) imageDialog.close(); });
