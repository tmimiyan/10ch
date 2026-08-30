// Firebase Auth keeps the account creation time for both Google and Discord
// custom-token users. Using it avoids an extra Firestore write before posting.
import { Timestamp, doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./firebase.js";

export async function getFirstLoginAt(user) {
  const createdAt = Date.parse(user?.metadata?.creationTime || "");
  // A malformed/missing Auth metadata value must never prevent a post.
  return Number.isFinite(createdAt) ? Timestamp.fromMillis(createdAt) : Timestamp.now();
}

// Google accounts expose their name and avatar through Firebase Auth. Preserve
// the user's bio by merging only the provider-controlled fields.
export async function syncPublicProfile(user) {
  if (!user?.uid || (!user.displayName && !user.photoURL)) return;
  const photoURL = String(user.photoURL || "");
  const safePhotoURL = /^https:\/\//i.test(photoURL) ? photoURL : "";
  await setDoc(doc(db, "profiles", user.uid), {
    displayName: String(user.displayName || "ユーザー").trim().slice(0, 80) || "ユーザー",
    photoURL: safePhotoURL,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
