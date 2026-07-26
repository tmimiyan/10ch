// Thread detail page: reads a thread and writes replies to a Firestore subcollection.
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { addDoc, collection, doc, getDoc, getDocs, increment, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { auth, db, isFirebaseConfigured } from "./firebase.js";
import { $, displayName, firebaseMessage, formatDate, showToast } from "./util.js";
import { initTheme } from "./theme.js";

initTheme();
const id = new URLSearchParams(location.search).get("id");
const detail = $("#thread-detail"), replyList = $("#reply-list"), replyForm = $("#reply-form"), replyButton = $("#reply-button");
let currentUser = null;

function syncAuth(user) { currentUser = user; $(".login-link").hidden = Boolean(user); $(".logout-button").hidden = !user; replyButton.disabled = !user; $("#login-notice").textContent = user ? `${displayName(user)} として投稿します。` : "投稿にはログインが必要です。"; }
onAuthStateChanged(auth, syncAuth); $(".logout-button").addEventListener("click", () => signOut(auth));
function empty(message) { detail.innerHTML = `<p class="empty-state">${message}</p>`; }
function replyNode(reply, number) { const article = document.createElement("article"); article.className = "reply"; const meta = document.createElement("div"); meta.className = "reply-meta"; meta.textContent = `#${number}  ${reply.authorName || "名無しさん"}　${formatDate(reply.createdAt)}`; const body = document.createElement("p"); body.className = "post-body"; body.textContent = reply.body; article.append(meta, body); return article; }
async function loadThread() {
  if (!id) { empty("スレッドが指定されていません。"); return; }
  if (!isFirebaseConfigured) { empty("Firebase の設定後にスレッドを表示します。"); return; }
  try {
    const threadRef = doc(db, "threads", id); const snapshot = await getDoc(threadRef);
    if (!snapshot.exists()) { empty("このスレッドは見つかりませんでした。"); return; }
    const thread = snapshot.data(); document.title = `${thread.title} | OpenBBS`;
    detail.replaceChildren(); const title = document.createElement("h1"); title.textContent = thread.title; const meta = document.createElement("div"); meta.className = "thread-meta"; meta.textContent = `${thread.authorName || "名無しさん"}　${formatDate(thread.createdAt)}`; const body = document.createElement("p"); body.className = "post-body"; body.textContent = thread.firstPost; detail.append(title, meta, body);
    const replies = await getDocs(query(collection(threadRef, "replies"), orderBy("createdAt", "asc")));
    replyList.replaceChildren(); $("#reply-count").textContent = `${replies.size} 件`;
    if (!replies.size) replyList.innerHTML = '<p class="empty-state">まだレスはありません。最初のレスを投稿しよう。</p>';
    replies.forEach((reply, index) => replyList.append(replyNode(reply.data(), index + 1)));
  } catch (error) { empty(firebaseMessage(error)); }
}
replyForm.addEventListener("submit", async (event) => { event.preventDefault(); if (!currentUser) { showToast("投稿にはログインが必要です。"); location.href = "./login.html"; return; } const body = $("#reply-body").value.trim(); if (!body || !id) return; replyButton.disabled = true; try { const threadRef = doc(db, "threads", id); await addDoc(collection(threadRef, "replies"), { body, authorId: currentUser.uid, authorName: displayName(currentUser), createdAt: serverTimestamp() }); await updateDoc(threadRef, { replyCount: increment(1) }); replyForm.reset(); await loadThread(); } catch (error) { showToast(firebaseMessage(error)); } finally { replyButton.disabled = false; } });
loadThread();