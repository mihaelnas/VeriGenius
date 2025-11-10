
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import admin from 'firebase-admin';
import { studentValidationSchema } from '@/lib/verigenius-types';
import type { Student } from '@/lib/verigenius-types';

// Schéma de validation pour le compte de service Firebase
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

/**
 * Initialise l'application Firebase Admin si elle ne l'est pas déjà.
 * @returns {admin.firestore.Firestore} L'instance de la base de données Firestore.
 */
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

// Fonction de journalisation séparée
async function logApiRequest(db: admin.firestore.Firestore | null, requestBody: any, responseBody: any, statusCode: number, clientIp: string | null) {
    // Temporairement désactivé pour le test
    // if (!db) return; 
    // try {
    //     const logEntry = {
    //         timestamp: new Date().toISOString(),
    //         requestBody,
    //         responseBody,
    //         statusCode,
    //         isSuccess: statusCode === 200,
    //         clientIp: clientIp || 'Unknown',
    //     };
    //     await db.collection('request-logs').add(logEntry);
    // } catch (error) {
    //     console.error("Erreur lors de la journalisation de la requête API:", error);
    // }
}


export async function POST(request: NextRequest) {
    const clientIp = request.ip;
    let requestBody: any;
    
    // On n'initialise pas la DB pour ce test pour isoler la logique de comparaison
    const db = null; 

    try {
        requestBody = await request.json();
    } catch (error) {
        const response = { success: false, message: "Le corps de la requête est invalide ou n'est pas du JSON." };
        await logApiRequest(db, {error: "Invalid JSON body"}, response, 400, clientIp);
        return NextResponse.json(response, { status: 400 });
    }

    const validation = studentValidationSchema.safeParse(requestBody);
    if (!validation.success) {
        const response = { success: false, message: "Données de validation invalides.", errors: validation.error.flatten() };
        await logApiRequest(db, requestBody, response, 400, clientIp);
        return NextResponse.json(response, { status: 400 });
    }
    
    const { studentId, firstName, lastName } = validation.data;

    try {
        // --- DÉBUT DE LA SIMULATION ---
        // On crée un "faux" étudiant qui correspond à la requête de test
        const fakeStudentFromDB: Student = {
            id: 'fake-id',
            studentId: "1814 H-F",
            firstName: "Irinah",
            lastName: "RAOEL",
            level: 'L3',
            fieldOfStudy: 'IG',
            status: 'fully_paid',
            classId: 'L3-IG-G1'
        };

        const isFirstNameMatch = fakeStudentFromDB.firstName.toLowerCase() === firstName.toLowerCase();
        const isLastNameMatch = fakeStudentFromDB.lastName.toLowerCase() === lastName.toLowerCase();
        
        // On ajoute des logs pour voir ce qui est comparé
        console.log(`Comparaison Prénom: DB='${fakeStudentFromDB.firstName.toLowerCase()}' vs REQUETE='${firstName.toLowerCase()}' -> ${isFirstNameMatch}`);
        console.log(`Comparaison Nom: DB='${fakeStudentFromDB.lastName.toLowerCase()}' vs REQUETE='${lastName.toLowerCase()}' -> ${isLastNameMatch}`);


        if (!isFirstNameMatch || !isLastNameMatch) {
            const response = { success: false, message: "DEBUG (SIMULATION): Le nom ou le prénom ne correspond pas." };
            await logApiRequest(db, requestBody, response, 403, clientIp);
            return NextResponse.json(response, { status: 403 });
        }
        
        if (fakeStudentFromDB.status !== 'fully_paid' && fakeStudentFromDB.status !== 'partially_paid') {
            const response = { 
                success: false, 
                message: "DEBUG (SIMULATION): Le statut de paiement de l'étudiant ne permet pas la validation.",
                status: fakeStudentFromDB.status
            };
            await logApiRequest(db, requestBody, response, 403, clientIp);
            return NextResponse.json(response, { status: 403 });
        }

        const successResponse = {
            success: true,
            message: "DEBUG (SIMULATION): La validité de l'étudiant a été confirmée.",
            student: {
                studentId: fakeStudentFromDB.studentId,
                firstName: fakeStudentFromDB.firstName,
                lastName: fakeStudentFromDB.lastName,
                level: fakeStudentFromDB.level,
                fieldOfStudy: fakeStudentFromDB.fieldOfStudy,
                status: fakeStudentFromDB.status,
                classId: fakeStudentFromDB.classId
            }
        };
        // --- FIN DE LA SIMULATION ---

        await logApiRequest(db, requestBody, successResponse, 200, clientIp);
        return NextResponse.json(successResponse, { status: 200 });

    } catch (error) {
        console.error("Erreur de simulation:", error);
        const errorResponse = { success: false, message: "Erreur interne du serveur lors de la simulation." };
        await logApiRequest(db, requestBody, errorResponse, 500, clientIp);
        return NextResponse.json(errorResponse, { status: 500 });
    }
}
