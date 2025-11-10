import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    try {
      // Attempt to initialize via GOOGLE_APPLICATION_CREDENTIALS if available in production
      admin.initializeApp();
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Ensure GOOGLE_APPLICATION_CREDENTIALS is set.', e);
      }
      // This is a fallback for local development or environments without the credential file.
      // It relies on the Firebase CLI's default credential discovery.
    }
  }
  return getSdks();
}

export function getSdks() {
  // Ensure we return the firestore instance from the initialized app
  const app = admin.app();
  return {
    firebaseApp: app,
    auth: admin.auth(app),
    firestore: admin.firestore(app)
  };
}
