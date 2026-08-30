// Home page: authenticates users, creates threads, and lists/searches Firestore data.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { auth, db, isFirebaseConfigured } from "./firebase.js";
import { removePostImages, uploadPostImages, validateImages } from "./media.js";
import { $, displayName, firebaseMessage, formatDate, showToast } from "./util.js";
import { initTheme } from "./theme.js";
import { getFirstLoginAt, syncPublicProfile } from "./user.js?v=20260830-1";
import { initAccountMenu } from "./profile-ui.js";

initTheme();
initAccountMenu();
const list = $("#thread-list"), form = $("#thread-form"), createButton = $("#create-thread-button");
let currentUser = null;
const ADMIN_EMAIL = "tomohiro6231@gmail.com";
const ADMIN_AUTHOR_NAME = "管理者";
const ADMIN_AUTHOR_COLOR = "#c026d3";

function isAdminUser(user) { return user?.email?.toLowerCase() === ADMIN_EMAIL; }
function isAdminPost(post) { return post?.authorName === ADMIN_AUTHOR_NAME && post?.authorColor?.toLowerCase() === ADMIN_AUTHOR_COLOR; }
function hasProfileLink(post) { return post?.authorProfileVisible === true || (post?.authorProfileVisible === undefined && post?.authorName && post.authorName !== "名無しさん"); }
function postAuthor(user, name, color) {
  return isAdminUser(user)
    ? { name: ADMIN_AUTHOR_NAME, color: ADMIN_AUTHOR_COLOR }
    : { name: name?.trim() || "名無しさん", color };
}
function lockAuthorInputs(user) {
  const nameInput = $("#thread-author"), colorInput = $("#thread-author-color");
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

function syncAuth(user) {
  currentUser = user;
  if (!user) {
    location.replace("./login.html");
    return;
  }
  lockAuthorInputs(user);
  getFirstLoginAt(user).catch(console.warn);
  $(".login-link").hidden = Boolean(user);
  syncPublicProfile(user).catch(console.warn);
  createButton.disabled = !user;
  createButton.title = user ? "" : "ログイン後に作成できます";
  loadThreads();
}
onAuthStateChanged(auth, syncAuth);

function renderThreads(threads) {
  list.replaceChildren(); $("#thread-count").textContent = `${threads.length} 件のスレッド`;
  if (!threads.length) { list.innerHTML = '<p class="empty-state">該当するスレッドはありません。</p>'; return; }
  const template = $("#thread-card-template");
  threads.forEach(({ id, ...thread }) => {
    const node = template.content.cloneNode(true); const link = $(".thread-card-link", node);
    link.href = `./thread.html?id=${encodeURIComponent(id)}`;
    $(".thread-title", node).textContent = thread.title;
    $(".thread-preview", node).textContent = thread.firstPost || (thread.imageUrls?.length || thread.imageUrl ? "画像付きの投稿" : "");
    const author = $(".thread-author", node); author.textContent = thread.authorName || "名無しさん";
    if (hasProfileLink(thread) && thread.authorId) author.href = `./profile.html?uid=${encodeURIComponent(thread.authorId)}`;
    else { author.removeAttribute("href"); author.classList.add("is-anonymous"); }
    // The crown is generated only for the administrator's protected post identity.
    if (isAdminPost(thread)) author.append(document.createTextNode(" 👑"));
    if (/^#[0-9a-f]{6}$/i.test(thread.authorColor || "")) author.style.color = thread.authorColor;
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
  const imageFiles = [...$("#thread-image").files];
  const inputAuthorName = data.get("authorName")?.trim() || "";
  if (!isAdminUser(currentUser) && inputAuthorName.includes("👑")) { showToast("王冠の絵文字は管理者専用です。"); return; }
  const author = postAuthor(currentUser, inputAuthorName, data.get("authorColor"));
  if (!title || (!firstPost && !imageFiles.length)) { showToast("本文または画像を入力してください。"); return; }
  const imageError = validateImages(imageFiles);
  if (imageError) { showToast(imageError); return; }
  createButton.disabled = true;
  let images = [];
  try {
    images = await uploadPostImages(imageFiles, currentUser.uid);
    const authorProfileVisible = isAdminUser(currentUser) || Boolean(inputAuthorName && inputAuthorName !== "名無しさん");
    const doc = await addDoc(collection(db, "threads"), { title, titleLower: title.toLocaleLowerCase("ja-JP"), firstPost, authorId: currentUser.uid, authorName: author.name, authorColor: author.color, authorProfileVisible, imageUrls: images.map((image) => image.url), imagePaths: images.map((image) => image.path), imageUrl: images[0]?.url || null, createdAt: serverTimestamp(), replyCount: 0 });
    requestPostNotification({ type: "thread", threadId: doc.id });
    form.reset(); location.href = `./thread.html?id=${encodeURIComponent(doc.id)}`;
  } catch (error) { await removePostImages(images).catch(console.warn); showToast(firebaseMessage(error)); createButton.disabled = false; }
});
$("#search-form").addEventListener("submit", (event) => { event.preventDefault(); const keyword = $("#search-input").value; $("#clear-search").hidden = !keyword.trim(); loadThreads(keyword); });
$("#clear-search").addEventListener("click", () => { $("#search-input").value = ""; $("#clear-search").hidden = true; loadThreads(); });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js?v=20260830-1").catch(console.warn));
