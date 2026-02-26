import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Importamos la base de datos

const firebaseConfig = {
  apiKey: "AIzaSyAGhYK3fW_B7NHe56Q8Q7iBht5zW5RTL8M",
  authDomain: "sistema-precios-app.firebaseapp.com",
  projectId: "sistema-precios-app",
  storageBucket: "sistema-precios-app.firebasestorage.app",
  messagingSenderId: "135585202333",
  appId: "1:135585202333:web:6ae23fe5e9158c14abd474",
  measurementId: "G-C2TWVQW6X8"
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);

// Exportamos la base de datos para usarla en App.js
export const db = getFirestore(app);