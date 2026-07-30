// Firebase Cloud Messaging registration for foreground and background notifications.
import { getMessaging, getToken, isSupported, onMessage } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging.js";
import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { app, db, isFirebaseConfigured } from "./firebase.js";
import { $, firebaseMessage, showToast } from "./util.js";

// Firebase Console > Cloud Messaging > Web Push certificates public key.
const VAPID_PUBLIC_KEY = "BJBaVgxxVaJIxcpKdVSlsLBxsovMBozr-23JH-3jNf_Uij4paCTdn3lYT_WSOnyZMxwBxftQw8eHj64bx1-qpgs";
let messaging = null;

function configured() { return isFirebaseConfigured && !VAPID_PUBLIC_KEY.startsWith("YOUR_"); }
async function getMessagingInstance() { if (!messaging) messaging = getMessaging(app); return messaging; }

export function initNotifications(getCurrentUser) {
  const button = $(".notification-button");
  if (!button || !("Notification" in window)) return;
  button.addEventListener("click", () => requestNotifications(getCurrentUser()));
  if (Notification.permission === "granted") setNotificationButtonLabel("通知を許可済み");
  isSupported().then(async (supported) => {
    if (!supported || !configured()) return;
    onMessage(await getMessagingInstance(), (payload) => {
      if (Notification.permission !== "granted") return;
      const notification = new Notification(payload.data?.title || "10ちゃんねる", { body: payload.data?.body || "新しい投稿があります。" });
      notification.onclick = () => { window.focus(); if (payload.data?.url) location.href = payload.data.url; };
    });
  }).catch(console.warn);
}

async function requestNotifications(user) {
  if (!user) { showToast("通知を有効にするにはログインしてください。"); return; }
  if (!configured()) { showToast("FCM の Web Push 証明書キーを設定してください。"); return; }
  if (!(await isSupported())) { showToast("このブラウザはプッシュ通知に対応していません。"); return; }
  if (Notification.permission === "denied") { showToast("ブラウザの設定から通知を許可してください。"); return; }
  try {
    if (await Notification.requestPermission() !== "granted") { showToast("通知は許可されませんでした。"); return; }
    const registration = await navigator.serviceWorker.register("./sw.js");
    const token = await getToken(await getMessagingInstance(), { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: registration });
    if (!token) { showToast("通知用端末IDを取得できませんでした。"); return; }
    await setDoc(doc(db, "notificationTokens", encodeURIComponent(token)), { uid: user.uid, token, updatedAt: serverTimestamp() });
    setNotificationButtonLabel("通知を許可済み"); showToast("この端末へのバックグラウンド通知を有効にしました。");
  } catch (error) { showToast(firebaseMessage(error)); }
}

function setNotificationButtonLabel(label) { const button = $(".notification-button"); button.textContent = label; button.setAttribute("aria-label", label); button.title = label; }
