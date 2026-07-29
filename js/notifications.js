// Native notifications for devices that currently have this OpenBBS page open.
import { $, showToast } from "./util.js";

export function initNotifications() {
  const button = $(".notification-button");
  if (!button || !("Notification" in window)) return;
  button.addEventListener("click", requestNotifications);
  if (Notification.permission === "granted") button.textContent = "通知を許可済み";
}

async function requestNotifications() {
  if (Notification.permission === "denied") { showToast("ブラウザの設定から通知を許可してください。"); return; }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { showToast("通知は許可されませんでした。"); return; }
    $(".notification-button").textContent = "通知を許可済み";
    showToast("この端末で、ページを開いている間の通知を有効にしました。");
  } catch (error) { console.warn(error); showToast("通知の設定に失敗しました。"); }
}

export function showOpenPageNotification(title, body, url) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const notification = new Notification(title, { body });
  notification.onclick = () => { window.focus(); if (url) location.href = url; };
}
