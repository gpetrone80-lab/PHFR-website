/* ============================================================================
 * Firebase configuration (OPTIONAL)
 *
 * The app works 100% locally without Firebase. To enable cloud sync of
 * member profiles and quiz results to Firestore:
 *
 *   1. Create a Firebase project at https://console.firebase.google.com
 *   2. Add a Web App (</> icon) to get your config values.
 *   3. Paste them below (replace the placeholder strings).
 *   4. In the Firebase console: Build > Firestore Database > Create database.
 *   5. Build > Authentication > Sign-in method > enable "Anonymous".
 *   6. Firestore Database > Rules > paste the contents of firestore.rules
 *      (in this repo) > Publish.
 *
 * When window.FIREBASE_CONFIG contains a real apiKey, app.js dynamically
 * loads the Firebase compat SDKs, signs in anonymously, and syncs profiles,
 * quiz results, and deletion tombstones to Firestore. If this file is left
 * as-is, everything stays on-device in localStorage.
 * ========================================================================== */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyD7xTuVQPhMKs62RBp6S7Qg_wv8NUlmV-s",
  authDomain: "phfr-hub.firebaseapp.com",
  projectId: "phfr-hub",
  storageBucket: "phfr-hub.firebasestorage.app",
  messagingSenderId: "240282189891",
  appId: "1:240282189891:web:4a1d9ce025b253c55ed4f6"
};
