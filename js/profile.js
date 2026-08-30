// Public profile page with a private-to-owner editable bio and combined post history.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { collection, collectionGroup, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { $, firebaseMessage, formatDate, showToast } from "./util.js";
import { initTheme } from "./theme.js";
import { initAccountMenu } from "./profile-ui.js";

initTheme();
initAccountMenu();
const profileId = new URLSearchParams(location.search).get("uid");
const postList = $("#profile-post-list");
let currentUser = null;

function safeImageURL(value) { return /^https:\/\//i.test(String(value || "")) ? String(value) : ""; }
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
}
function postNode(post) { const article = document.createElement("article"); article.className = "profile-post"; const link = document.createElement("a"); link.className = "profile-post-link"; link.href = `./thread.html?id=${encodeURIComponent(post.threadId)}`; const title = document.createElement("h3"); title.textContent = post.title; const body = document.createElement("p"); body.textContent = post.body || "画像付きの投稿"; const meta = document.createElement("p"); meta.className = "muted"; meta.textContent = `${post.kind}　${formatDate(post.createdAt)}`; link.append(title, body, meta); article.append(link); return article; }
async function loadPosts(uid) {
  postList.innerHTML = '<p class="empty-state">投稿を読み込み中…</p>';
  try {
    const [threads, replies] = await Promise.all([
      getDocs(query(collection(db, "threads"), where("authorId", "==", uid))),
      getDocs(query(collectionGroup(db, "replies"), where("authorId", "==", uid)))
    ]);
    const posts = [
      ...threads.docs.map((item) => ({ kind: "スレッド", threadId: item.id, title: item.data().title || "無題のスレッド", body: item.data().firstPost, createdAt: item.data().createdAt })),
      ...replies.docs.map((item) => ({ kind: "レス", threadId: item.ref.parent.parent.id, title: "スレッドのレス", body: item.data().body, createdAt: item.data().createdAt }))
    ].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    $("#profile-post-count").textContent = `${posts.length} 件`;
    postList.replaceChildren();
    if (!posts.length) { postList.innerHTML = '<p class="empty-state">投稿はまだありません。</p>'; return; }
    posts.forEach((post) => postList.append(postNode(post)));
  } catch (error) { postList.innerHTML = `<p class="empty-state">${firebaseMessage(error)}</p>`; }
}
async function loadProfile(uid) {
  const snapshot = await getDoc(doc(db, "profiles", uid));
  const profile = snapshot.data() || { displayName: currentUser?.displayName || "ユーザー", photoURL: currentUser?.photoURL || "", bio: "" };
  renderProfile(profile);
  const ownProfile = currentUser?.uid === uid;
  $("#profile-form").hidden = !ownProfile;
  if (ownProfile) $("#profile-bio-input").value = profile.bio || "";
  await loadPosts(uid);
}
$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || currentUser.uid !== profileId) return;
  const bio = $("#profile-bio-input").value.trim();
  try { await setDoc(doc(db, "profiles", currentUser.uid), { bio, updatedAt: serverTimestamp() }, { merge: true }); $("#profile-status").textContent = "保存しました。"; showToast("自己紹介を保存しました。"); }
  catch (error) { $("#profile-status").textContent = firebaseMessage(error); }
});
onAuthStateChanged(auth, async (user) => { currentUser = user; if (!user) { location.replace("./login.html"); return; } if (!profileId) { location.replace(`./profile.html?uid=${encodeURIComponent(user.uid)}`); return; } try { await loadProfile(profileId); } catch (error) { $("#profile-name").textContent = firebaseMessage(error); } });
