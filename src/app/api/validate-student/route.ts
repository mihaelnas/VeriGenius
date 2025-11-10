
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import admin from 'firebase-admin';
import { studentValidationSchema } from '@/lib/verigenius-types';
import type { Student } from '@/lib/verigenius-types';

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

// Fonction d'initialisation robuste et simplifiée pour l'environnement serverless
function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.error("CRITICAL: La variable d'environnement FIREBASE_SERVICE_ACCOUNT_JSON n'est pas définie.");
    throw new Error("Configuration du serveur incomplète.");
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const validation = serviceAccountSchema.safeParse(serviceAccount);
    if (!validation.success) {
      console.error("CRITICAL: Le format du JSON dans FIREBASE_SERVICE_ACCOUNT_JSON est invalide.", validation.error.flatten());
      throw new Error("Configuration du service account invalide.");
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialisé avec succès.');
    return admin.firestore();
  } catch (error: any) {
    console.error("CRITICAL: Erreur lors de l'initialisation de Firebase Admin:", error.message);
    throw new Error("Erreur irrécupérable lors de l'initialisation de Firebase Admin.");
  }
}

async function logApiRequest(db: admin.firestore.Firestore, requestBody: any, responseBody: any, statusCode: number, clientIp: string | null) {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            requestBody,
            responseBody,
            statusCode,
            isSuccess: statusCode === 200,
            clientIp: clientIp || 'Unknown',
        };
        await db.collection('request-logs').add(logEntry);
    } catch (error) {
        console.error("Erreur lors de la journalisation de la requête API:", error);
    }
}

export async function POST(request: NextRequest) {
    const clientIp = request.ip;
    let requestBody: any = {};
    let db: admin.firestore.Firestore;

    // 1. Initialiser la DB en premier
    try {
        db = initializeAdminApp();
    } catch (error: any) {
        console.error("Échec de l'initialisation de la base de données Admin:", error.message);
        // Ne peut pas journaliser si la DB ne s'initialise pas.
        const response = { success: false, message: "Erreur critique du serveur: La base de données n'a pas pu être initialisée." };
        return NextResponse.json(response, { status: 500 });
    }

    // 2. Essayer de lire le corps de la requête
    try {
        requestBody = await request.json();
    } catch (error) {
        const response = { success: false, message: "Le corps de la requête est invalide ou n'est pas du JSON." };
        // Maintenant, nous pouvons journaliser cette erreur !
        await logApiRequest(db, { error: "Invalid JSON body" }, response, 400, clientIp);
        return NextResponse.json(response, { status: 400 });
    }
    
    // 3. Valider les données
    const validation = studentValidationSchema.safeParse(requestBody);
    if (!validation.success) {
        const response = { success: false, message: "Données de validation invalides.", errors: validation.error.flatten() };
        await logApiRequest(db, requestBody, response, 400, clientIp);
        return NextResponse.json(response, { status: 400 });
    }
    
    // 4. Logique métier
    const { studentId, firstName, lastName } = validation.data;

    try {
        const studentsRef = db.collection('students');
        const querySnapshot = await studentsRef
            .where('studentId', '==', studentId)
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            const response = { success: false, message: "Validation échouée: Étudiant non trouvé." };
            await logApiRequest(db, requestBody, response, 404, clientIp);
            return NextResponse.json(response, { status: 404 });
        }

        const studentDoc = querySnapshot.docs[0];
        const studentData = studentDoc.data() as Student;

        const isNameMatch = studentData.firstName.toLowerCase() === firstName.toLowerCase() &&
                            studentData.lastName.toLowerCase() === lastName.toLowerCase();

        if (!isNameMatch) {
            const response = { success: false, message: "Validation échouée: Le nom ne correspond pas." };
            await logApiRequest(db, requestBody, response, 403, clientIp);
            return NextResponse.json(response, { status: 403 });
        }
        
        if (studentData.status !== 'fully_paid' && studentData.status !== 'partially_paid') {
            const response = { success: false, message: "Validation échouée: Le statut de l'étudiant n'est pas valide pour l'accès.", status: studentData.status };
            await logApiRequest(db, requestBody, response, 403, clientIp);
            return NextResponse.json(response, { status: 403 });
        }

        const response = { success: true, message: "Validation réussie.", classId: studentData.classId };
        await logApiRequest(db, requestBody, response, 200, clientIp);
        return NextResponse.json(response, { status: 200 });

    } catch (error: any) {
        console.error("Erreur serveur lors de la validation:", error);
        const response = { success: false, message: "Erreur interne du serveur." };
        // S'assure de journaliser aussi les erreurs serveur inattendues
        await logApiRequest(db, requestBody, response, 500, clientIp);
        return NextResponse.json(response, { status: 500 });
    }
}
