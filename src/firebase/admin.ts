
import * as admin from 'firebase-admin';

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

function getServiceAccount(): FirebaseServiceAccount {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('La variable d\'environnement FIREBASE_PRIVATE_KEY est manquante.');
    }

    return {
        projectId: process.env.FIREBASE_PROJECT_ID!,
        privateKey: privateKey.replace(/\\n/g, '\n'), // Remplace les échappements de nouvelle ligne
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    };
}


// Initialisation de l'application Firebase Admin.
// On vérifie si elle a déjà été initialisée pour éviter les erreurs de "ré-initialisation".
if (!admin.apps.length) {
  try {
    const serviceAccount = getServiceAccount();
    if (serviceAccount.projectId && serviceAccount.clientEmail) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('Firebase Admin SDK initialized successfully.');
    } else {
        console.warn('Firebase Admin SDK not initialized because environment variables are missing.');
    }
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.stack);
  }
}

// Exportation de l'instance de la base de données Firestore du SDK Admin pour être utilisée dans les API routes.
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
