
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "polleria-web-eb19c.firebaseapp.com",
  projectId: "polleria-web-eb19c",
  storageBucket: "polleria-web-eb19c.firebasestorage.app",
  messagingSenderId: "484780023912",
  appId: "1:484780023912:web:c54d40e8bac166e3f69bdd"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
