// OneSignal の購読登録を、既存の「通知を許可」ボタンに接続します。
import { $, showToast } from "./util.js";

// OneSignal Dashboard > Settings > Keys & IDs で確認した App ID に置き換えてください。
const ONESIGNAL_APP_ID = "71ca2f3d-df06-4b33-b3e9-5b9d1ef60e76";
let oneSignal = null;

function configured() {
  return !ONESIGNAL_APP_ID.startsWith("71ca2f3d-df06-4b33-b3e9-5b9d1ef60e76");
}

function setNotificationButtonLabel(label) {
  const button = $(".notification-button");
  if (!button) return;
  button.textContent = label;
  button.setAttribute("aria-label", label);
  button.title = label;
}

async function refreshButtonLabel() {
  if (Notification.permission === "granted" && oneSignal?.User?.PushSubscription?.optedIn) {
    setNotificationButtonLabel("通知を許可済み");
  }
}

export function initNotifications() {
  const button = $(".notification-button");
  if (!button || !("Notification" in window)) return;
  button.addEventListener("click", requestNotifications);

  if (!configured()) {
    button.disabled = true;
    button.title = "OneSignal の App ID を設定してください";
    return;
  }

  // SDK の読み込み前でもキューへ登録でき、読み込み後は直ちに実行されます。
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (sdk) => {
    try {
      await sdk.init({
        appId: ONESIGNAL_APP_ID,
        // PWA 用 sw.js と競合しない専用スコープを使います。
        serviceWorkerPath: "onesignal/OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "./onesignal/" }
      });
      oneSignal = sdk;
      await refreshButtonLabel();
    } catch (error) {
      console.warn("OneSignal initialization failed", error);
      showToast("通知サービスを初期化できませんでした。");
    }
  });
}

async function requestNotifications() {
  if (!configured()) {
    showToast("OneSignal の App ID を設定してください。");
    return;
  }
  if (!oneSignal) {
    showToast("通知サービスを準備中です。少し待ってからもう一度押してください。");
    return;
  }
  if (Notification.permission === "denied") {
    showToast("ブラウザの設定から通知を許可してください。");
    return;
  }
  try {
    await oneSignal.Notifications.requestPermission();
    await refreshButtonLabel();
    if (Notification.permission === "granted") {
      showToast("この端末へのバックグラウンド通知を有効にしました。");
    } else {
      showToast("通知は許可されませんでした。");
    }
  } catch (error) {
    console.warn("OneSignal permission request failed", error);
    showToast("通知の許可を開始できませんでした。");
  }
}
