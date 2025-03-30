// firebase.js
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  updateDoc,
  addDoc,
  getDoc,
  query,
  Timestamp,
  getDocs,
  orderBy,
  FieldValue,
  where,
  arrayUnion,
  setDoc,
  writeBatch,
  onSnapshot,
  doc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  getIdToken,
} from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export {
  app,
  db,
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updateDoc,
  getAuth,
  sendEmailVerification,
  query,
  orderBy, // Import orderBy
  where, // Import where
  getIdToken,
  getFirestore,
  getDocs,
  writeBatch,
  onSnapshot,
  FieldValue,
  collection,
  addDoc,
  setDoc,
  arrayUnion,
  getDoc,
  Timestamp,
  doc,
  serverTimestamp,
  deleteDoc,
};
