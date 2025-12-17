
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBHHXKt2Vo6YQHoUzuMk7SI2QvFMzAqJnE",
  authDomain: "electrorescue01.firebaseapp.com",
  projectId: "electrorescue01",
  storageBucket: "electrorescue01.firebasestorage.app",
  messagingSenderId: "285059674632",
  appId: "1:285059674632:web:86e6790b3ba80e612d97bd",
  measurementId: "G-YMJ0XWPBLW"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
