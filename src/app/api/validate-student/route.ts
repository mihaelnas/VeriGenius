
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { z } from 'zod';
import 'dotenv/config';

// --- Début de la logique de Firebase Admin ---

// Schéma de validation pour la clé de compte de service, utile pour le parsing
const serviceAccountSchema = z.object({
  type: z.string(),
  project_id: z.string(),
  private_key_id: z.string(),
  private_key: z.string(),
  client_email: z.string(),
  client_id: z.string(),
  auth_uri: z.string(),
  token_uri: z.string(),
  auth_provider_x509_cert_url: z.string(),
  client_x509_cert_url: z.string(),
});

let adminDb: admin.firestore.Firestore;

// Cette fonction sera maintenant appelée UNIQUEMENT à l'intérieur de la fonction POST
function initializeAdminApp() {
    if (admin.apps.length > 0) {
        if (!adminDb) {
            adminDb = admin.firestore();
        }
        return adminDb;
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
        // Cette erreur ne se produira qu'au moment de l'exécution si .env est manquant, pas au build.
        throw new Error('La variable d\'environnement FIREBASE_SERVICE_ACCOUNT_JSON doit être définie dans le fichier .env.');
    }

    try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        // Valider le JSON avec Zod pour plus de sécurité
        serviceAccountSchema.parse(serviceAccount);
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
             console.error("Erreur de validation du JSON du compte de service:", error.flatten());
             throw new Error("Le format du JSON dans FIREBASE_SERVICE_ACCOUNT_JSON est invalide.");
        }
        console.error("Erreur d'initialisation de Firebase Admin:", error.message);
        throw new Error("Impossible d'initialiser le SDK Firebase Admin. Vérifiez le contenu du fichier .env.");
    }
    
    adminDb = admin.firestore();
    return adminDb;
}

// --- Fin de la logique Firebase Admin ---


// Schéma de validation pour le corps de la requête POST
const studentValidationSchema = z.object({
  studentId: z.string().regex(/^\d{4} [A-Z]-[A-Z]$/, "Le format du matricule doit être '1234 A-B'."),
  firstName: z.string().min(1, 'Le prénom de l\'étudiant est requis'),
  lastName: z.string().min(1, 'Le nom de l\'étudiant est requis'),
});


// Helper pour mettre en majuscule la première lettre de chaque mot
const capitalize = (str: string) => {
    if (!str) return '';
    return str
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

async function logApiRequest(db: admin.firestore.Firestore, request: NextRequest, requestBody: any, responseBody: any, statusCode: number) {
    try {
        const logData = {
            timestamp: new Date().toISOString(),
            requestBody,
            responseBody,
            statusCode,
            isSuccess: statusCode === 200,
            clientIp: request.ip || 'unknown',
            headers: request.headers,
        };
        await db.collection('request-logs').add(logData);
    } catch (logError) {
        console.error("Échec de l'écriture du log API :", logError);
    }
}


export async function POST(request: NextRequest) {
  let db;
  let responseBody;
  let statusCode;
  const requestBody = await request.json();

  try {
    db = initializeAdminApp();
    const validationResult = studentValidationSchema.safeParse(requestBody);

    if (!validationResult.success) {
      statusCode = 400;
      responseBody = { error: 'Données invalides', details: validationResult.error.flatten() };
      return NextResponse.json(responseBody, { status: statusCode });
    }

    const { studentId, firstName, lastName } = validationResult.data;

    const studentsRef = db.collection('students');
    const snapshot = await studentsRef.where('studentId', '==', studentId).limit(1).get();

    if (snapshot.empty) {
      statusCode = 404;
      responseBody = { error: 'Étudiant non trouvé avec ce matricule' };
      return NextResponse.json(responseBody, { status: statusCode });
    }

    const studentDoc = snapshot.docs[0];
    const studentData = studentDoc.data();

    const formattedRequestFirstName = capitalize(firstName);
    const formattedRequestLastName = lastName.toUpperCase();

    if (studentData.firstName !== formattedRequestFirstName || studentData.lastName !== formattedRequestLastName) {
      statusCode = 403;
      responseBody = { error: 'Le nom ou prénom ne correspond pas au matricule' };
      return NextResponse.json(responseBody, { status: statusCode });
    }
    
    if (studentData.status === 'pending_payment' || studentData.status === 'inactive') {
        statusCode = 402;
        responseBody = { error: 'Le statut de l\'étudiant ne permet pas l\'inscription. Paiement en attente ou inactif.' };
        return NextResponse.json(responseBody, { status: statusCode });
    }

    statusCode = 200;
    responseBody = {
      message: 'Étudiant validé avec succès',
      classId: studentData.classId,
    };
    return NextResponse.json(responseBody, { status: statusCode });

  } catch (error) {
    statusCode = 500;
    responseBody = { error: 'Erreur interne du serveur', details: error instanceof Error ? error.message : 'Erreur inconnue' };
    return NextResponse.json(responseBody, { status: statusCode });
  } finally {
      if(db && responseBody) {
        await logApiRequest(db, request, requestBody, responseBody, statusCode || 500);
      }
  }
}
