// Google authentication entry page. Popup is used because it works well on GitHub Pages.
import { GoogleAuthProvider, onAuthStateChanged, signInWithCustomToken, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { auth, isFirebaseConfigured } from "./firebase.js";
import { $, firebaseMessage } from "./util.js";
import { initTheme } from "./theme.js";
import { getFirstLoginAt } from "./user.js?v=20260824-2";

initTheme();
// Login must remain available even if notification-related files are not deployed yet.
void import("./notifications-mobile.js?v=20260802-3")
  .then(({ initNotifications }) => initNotifications(() => null))
  .catch((error) => console.warn("Notification UI is unavailable.", error));
const button = $("#google-login");
const discordButton = $("#discord-login");
const status = $("#auth-status");
const DISCORD_LOGIN_URL = "https://10ch-notifier.mimiyan4649.workers.dev/discord/start";
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

onAuthStateChanged(auth, async (user) => { if (user) { try { await getFirstLoginAt(user); } catch (error) { console.warn(error); } location.replace("./index.html"); } });
const discordResult = new URLSearchParams(location.hash.slice(1));
const discordToken = discordResult.get("discordToken");
const discordError = discordResult.get("discordError");
if (discordToken) {
  history.replaceState(null, "", location.pathname);
  status.textContent = "Discord アカウントでログインしています…";
  signInWithCustomToken(auth, discordToken).catch((error) => { status.textContent = firebaseMessage(error); });
} else if (discordError) {
  history.replaceState(null, "", location.pathname);
  const errorMessages = {
    firebase_service_account_missing: "Firebaseサービスアカウントの設定がありません。",
    firebase_private_key_invalid: "Firebaseサービスアカウントの秘密鍵が正しくありません。",
    firebase_profile_access_token_failed: "Discordプロフィールを保存する権限がありません。",
    discord_profile_save_failed: "Discordプロフィールを保存できませんでした。",
    discord_token_invalid_client: "DiscordのClient IDまたはClient Secretが正しくありません。",
    discord_token_invalid_grant: "Discordの認可コードまたはRedirect URLが一致していません。",
    discord_token_invalid_request: "Discordへの認証リクエストが正しくありません。",
    discord_token_unauthorized_client: "このDiscordアプリはOAuthログインを許可されていません。",
    discord_token_unsupported_grant_type: "DiscordのOAuth設定が対応していません。",
    discord_token_unknown: "Discordの認証情報を交換できませんでした。",
    discord_user_verification_failed: "Discordアカウントを確認できませんでした。"
  };
  status.textContent = errorMessages[discordError] || "Discord ログインに失敗しました。もう一度お試しください。";
}
button.addEventListener("click", async () => {
  if (!isFirebaseConfigured) { status.textContent = "Firebase の設定値を js/firebase.js に入力してください。"; return; }
  button.disabled = true; status.textContent = "ログイン画面を開いています…";
  try { await signInWithPopup(auth, provider); } catch (error) { status.textContent = firebaseMessage(error); button.disabled = false; }
});
discordButton.addEventListener("click", () => {
  if (!isFirebaseConfigured) { status.textContent = "Firebase の設定値を js/firebase.js に入力してください。"; return; }
  discordButton.disabled = true;
  status.textContent = "Discord のログイン画面へ移動しています…";
  location.assign(DISCORD_LOGIN_URL);
});
