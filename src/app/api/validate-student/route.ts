
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
    if (!db) return; // Ne pas journaliser si la base de données n'est pas disponible
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
    let requestBody: any;
    let db: admin.firestore.Firestore | null = null;
    
    try {
      db = initializeAdminApp();
    } catch(initError: any) {
        const errorResponse = { success: false, message: "Erreur critique du serveur lors de l'initialisation." };
        // On ne peut pas journaliser ici car l'initialisation a échoué.
        return NextResponse.json(errorResponse, { status: 500 });
    }

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
        const studentsRef = db.collection('students');
        const snapshot = await studentsRef.where('studentId', '==', studentId).limit(1).get();

        if (snapshot.empty) {
            const response = { success: false, message: `L'étudiant avec le matricule ${studentId} n'a pas été trouvé.` };
            await logApiRequest(db, requestBody, response, 404, clientIp);
            return NextResponse.json(response, { status: 404 });
        }

        const studentDoc = snapshot.docs[0];
        const studentData = studentDoc.data() as Student;

        const isFirstNameMatch = studentData.firstName.toLowerCase() === firstName.toLowerCase();
        const isLastNameMatch = studentData.lastName.toLowerCase() === lastName.toLowerCase();

        if (!isFirstNameMatch || !isLastNameMatch) {
            const response = { success: false, message: "Le nom ou le prénom ne correspond pas au matricule fourni." };
            await logApiRequest(db, requestBody, response, 403, clientIp);
            return NextResponse.json(response, { status: 403 });
        }
        
        if (studentData.status !== 'fully_paid' && studentData.status !== 'partially_paid') {
            const response = { 
                success: false, 
                message: "Le statut de paiement de l'étudiant ne permet pas la validation.",
                status: studentData.status
            };
            await logApiRequest(db, requestBody, response, 403, clientIp);
            return NextResponse.json(response, { status: 403 });
        }

        const successResponse = {
            success: true,
            message: "La validité de l'étudiant a été confirmée.",
            student: {
                studentId: studentData.studentId,
                firstName: studentData.firstName,
                lastName: studentData.lastName,
                level: studentData.level,
                fieldOfStudy: studentData.fieldOfStudy,
                status: studentData.status,
                classId: studentData.classId
            }
        };

        await logApiRequest(db, requestBody, successResponse, 200, clientIp);
        return NextResponse.json(successResponse, { status: 200 });

    } catch (error) {
        console.error("Erreur serveur lors de la validation de l'étudiant:", error);
        const errorResponse = { success: false, message: "Erreur interne du serveur. Impossible de traiter la demande." };
        await logApiRequest(db, requestBody, errorResponse, 500, clientIp);
        return NextResponse.json(errorResponse, { status: 500 });
    }
}
