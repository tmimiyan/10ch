// Google authentication entry page. Popup is used because it works well on GitHub Pages.
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { auth, isFirebaseConfigured } from "./firebase.js";
import { $, firebaseMessage } from "./util.js";
import { initTheme } from "./theme.js";

initTheme();
const button = $("#google-login");
const status = $("#auth-status");
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

onAuthStateChanged(auth, (user) => { if (user) location.replace("./index.html"); });
button.addEventListener("click", async () => {
  if (!isFirebaseConfigured) { status.textContent = "Firebase の設定値を js/firebase.js に入力してください。"; return; }
  button.disabled = true; status.textContent = "ログイン画面を開いています…";
  try { await signInWithPopup(auth, provider); } catch (error) { status.textContent = firebaseMessage(error); button.disabled = false; }
});
