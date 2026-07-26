// Home page: authenticates users, creates threads, and lists/searches Firestore data.
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { auth, db, isFirebaseConfigured } from "./firebase.js";
import { $, displayName, firebaseMessage, formatDate, showToast } from "./util.js";
import { initTheme } from "./theme.js";

initTheme();
const list = $("#thread-list"), form = $("#thread-form"), createButton = $("#create-thread-button");
let currentUser = null;

function syncAuth(user) {
  currentUser = user;
  $(".login-link").hidden = Boolean(user); $(".logout-button").hidden = !user;
  createButton.disabled = !user;
  createButton.title = user ? "" : "ログイン後に作成できます";
}
onAuthStateChanged(auth, syncAuth);
$(".logout-button").addEventListener("click", () => signOut(auth));

function renderThreads(threads) {
  list.replaceChildren(); $("#thread-count").textContent = `${threads.length} 件のスレッド`;
  if (!threads.length) { list.innerHTML = '<p class="empty-state">該当するスレッドはありません。</p>'; return; }
  const template = $("#thread-card-template");
  threads.forEach(({ id, ...thread }) => {
    const node = template.content.cloneNode(true); const link = $(".thread-card-link", node);
    link.href = `./thread.html?id=${encodeURIComponent(id)}`;
    $(".thread-title", node).textContent = thread.title;
    $(".thread-preview", node).textContent = thread.firstPost || "";
    $(".thread-author", node).textContent = thread.authorName || "名無しさん";
    $(".thread-date", node).textContent = formatDate(thread.createdAt);
    $(".thread-replies", node).textContent = `レス ${thread.replyCount || 0}`;
    list.append(node);
  });
}

async function loadThreads(keyword = "") {
  if (!isFirebaseConfigured) { list.innerHTML = '<p class="empty-state">Firebase の設定後にスレッドを表示します。</p>'; return; }
  list.innerHTML = '<p class="empty-state">読み込み中…</p>';
  try {
    const ref = collection(db, "threads"); const normalized = keyword.trim().toLocaleLowerCase("ja-JP");
    const q = normalized ? query(ref, orderBy("titleLower"), where("titleLower", ">=", normalized), where("titleLower", "<=", `${normalized}\uf8ff`), limit(30)) : query(ref, orderBy("createdAt", "desc"), limit(30));
    const snapshot = await getDocs(q); renderThreads(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } catch (error) { list.innerHTML = `<p class="empty-state">${firebaseMessage(error)}</p>`; }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) { showToast("スレッド作成にはログインが必要です。"); location.href = "./login.html"; return; }
  const data = new FormData(form); const title = data.get("title").trim(); const firstPost = data.get("body").trim();
  if (!title || !firstPost) return;
  createButton.disabled = true;
  try {
    const doc = await addDoc(collection(db, "threads"), { title, titleLower: title.toLocaleLowerCase("ja-JP"), firstPost, authorId: currentUser.uid, authorName: displayName(currentUser), createdAt: serverTimestamp(), replyCount: 0 });
    form.reset(); location.href = `./thread.html?id=${encodeURIComponent(doc.id)}`;
  } catch (error) { showToast(firebaseMessage(error)); createButton.disabled = false; }
});
$("#search-form").addEventListener("submit", (event) => { event.preventDefault(); const keyword = $("#search-input").value; $("#clear-search").hidden = !keyword.trim(); loadThreads(keyword); });
$("#clear-search").addEventListener("click", () => { $("#search-input").value = ""; $("#clear-search").hidden = true; loadThreads(); });
loadThreads();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.warn));
