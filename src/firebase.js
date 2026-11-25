import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";

// Cole aqui a configuração WEB do MESMO projeto discord-5d772.
// Firebase Console > Configurações do projeto > Seus apps > Aplicativo da Web.
export const firebaseConfig = {
  apiKey: "COLE_SUA_API_KEY",
  authDomain: "discord-5d772.firebaseapp.com",
  databaseURL: "https://discord-5d772-default-rtdb.firebaseio.com",
  projectId: "discord-5d772",
  storageBucket: "COLE_SEU_STORAGE_BUCKET",
  messagingSenderId: "COLE_SEU_MESSAGING_SENDER_ID",
  appId: "COLE_SEU_APP_ID"
};

if (firebaseConfig.apiKey.startsWith("COLE_") || firebaseConfig.appId.startsWith("COLE_")) {
  console.warn("Configure firebaseConfig em src/firebase.js antes de usar o app.");
}
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
