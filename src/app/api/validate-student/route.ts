
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { z } from 'zod';

// Force la route à être dynamique pour s'assurer qu'elle est exécutée côté serveur à chaque appel
export const dynamic = 'force-dynamic';

// --- Début de la logique de Firebase Admin ---

// Schéma de validation pour la clé de compte de service, utile pour le parsing
const serviceAccountSchema = z.object({
  type: z.string(),
  project_id: z.string(),
  private_key_id: z.string(),
  private_key: z.string().startsWith('-----BEGIN PRIVATE KEY-----'),
  client_email: z.string().email(),
  client_id: z.string(),
  auth_uri: z.string().url(),
  token_uri: z.string().url(),
  auth_provider_x509_cert_url: z.string().url(),
  client_x509_cert_url: z.string().url(),
  universe_domain: z.string().optional(),
});

let adminDb: admin.firestore.Firestore;

// Fonction d'initialisation robuste pour les environnements serverless
function initializeAdminApp() {
    // Si l'application admin est déjà initialisée, ne rien faire
    if (admin.apps.length > 0) {
        if (!adminDb) {
            adminDb = admin.firestore();
        }
        return;
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    
    // Log crucial pour le débogage sur Vercel
    console.log('Vérification de FIREBASE_SERVICE_ACCOUNT_JSON:', serviceAccountJson ? 'Variable présente.' : 'Variable ABSENTE ou vide.');

    if (!serviceAccountJson) {
        throw new Error('La variable d\'environnement FIREBASE_SERVICE_ACCOUNT_JSON doit être définie sur Vercel.');
    }

    try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        const validation = serviceAccountSchema.safeParse(serviceAccount);
        
        if (!validation.success) {
            console.error("Erreur de validation Zod du JSON du compte de service:", validation.error.flatten());
            throw new Error("Le format du JSON dans FIREBASE_SERVICE_ACCOUNT_JSON est invalide.");
        }
        
        console.log('Initialisation de Firebase Admin...');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        
        adminDb = admin.firestore();
        console.log('Firebase Admin initialisé avec succès.');

    } catch (error: any) {
        // Cette erreur est normale si plusieurs appels arrivent en même temps ("cold start")
        if (error.code === 'app/duplicate-app') {
            console.warn("Avertissement: Tentative d'initialisation dupliquée de Firebase Admin interceptée.");
             if (!adminDb) {
                adminDb = admin.firestore();
             }
        } else {
            console.error("Erreur critique lors de l'initialisation de Firebase Admin:", error);
            throw new Error("Impossible d'initialiser le SDK Firebase Admin.");
        }
    }
}

// Initialiser l'application une seule fois au démarrage de la fonction
initializeAdminApp();

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
        };
        await db.collection('request-logs').add(logData);
    } catch (logError) {
        console.error("Échec de l'écriture du log API :", logError);
    }
}


export async function POST(request: NextRequest) {
  console.log('Requête POST reçue sur /api/validate-student');
  let responseBody;
  let statusCode;
  let requestBody;

  try {
    requestBody = await request.json();
    console.log('Corps de la requête:', requestBody);
  } catch (e) {
      statusCode = 400;
      responseBody = { error: 'Corps de la requête invalide, doit être du JSON.' };
      console.log('Réponse envoyée (400):', responseBody);
      // Le logging échouera probablement si DB n'est pas prêt, mais on essaie
      if (adminDb) await logApiRequest(adminDb, request, {error: "Invalid JSON body"}, responseBody, statusCode);
      return NextResponse.json(responseBody, { status: statusCode });
  }

  // Vérifier que Firebase Admin est bien prêt
  if (!adminDb) {
    console.error("Erreur critique: adminDb n'est pas initialisé au moment de la requête.");
    statusCode = 500;
    responseBody = { error: 'Erreur de configuration du serveur: Base de données non initialisée.' };
    return NextResponse.json(responseBody, { status: statusCode });
  }

  try {
    const validationResult = studentValidationSchema.safeParse(requestBody);

    if (!validationResult.success) {
      statusCode = 400;
      responseBody = { error: 'Données invalides', details: validationResult.error.flatten() };
      console.log('Réponse envoyée (400):', responseBody);
      await logApiRequest(adminDb, request, requestBody, responseBody, statusCode);
      return NextResponse.json(responseBody, { status: statusCode });
    }

    const { studentId, firstName, lastName } = validationResult.data;

    const studentsRef = adminDb.collection('students');
    const snapshot = await studentsRef.where('studentId', '==', studentId).limit(1).get();

    if (snapshot.empty) {
      statusCode = 404;
      responseBody = { error: 'Étudiant non trouvé avec ce matricule' };
      console.log('Réponse envoyée (404):', responseBody);
      await logApiRequest(adminDb, request, requestBody, responseBody, statusCode);
      return NextResponse.json(responseBody, { status: statusCode });
    }

    const studentDoc = snapshot.docs[0];
    const studentData = studentDoc.data();

    const formattedRequestFirstName = capitalize(firstName);
    const formattedRequestLastName = lastName.toUpperCase();

    if (studentData.firstName !== formattedRequestFirstName || studentData.lastName !== formattedRequestLastName) {
      statusCode = 403;
      responseBody = { error: 'Le nom ou prénom ne correspond pas au matricule' };
      console.log('Réponse envoyée (403):', responseBody);
      await logApiRequest(adminDb, request, requestBody, responseBody, statusCode);
      return NextResponse.json(responseBody, { status: statusCode });
    }
    
    if (studentData.status === 'pending_payment' || studentData.status === 'inactive') {
        statusCode = 402;
        responseBody = { error: 'Le statut de l\'étudiant ne permet pas l\'inscription. Paiement en attente ou inactif.' };
        console.log('Réponse envoyée (402):', responseBody);
        await logApiRequest(adminDb, request, requestBody, responseBody, statusCode);
        return NextResponse.json(responseBody, { status: statusCode });
    }

    statusCode = 200;
    responseBody = {
      message: 'Étudiant validé avec succès',
      classId: studentData.classId,
    };
    console.log('Réponse envoyée (200):', responseBody);
    await logApiRequest(adminDb, request, requestBody, responseBody, statusCode);
    return NextResponse.json(responseBody, { status: statusCode });

  } catch (error) {
    console.error('Erreur interne du serveur lors du traitement:', error);
    statusCode = 500;
    responseBody = { error: 'Erreur interne du serveur', details: error instanceof Error ? error.message : 'Erreur inconnue' };
    console.log('Réponse envoyée (500):', responseBody);
    // Logguer l'erreur finale
    if(adminDb) {
      await logApiRequest(adminDb, request, requestBody, responseBody, statusCode);
    }
    return NextResponse.json(responseBody, { status: statusCode });
  }
}
