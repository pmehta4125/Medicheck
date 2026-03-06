// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBL1IaQcQUBM6NIOOjSBZK01p-F4K5BLTA",
  authDomain: "medicheck-a0ebc.firebaseapp.com",
  projectId: "medicheck-a0ebc",
  storageBucket: "medicheck-a0ebc.appspot.com",
  messagingSenderId: "795196955520",
  appId: "1:795196955520:web:0d37f1cacbe805f1be3f65",
  measurementId: "G-4M6QY92NDB"
};

const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();