// Record the first successful sign-in once, using Firestore's server timestamp.
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./firebase.js";

const firstLoginRequests = new Map();

async function loadFirstLoginAt(user) {
  const userRef = doc(db, "users", user.uid);
  let snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    await setDoc(userRef, { firstLoginAt: serverTimestamp() });
    snapshot = await getDoc(userRef);
  }
  return snapshot.data().firstLoginAt;
}

export function getFirstLoginAt(user) {
  if (!firstLoginRequests.has(user.uid)) {
    const request = loadFirstLoginAt(user).catch((error) => { firstLoginRequests.delete(user.uid); throw error; });
    firstLoginRequests.set(user.uid, request);
  }
  return firstLoginRequests.get(user.uid);
}
