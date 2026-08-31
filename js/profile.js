// Public profile page with a private-to-owner editable bio and combined post history.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { collection, collectionGroup, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { $, firebaseMessage, formatDate, showToast } from "./util.js";
import { initTheme } from "./theme.js?v=20260831-2";
import { initAccountMenu } from "./profile-ui.js?v=20260831-2";
import { syncPublicProfile } from "./user.js?v=20260830-2";

initTheme();
initAccountMenu();
const profileId = new URLSearchParams(location.search).get("uid");
const postList = $("#profile-post-list");
let currentUser = null;
let loadedProfile = null;

// The profile page has the same header controls as the board and thread pages.
void import("./notifications-mobile.js?v=20260830-1")
  .then(({ initNotifications }) => initNotifications(() => currentUser))
  .catch((error) => console.warn("Notification UI is unavailable.", error));

function safeImageURL(value) { return /^https:\/\//i.test(String(value || "")) ? String(value) : ""; }
// Keep a profile name on one line by reducing its size to the available space.
// The CSS ellipsis remains as a final guard for exceptionally long names.
function fitProfileName() {
  const nameElement = $("#profile-name");
  if (!nameElement) return;
  let size = Math.min(innerWidth <= 560 ? 24 : 32, Math.max(18, innerWidth * 0.06));
  nameElement.style.fontSize = `${size}px`;
  while (nameElement.scrollWidth > nameElement.clientWidth && size > 13) {
    size -= 0.5;
    nameElement.style.fontSize = `${size}px`;
  }
}
function renderProfile(profile) {
  const name = profile?.displayName || "ユーザー";
  const photoURL = safeImageURL(profile?.photoURL);
  $("#profile-name").textContent = name;
  $("#profile-bio").textContent = profile?.bio || "自己紹介はまだありません。";
  $("#profile-avatar").hidden = !photoURL;
  $("#profile-avatar").src = photoURL || "";
  $("#profile-avatar-fallback").hidden = Boolean(photoURL);
  $("#profile-avatar-fallback").textContent = name.slice(0, 1).toUpperCase();
  document.title = `${name} のプロフィール | 10ちゃんねる`;
  requestAnimationFrame(fitProfileName);
}
function postNode(post) { const article = document.createElement("article"); article.className = "profile-post"; const link = document.createElement("a"); link.className = "profile-post-link"; link.href = `./thread.html?id=${encodeURIComponent(post.threadId)}`; const title = document.createElement("h3"); title.textContent = post.title; const body = document.createElement("p"); body.textContent = post.body || "画像付きの投稿"; const meta = document.createElement("p"); meta.className = "muted"; meta.textContent = `${post.kind}　${formatDate(post.createdAt)}`; link.append(title, body, meta); article.append(link); return article; }
async function loadPosts(uid) {
  postList.innerHTML = '<p class="empty-state">投稿を読み込み中…</p>';
  // Fetch the two collections independently. A temporary failure in one must not
  // hide the other type of post from the profile page.
  const [threadResult, replyResult] = await Promise.allSettled([
    getDocs(query(collection(db, "threads"), where("authorId", "==", uid))),
    getDocs(query(collectionGroup(db, "replies"), where("authorId", "==", uid)))
  ]);

  const threads = threadResult.status === "fulfilled" ? threadResult.value.docs : [];
  const replies = replyResult.status === "fulfilled" ? replyResult.value.docs : [];
  const posts = [
    ...threads.map((item) => ({ kind: "スレッド", threadId: item.id, title: item.data().title || "無題のスレッド", body: item.data().firstPost, createdAt: item.data().createdAt })),
    ...replies.map((item) => ({ kind: "レス", threadId: item.ref.parent.parent?.id || "", title: "スレッドのレス", body: item.data().body, createdAt: item.data().createdAt }))
  ].filter((post) => post.threadId).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  $("#profile-post-count").textContent = `${posts.length} 件`;
  postList.replaceChildren();
  if (posts.length) posts.forEach((post) => postList.append(postNode(post)));
  else postList.innerHTML = '<p class="empty-state">投稿はまだありません。</p>';

  const failed = [threadResult, replyResult].find((result) => result.status === "rejected");
  if (failed) {
    const notice = document.createElement("p");
    notice.className = "empty-state";
    notice.textContent = `一部の投稿を読み込めませんでした。${firebaseMessage(failed.reason)}`;
    postList.prepend(notice);
  }
}
async function loadProfile(uid) {
  const snapshot = await getDoc(doc(db, "profiles", uid));
  const profile = snapshot.data() || { displayName: currentUser?.displayName || "ユーザー", photoURL: currentUser?.photoURL || "", bio: "" };
  loadedProfile = profile;
  renderProfile(profile);
  const ownProfile = currentUser?.uid === uid;
  $("#profile-form").hidden = !ownProfile;
  if (ownProfile) {
    $("#profile-name-input").value = profile.displayName || "";
    $("#profile-bio-input").value = profile.bio || "";
  }
  await loadPosts(uid);
}
$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || currentUser.uid !== profileId) return;
  const displayName = $("#profile-name-input").value.trim();
  const bio = $("#profile-bio-input").value.trim();
  if (!displayName) { $("#profile-status").textContent = "ユーザー名を入力してください。"; return; }
  try {
    await setDoc(doc(db, "profiles", currentUser.uid), {
      displayName: displayName.slice(0, 80),
      photoURL: safeImageURL(loadedProfile?.photoURL || currentUser.photoURL),
      bio,
      updatedAt: serverTimestamp()
    }, { merge: true });
    loadedProfile = { ...loadedProfile, displayName: displayName.slice(0, 80), bio };
    renderProfile(loadedProfile);
    $("#profile-status").textContent = "保存しました。";
    showToast("プロフィールを保存しました。");
  }
  catch (error) { $("#profile-status").textContent = firebaseMessage(error); }
});
onAuthStateChanged(auth, async (user) => { currentUser = user; if (!user) { location.replace("./login.html"); return; } if (!profileId) { location.replace(`./profile.html?uid=${encodeURIComponent(user.uid)}`); return; } try { await syncPublicProfile(user); await loadProfile(profileId); } catch (error) { $("#profile-name").textContent = firebaseMessage(error); } });
addEventListener("resize", fitProfileName);
