// Store each opted-in browser's OneSignal subscription ID in Firestore.
// The Worker uses this registry to send directly to every opted-in device.
import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./firebase.js";

export async function registerNotificationDevice(user, subscriptionId) {
  if (!user || !subscriptionId) return;
  await setDoc(doc(db, "notificationDevices", subscriptionId), {
    ownerId: user.uid,
    subscriptionId,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
