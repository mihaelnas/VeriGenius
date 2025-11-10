
import { NextResponse } from 'next/server';
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

// Cette fonction sera maintenant appelée UNIQUEMENT à l'intérieur de la fonction POST
function getAdminDb() {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
        // Cette erreur ne se produira qu'au moment de l'exécution si .env est manquant, pas au build.
        throw new Error('La variable d\'environnement FIREBASE_SERVICE_ACCOUNT_JSON doit être définie dans le fichier .env.');
    }

    // Évite la réinitialisation si l'app est déjà initialisée (utile en dev)
    if (admin.apps.length > 0) {
        return admin.firestore();
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
    
    return admin.firestore();
}

// --- Fin de la logique Firebase Admin ---


// Schéma de validation pour le corps de la requête POST
const studentValidationSchema = z.object({
  studentId: z.string().regex(/^\d{4}\s[A-Z]-[A-Z]$/, "Le format du matricule doit être '1234 A-B'."),
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

export async function POST(request: Request) {
  try {
    // L'initialisation se fait ici, au moment de l'appel !
    const adminDb = getAdminDb();

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

    // Normalisation des noms pour la comparaison
    const formattedRequestFirstName = capitalize(firstName);
    const formattedRequestLastName = lastName.toUpperCase();

    if (studentData.firstName !== formattedRequestFirstName || studentData.lastName !== formattedRequestLastName) {
      return NextResponse.json({ error: 'Le nom ou prénom ne correspond pas au matricule' }, { status: 403 });
    }
    
    if (studentData.status === 'pending_payment' || studentData.status === 'inactive') {
        return NextResponse.json({ error: 'Le statut de l\'étudiant ne permet pas l\'inscription. Paiement en attente ou inactif.' }, { status: 402 });
    }

    // Si la validation réussit
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
