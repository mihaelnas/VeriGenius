
import admin from 'firebase-admin';
import 'dotenv/config';

// Assurez-vous que les variables d'environnement sont chargées
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
    throw new Error('La variable d\'environnement FIREBASE_SERVICE_ACCOUNT_JSON doit être définie.');
}

let adminApp: admin.app.App;

export function initializeAdminApp() {
    if (admin.apps.length === 0) {
        try {
            const serviceAccount = JSON.parse(serviceAccountJson);
            adminApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        } catch (error: any) {
            console.error("Erreur d'initialisation de Firebase Admin:", error);
            throw new Error("Impossible d'initialiser le SDK Firebase Admin. Vérifiez vos identifiants de service.");
        }
    } else {
        adminApp = admin.app();
    }
    return adminApp;
}
