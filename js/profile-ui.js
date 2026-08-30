// Shared account-avatar menu for signed-in pages.
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

function safeImageURL(value) {
  return /^https:\/\//i.test(String(value || "")) ? String(value) : "";
}

export function initAccountMenu() {
  const menu = document.querySelector(".account-menu");
  const button = document.querySelector(".account-menu-button");
  const panel = document.querySelector(".account-menu-panel");
  const image = document.querySelector(".account-avatar-image");
  const fallback = document.querySelector(".account-avatar-fallback");
  const profileLink = document.querySelector(".account-profile-link");
  const loginLink = document.querySelector(".login-link");
  const logoutButton = document.querySelector(".logout-button");
  if (!menu || !button || !panel || !image || !fallback || !profileLink || !loginLink || !logoutButton) return;

  let stopProfileListener = null;
  const renderAvatar = (profile, user) => {
    const name = profile?.displayName || user.displayName || "ユーザー";
    const photoURL = safeImageURL(profile?.photoURL || user.photoURL);
    image.hidden = !photoURL;
    image.src = photoURL || "";
    image.alt = "";
    fallback.hidden = Boolean(photoURL);
    fallback.textContent = name.slice(0, 1).toUpperCase();
    button.setAttribute("aria-label", `${name} のアカウントメニュー`);
  };

  button.addEventListener("click", () => { panel.hidden = !panel.hidden; button.setAttribute("aria-expanded", String(!panel.hidden)); });
  document.addEventListener("click", (event) => { if (!menu.contains(event.target)) { panel.hidden = true; button.setAttribute("aria-expanded", "false"); } });
  logoutButton.addEventListener("click", () => signOut(auth));
  onAuthStateChanged(auth, (user) => {
    stopProfileListener?.();
    panel.hidden = true;
    if (!user) { menu.hidden = true; loginLink.hidden = false; return; }
    menu.hidden = false;
    loginLink.hidden = true;
    profileLink.href = `./profile.html?uid=${encodeURIComponent(user.uid)}`;
    renderAvatar(null, user);
    stopProfileListener = onSnapshot(doc(db, "profiles", user.uid), (snapshot) => renderAvatar(snapshot.data(), user), () => renderAvatar(null, user));
  });
}
