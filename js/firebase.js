// Firebase SDK v11 (modular API). Replace these values with your Firebase project settings.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA41mpWT_KWOlC8V2JiR_pf2gJT063sK1k",
  authDomain: "openbbs-31b16.firebaseapp.com",
  projectId: "openbbs-31b16",
  storageBucket: "openbbs-31b16.firebasestorage.app",
  messagingSenderId: "176143277737",
  appId: "1:176143277737:web:b4018284d84b19d8b9d3b8"
};

// Keep the placeholder check explicit so a deployment error is easy to understand.

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
