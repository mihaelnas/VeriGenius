
import 'server-only';

import admin from 'firebase-admin';
import { z } from 'zod';

// Schéma de validation pour la clé de compte de service
const serviceAccountSchema = z.object({
  type: z.string(),
  project_id: z.string(),
  private_key_id: z.string(),
  private_key: z.string(),
  client_email: z.string().email(),
  client_id: z.string(),
  auth_uri: z.string().url(),
  token_uri: z.string().url(),
  auth_provider_x509_cert_url: z.string().url(),
  client_x509_cert_url: z.string().url(),
  universe_domain: z.string().optional(),
});

function initializeAdminApp() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    console.error('La variable d\'environnement FIREBASE_SERVICE_ACCOUNT_JSON n\'est pas définie.');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const validation = serviceAccountSchema.safeParse(serviceAccount);

    if (!validation.success) {
      console.error("Le format du JSON dans FIREBASE_SERVICE_ACCOUNT_JSON est invalide.", validation.error.flatten());
      return null;
    }

    // N'initialise que s'il n'y a pas déjà d'applications initialisées
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialisé avec succès.');
    }
    
    return admin.firestore();

  } catch (error: any) {
    console.error("Erreur critique lors de l'initialisation de Firebase Admin:", error);
    return null;
  }
}

// Initialise la connexion et l'exporte pour être utilisée dans l'application.
// Le code ne s'exécutera qu'une seule fois au démarrage du serveur.
export const adminDb = initializeAdminApp();
