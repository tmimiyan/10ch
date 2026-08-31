// Shared avatar menu. The profile page uses a checkbox + label for native
// mobile tapping; the board and thread pages retain their regular button menu.
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
  const toggle = menu?.querySelector(".account-menu-toggle");
  if (!menu || !button || !panel || !image || !fallback || !profileLink || !loginLink || !logoutButton) return;

  const usesNativeToggle = toggle instanceof HTMLInputElement;
  let stopProfileListener = null;

  const setOpen = (open) => {
    if (usesNativeToggle) toggle.checked = open;
    else panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  };
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

  if (usesNativeToggle) {
    toggle.addEventListener("change", () => button.setAttribute("aria-expanded", String(toggle.checked)));
  } else {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setOpen(panel.hidden);
    });
    panel.addEventListener("click", (event) => event.stopPropagation());
  }
  document.addEventListener("click", (event) => { if (!menu.contains(event.target)) setOpen(false); });
  logoutButton.addEventListener("click", () => signOut(auth));

  onAuthStateChanged(auth, (user) => {
    stopProfileListener?.();
    setOpen(false);
    if (!user) { menu.hidden = true; loginLink.hidden = false; return; }
    menu.hidden = false;
    loginLink.hidden = true;
    profileLink.href = `./profile.html?uid=${encodeURIComponent(user.uid)}`;
    renderAvatar(null, user);
    stopProfileListener = onSnapshot(doc(db, "profiles", user.uid), (snapshot) => renderAvatar(snapshot.data(), user), () => renderAvatar(null, user));
  });
}
