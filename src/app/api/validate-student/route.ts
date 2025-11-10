
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
  private_key: z.string(),
  client_email: z.string(),
  client_id: z.string(),
  auth_uri: z.string(),
  token_uri: z.string(),
  auth_provider_x509_cert_url: z.string(),
  client_x509_cert_url: z.string(),
  universe_domain: z.string().optional(), // Rendre ce champ optionnel
});

let adminDb: admin.firestore.Firestore;

// Cette fonction sera maintenant appelée UNIQUEMENT à l'intérieur de la fonction POST
function initializeAdminApp() {
    if (admin.apps.length > 0 && adminDb) {
        return adminDb;
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    
    // Log pour le débogage
    console.log('Contenu de FIREBASE_SERVICE_ACCOUNT_JSON:', serviceAccountJson ? 'Variable présente' : 'Variable ABSENTE');

    if (!serviceAccountJson) {
        // Cette erreur se produira au moment de l'exécution si la variable d'environnement n'est pas définie sur Vercel
        throw new Error('La variable d\'environnement FIREBASE_SERVICE_ACCOUNT_JSON doit être définie.');
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
        // Ne pas logger l'erreur si elle indique simplement que l'app existe déjà
        if (error.code !== 'app/duplicate-app') {
            console.error("Erreur d'initialisation de Firebase Admin:", error);
            throw new Error("Impossible d'initialiser le SDK Firebase Admin.");
        }
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
        };
        await db.collection('request-logs').add(logData);
    } catch (logError) {
        console.error("Échec de l'écriture du log API :", logError);
    }
}


export async function POST(request: NextRequest) {
  console.log('Requête POST reçue sur /api/validate-student');
  let db;
  let responseBody;
  let statusCode;
  const requestBody = await request.json();
  console.log('Corps de la requête:', requestBody);


  try {
    db = initializeAdminApp();
    const validationResult = studentValidationSchema.safeParse(requestBody);

    if (!validationResult.success) {
      statusCode = 400;
      responseBody = { error: 'Données invalides', details: validationResult.error.flatten() };
      console.log('Réponse envoyée (400):', responseBody);
      return NextResponse.json(responseBody, { status: statusCode });
    }

    const { studentId, firstName, lastName } = validationResult.data;

    const studentsRef = db.collection('students');
    const snapshot = await studentsRef.where('studentId', '==', studentId).limit(1).get();

    if (snapshot.empty) {
      statusCode = 404;
      responseBody = { error: 'Étudiant non trouvé avec ce matricule' };
      console.log('Réponse envoyée (404):', responseBody);
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
      return NextResponse.json(responseBody, { status: statusCode });
    }
    
    if (studentData.status === 'pending_payment' || studentData.status === 'inactive') {
        statusCode = 402;
        responseBody = { error: 'Le statut de l\'étudiant ne permet pas l\'inscription. Paiement en attente ou inactif.' };
        console.log('Réponse envoyée (402):', responseBody);
        return NextResponse.json(responseBody, { status: statusCode });
    }

    statusCode = 200;
    responseBody = {
      message: 'Étudiant validé avec succès',
      classId: studentData.classId,
    };
    console.log('Réponse envoyée (200):', responseBody);
    return NextResponse.json(responseBody, { status: statusCode });

  } catch (error) {
    console.error('Erreur interne du serveur:', error);
    statusCode = 500;
    responseBody = { error: 'Erreur interne du serveur', details: error instanceof Error ? error.message : 'Erreur inconnue' };
    console.log('Réponse envoyée (500):', responseBody);
    return NextResponse.json(responseBody, { status: statusCode });
  } finally {
      if(db && responseBody) {
        await logApiRequest(db, request, requestBody, responseBody, statusCode || 500);
      }
  }
}
