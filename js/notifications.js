// Browser notification registration for Firebase Cloud Messaging (FCM).
import { getMessaging, getToken, isSupported, onMessage } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging.js";
import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { app, db, isFirebaseConfigured } from "./firebase.js";
import { $, firebaseMessage, showToast } from "./util.js";

// Replace this with the Web Push certificate public key from Firebase Console > Cloud Messaging.
const VAPID_PUBLIC_KEY = "YOUR_WEB_PUSH_CERTIFICATE_KEY";
let messaging = null;

function configured() { return isFirebaseConfigured && !VAPID_PUBLIC_KEY.startsWith("BJBaVgxxVaJIxcpKdVSlsLBxsovMBozr-23JH-3jNf_Uij4paCTdn3lYT_WSOnyZMxwBxftQw8eHj64bx1-qpgs"); }

async function getMessagingInstance() {
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

export function initNotifications(getCurrentUser) {
  const button = $(".notification-button");
  if (!button || !("Notification" in window)) return;
  button.addEventListener("click", () => requestNotifications(getCurrentUser()));
  if (Notification.permission === "granted") button.textContent = "通知を許可済み";

  // Foreground messages are shown as native notifications too.
  isSupported().then(async (supported) => {
    if (!supported || !configured()) return;
    const instance = await getMessagingInstance();
    onMessage(instance, (payload) => {
      if (Notification.permission !== "granted") return;
      const title = payload.data?.title || "10ちゃんねる";
      const notification = new Notification(title, { body: payload.data?.body || "新しい投稿があります。" });
      notification.onclick = () => { window.focus(); if (payload.data?.url) location.href = payload.data.url; };
    });
  }).catch(console.warn);
}

async function requestNotifications(user) {
  if (!user) { showToast("通知を有効にするにはログインしてください。"); return; }
  if (!configured()) { showToast("FCM の Web Push 証明書キーを js/notifications.js に設定してください。"); return; }
  if (!(await isSupported())) { showToast("このブラウザはプッシュ通知に対応していません。"); return; }
  if (Notification.permission === "denied") { showToast("ブラウザの設定から通知を許可してください。"); return; }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { showToast("通知は許可されませんでした。"); return; }
    const registration = await navigator.serviceWorker.register("./sw.js");
    const token = await getToken(await getMessagingInstance(), { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: registration });
    if (!token) { showToast("通知用端末IDを取得できませんでした。"); return; }
    // Token is stored only for server-side delivery; browser clients cannot read other devices.
    await setDoc(doc(db, "notificationTokens", encodeURIComponent(token)), { uid: user.uid, token, updatedAt: serverTimestamp() });
    $(".notification-button").textContent = "通知を許可済み";
    showToast("この端末への通知を有効にしました。");
  } catch (error) { showToast(firebaseMessage(error)); }
}
