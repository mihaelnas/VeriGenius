
import admin from 'firebase-admin';
import 'dotenv/config';

// Assurez-vous que les variables d'environnement sont chargées
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

let adminApp: admin.app.App;

export function initializeAdminApp() {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    if (!serviceAccountJson) {
        throw new Error('La variable d\'environnement FIREBASE_SERVICE_ACCOUNT_JSON doit être définie dans le fichier .env.');
    }

    try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        adminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        return adminApp;
    } catch (error: any) {
        console.error("Erreur d'initialisation de Firebase Admin:", error.message);
        throw new Error("Impossible d'initialiser le SDK Firebase Admin. Vérifiez la validité du JSON dans votre variable d'environnement.");
    }
}

// Initialise et exporte directement l'instance pour les autres modules
export const firebaseAdminApp = initializeAdminApp();
export const adminDb = admin.firestore();
