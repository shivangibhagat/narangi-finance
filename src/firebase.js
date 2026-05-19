// ─── FILL IN YOUR FIREBASE CONFIG HERE ───────────────────────────────────────
// Get these values from: Firebase Console → Project Settings → Your Apps → SDK setup

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD1yZn-gUSKYJH-rLHjz0VLvW2L0HrUG9U",
  authDomain: "narangi-finance.firebaseapp.com",
  projectId: "narangi-finance",
  storageBucket: "narangi-finance.firebasestorage.app",
  messagingSenderId: "1068286469090",
  appId: "1:1068286469090:web:9eb99166e42cd00392cfbb"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
