
import * as admin from 'firebase-admin';
import 'dotenv/config';

// Ce fichier gère l'initialisation du SDK Admin de Firebase pour un usage côté serveur (API routes).
// Il est crucial pour les opérations sécurisées qui nécessitent des privilèges élevés.

/**
 * Interface pour les identifiants du compte de service Firebase.
 * Correspond à la structure du JSON de la clé privée.
 */
interface FirebaseServiceAccount {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

// Récupération des identifiants depuis les variables d'environnement.
// Assurez-vous que ces variables sont définies dans votre environnement d'hébergement (Vercel).
const serviceAccount: FirebaseServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID!,
  privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'), // Remplace les échappements de nouvelle ligne
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
};

// Initialisation de l'application Firebase Admin.
// On vérifie si elle a déjà été initialisée pour éviter les erreurs de "ré-initialisation".
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.stack);
  }
}

// Exportation de l'instance de la base de données Firestore du SDK Admin pour être utilisée dans les API routes.
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
