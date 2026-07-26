// Firebase SDK v11 (modular API). Replace these values with your Firebase project settings.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Keep the placeholder check explicit so a deployment error is easy to understand.
export const isFirebaseConfigured = !Object.values(firebaseConfig).some((value) => value.includes("YOUR_"));
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);