import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD6x7MTOjOsh_QCLy2NAxHEVM2FL3j1fbU",
  authDomain: "huymck-98553.firebaseapp.com",
  projectId: "huymck-98553",
  storageBucket: "huymck-98553.firebasestorage.app",
  messagingSenderId: "119485242404",
  appId: "1:119485242404:web:30cfa89fae7a7a3011ccb1",
  measurementId: "G-CY2C3RKY0Q"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail };
