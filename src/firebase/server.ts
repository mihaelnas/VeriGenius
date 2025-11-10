import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    try {
      // Attempt to initialize via GOOGLE_APPLICATION_CREDENTIALS
      admin.initializeApp();
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Ensure GOOGLE_APPLICATION_CREDENTIALS is set.', e);
      }
      // Fallback for local development if needed, though credentials should be preferred
      admin.initializeApp();
    }
  }
  return getSdks();
}

export function getSdks() {
  return {
    firebaseApp: admin.app(),
    auth: admin.auth(),
    firestore: admin.firestore()
  };
}
