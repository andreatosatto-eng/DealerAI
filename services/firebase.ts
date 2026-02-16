import firebase from "firebase/compat/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- CONFIGURAZIONE FIREBASE ---
// SOSTITUISCI QUESTO OGGETTO CON I DATI DELLA TUA CONSOLE FIREBASE
// Vai su: Project Settings -> General -> Your Apps -> Web App
const firebaseConfig = {
  apiKey: "AIzaSyAMmSdhttvmkJkk5TeLJzfAhyeWXcz76-Q",
  authDomain: "dealerpro-studio.firebaseapp.com",
  projectId: "dealerpro-studio",
  storageBucket: "dealerpro-studio.firebasestorage.app",
  messagingSenderId: "64287719250",
  appId: "1:64287719250:web:4f2dbc4c417bccd846048b",
  measurementId: "G-ZFPV8RHRTK"
}

// Initialize Firebase
// Robust check: if app already exists (hot-reload), use it. Otherwise initialize.
// Using compat/app to ensure 'apps' and 'initializeApp' are available regardless of TS module resolution settings.
const app = firebase.apps.length > 0 ? firebase.app() : firebase.initializeApp(firebaseConfig);

// Explicitly pass the app instance to ensure services are bound to the correct app
// Casting as any to prevent strict type mismatch between compat App and modular FirebaseApp if types are inconsistent
const db = getFirestore(app as any);
const auth = getAuth(app as any);

export { db, auth };