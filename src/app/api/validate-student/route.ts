
import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { z } from 'zod';

// --- Début de l'Initialisation de Firebase Admin ---

// Schéma de validation pour la clé de compte de service
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

// Fonction pour initialiser l'application admin en toute sécurité
function initializeAdminApp() {
    // Évite la réinitialisation en développement
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
        throw new Error('La variable d\'environnement FIREBASE_SERVICE_ACCOUNT_JSON doit être définie dans le fichier .env.');
    }

    try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        // Valider le JSON avec Zod
        serviceAccountSchema.parse(serviceAccount);
        
        return admin.initializeApp({
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
}

// Initialisez l'application et obtenez la base de données
const adminApp = initializeAdminApp();
const adminDb = admin.firestore();

// --- Fin de l'Initialisation ---


// Schéma de validation pour la requête POST
const studentValidationSchema = z.object({
  studentId: z.string().regex(/^\d{4} [A-Z]-[A-Z]$/, "Le format du matricule doit être '1234 A-B'."),
  firstName: z.string().min(1, 'Le prénom de l\'étudiant est requis'),
  lastName: z.string().min(1, 'Le nom de l\'étudiant est requis'),
});


// Helper function to capitalize the first letter of each word
const capitalize = (str: string) => {
    if (!str) return '';
    return str
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validationResult = studentValidationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Données invalides', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { studentId, firstName, lastName } = validationResult.data;

    const studentsRef = adminDb.collection('students');
    const snapshot = await studentsRef.where('studentId', '==', studentId).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Étudiant non trouvé avec ce matricule' }, { status: 404 });
    }

    const studentDoc = snapshot.docs[0];
    const studentData = studentDoc.data();

    // Normalize names for comparison
    const formattedRequestFirstName = capitalize(firstName);
    const formattedRequestLastName = lastName.toUpperCase();

    if (studentData.firstName !== formattedRequestFirstName || studentData.lastName !== formattedRequestLastName) {
      return NextResponse.json({ error: 'Le nom ou prénom ne correspond pas au matricule' }, { status: 403 });
    }
    
    if (studentData.status === 'pending_payment' || studentData.status === 'inactive') {
        return NextResponse.json({ error: 'Le statut de l\'étudiant ne permet pas l\'inscription. Paiement en attente ou inactif.' }, { status: 402 });
    }

    // If validation is successful
    return NextResponse.json({
      message: 'Étudiant validé avec succès',
      classId: studentData.classId,
    }, { status: 200 });

  } catch (error) {
    console.error('Erreur de validation de l\'étudiant:', error);
    if (error instanceof Error) {
        return NextResponse.json({ error: 'Erreur interne du serveur', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
