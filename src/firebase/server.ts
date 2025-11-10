import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'studio-5852215415-cb248',
    });
  }
  return getSdks();
}

export function getSdks() {
  const app = admin.app();
  return {
    firebaseApp: app,
    auth: admin.auth(app),
    firestore: admin.firestore(app)
  };
}
