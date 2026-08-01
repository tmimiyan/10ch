// OneSignal notification permission flow with mobile and iOS guidance.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { auth } from "./firebase.js";
import { registerNotificationDevice } from "./notification-devices.js";
import { $, showToast } from "./util.js";

const ONESIGNAL_APP_ID = "71ca2f3d-df06-4b33-b3e9-5b9d1ef60e76";
let sdk = null;
let currentUser = () => auth.currentUser;
let initialized = false;

function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(navigator.standalone);
}

function setButton(label, disabled = false) {
  const button = $(".notification-button");
  if (!button) return;
  button.textContent = label;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.disabled = disabled;
}

async function registerCurrentDevice(user = currentUser()) {
  const subscriptionId = sdk?.User?.PushSubscription?.id;
  if (user && subscriptionId && sdk?.User?.PushSubscription?.optedIn) {
    await registerNotificationDevice(user, subscriptionId);
  }
}

async function refreshButton() {
  if (Notification.permission === "granted" && sdk?.User?.PushSubscription?.optedIn) {
    setButton("通知オン");
    await registerCurrentDevice().catch(console.warn);
  }
}

async function requestPermission() {
  if (isAppleMobile() && !isStandalone()) {
    showToast("iPhone・iPadではSafariの共有メニューから「ホーム画面に追加」後、ホーム画面のアイコンから開いてください。");
    return;
  }
  if (!sdk) {
    showToast("通知サービスを準備中です。数秒後にもう一度押してください。");
    return;
  }
  if (Notification.permission === "denied") {
    showToast("端末またはブラウザ設定で、このサイトの通知を許可してください。");
    return;
  }
  try {
    await sdk.Notifications.requestPermission();
    await refreshButton();
    showToast(Notification.permission === "granted" ? "通知を許可しました。" : "通知はまだ許可されていません。");
  } catch (error) {
    console.warn("OneSignal permission request failed", error);
    showToast("通知の許可を開始できませんでした。ブラウザ設定を確認してください。");
  }
}

export function initNotifications(getUser = () => auth.currentUser) {
  currentUser = getUser;
  const button = $(".notification-button");
  if (!button || initialized) return;
  initialized = true;
  button.addEventListener("click", requestPermission, { passive: true });
  if (!("Notification" in window)) {
    setButton("通知非対応", true);
    return;
  }
  if (isAppleMobile() && !isStandalone()) setButton("通知の設定");

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (oneSignalSdk) => {
    try {
      const workerUrl = new URL("./onesignal/OneSignalSDKWorker.js", location.href);
      const workerScope = new URL("./onesignal/", location.href).pathname;
      await oneSignalSdk.init({ appId: ONESIGNAL_APP_ID, serviceWorkerPath: workerUrl.pathname, serviceWorkerParam: { scope: workerScope } });
      sdk = oneSignalSdk;
      await refreshButton();
      onAuthStateChanged(auth, (user) => registerCurrentDevice(user).catch(console.warn));
    } catch (error) {
      console.warn("OneSignal initialization failed", error);
      showToast("通知サービスを初期化できませんでした。ページを再読み込みしてください。");
    }
  });
}
