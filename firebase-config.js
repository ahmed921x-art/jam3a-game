/* ===========================================================
   لَمة — تهيئة Firebase (compat — بدون أدوات بناء)
   يجب تحميله بعد سكربتات firebase-*-compat.js وقبل auth.js
   =========================================================== */

firebase.initializeApp({
  apiKey: "AIzaSyANA88M2zm2ydQl049Z8r3ygN3Zm6ndbDI",
  authDomain: "jam3a-game.firebaseapp.com",
  projectId: "jam3a-game",
  storageBucket: "jam3a-game.firebasestorage.app",
  messagingSenderId: "400372304978",
  appId: "1:400372304978:web:00d2baad979fa7f9f7a38b",
});

const FB = {
  auth: firebase.auth(),
  db: firebase.firestore(),
};
