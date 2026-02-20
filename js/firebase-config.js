import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyAEEYS5XiE3Bjn15tgv3xshdkZJXNtwV1c",
    authDomain: "hospital-aziz.firebaseapp.com",
    databaseURL: "https://hospital-aziz-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "hospital-aziz",
    storageBucket: "hospital-aziz.firebasestorage.app",
    messagingSenderId: "417257060222",
    appId: "1:417257060222:web:50a63a521c1b1cd542252f",
    measurementId: "G-WWSHJ8M124"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

export { auth, rtdb, storage };
