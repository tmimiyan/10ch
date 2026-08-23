// Firebase Auth keeps the account creation time for both Google and Discord
// custom-token users. Using it avoids an extra Firestore write before posting.
import { Timestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

export async function getFirstLoginAt(user) {
  const createdAt = Date.parse(user?.metadata?.creationTime || "");
  // A malformed/missing Auth metadata value must never prevent a post.
  return Number.isFinite(createdAt) ? Timestamp.fromMillis(createdAt) : Timestamp.now();
}
