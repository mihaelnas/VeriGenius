
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/firebase/admin';

// Force la route à être dynamique pour s'assurer qu'elle est exécutée côté serveur à chaque appel
export const dynamic = 'force-dynamic';

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

async function logApiRequest(db: import('firebase-admin').firestore.Firestore, request: NextRequest, requestBody: any, responseBody: any, statusCode: number) {
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
        console.log('API request logged successfully.');
    } catch (logError) {
        console.error("Échec de l'écriture du log API :", logError);
    }
}


export async function POST(request: NextRequest) {
  console.log('Requête POST reçue sur /api/validate-student');
  let responseBody;
  let statusCode;
  let requestBody;

  // S'assurer que la base de données est prête avant de continuer
  if (!adminDb) {
    console.error("Erreur critique: adminDb n'est pas initialisé. Vérifiez la configuration du SDK Admin.");
    statusCode = 500;
    responseBody = { error: 'Erreur de configuration du serveur: Connexion à la base de données a échoué.' };
    return NextResponse.json(responseBody, { status: statusCode });
  }

  try {
    requestBody = await request.json();
    console.log('Corps de la requête:', requestBody);
  } catch (e) {
      statusCode = 400;
      responseBody = { error: 'Corps de la requête invalide, doit être du JSON.' };
      console.log('Réponse envoyée (400):', responseBody);
      await logApiRequest(adminDb, request, {error: "Invalid JSON body"}, responseBody, statusCode);
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
    await logApiRequest(adminDb, request, requestBody, responseBody, statusCode);
    return NextResponse.json(responseBody, { status: statusCode });
  }
}
