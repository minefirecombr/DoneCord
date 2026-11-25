import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCECejHt1ymWIYaOUBgzRLdMDgF-92WkS0",
  authDomain: "discord-5d772.firebaseapp.com",
  databaseURL: "https://discord-5d772-default-rtdb.firebaseio.com",
  projectId: "discord-5d772",
  storageBucket: "discord-5d772.firebasestorage.app",
  messagingSenderId: "909071121885",
  appId: "1:909071121885:web:00e88aa484a51b6aebca34",
  measurementId: "G-XVJFWQJS8B"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
