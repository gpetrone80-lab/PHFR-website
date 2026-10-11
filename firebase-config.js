/* ============================================================================
 * Firebase configuration (OPTIONAL)
 *
 * The app works 100% locally without Firebase. To enable cloud sync of
 * user profiles and quiz results to Firestore:
 *
 *   1. Create a Firebase project at https://console.firebase.google.com
 *   2. Add a Web App to get your config values.
 *   3. Paste them below (replace the placeholder strings).
 *   4. In Firestore, create collections named `users` and `quizResults`,
 *      and publish rules that allow authenticated (or app) read/write.
 *
 * When window.FIREBASE_CONFIG contains a real apiKey, app.js dynamically
 * loads the Firebase compat SDKs and syncs profiles/results to Firestore.
 * If this file is left as-is, everything stays on-device in localStorage.
 * ========================================================================== */

window.FIREBASE_CONFIG = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};
