import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD8aCNxcm-kvX63Z00B8LdaC1cx87v6DU4",
  authDomain: "el-trull-stock.firebaseapp.com",
  projectId: "el-trull-stock",
  storageBucket: "el-trull-stock.firebasestorage.app",
  messagingSenderId: "618505158649",
  appId: "1:618505158649:web:ff3c83b91c0ac3b8ec0728"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
