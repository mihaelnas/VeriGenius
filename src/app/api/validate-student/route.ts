
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import admin from 'firebase-admin';
import { studentValidationSchema } from '@/lib/verigenius-types';
import type { Student } from '@/lib/verigenius-types';

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

// Fonction de journalisation conservée, mais elle ne sera appelée que si on avance.
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
    
    // On ne va pas initialiser la DB pour l'instant pour ce test simple
    // let db: admin.firestore.Firestore;
    // try {
    //     db = initializeAdminApp();
    // } catch (error: any) {
    //     const response = { success: false, message: "Erreur critique du serveur: La base de données n'a pas pu être initialisée." };
    //     // Pas de log ici car db n'existe pas
    //     return NextResponse.json(response, { status: 500 });
    // }

    try {
        requestBody = await request.json();
    } catch (error) {
        const response = { success: false, message: "Le corps de la requête est invalide ou n'est pas du JSON." };
        // Pas de log ici car db n'existe pas
        return NextResponse.json(response, { status: 400 });
    }
    
    const validation = studentValidationSchema.safeParse(requestBody);
    if (!validation.success) {
        const response = { success: false, message: "Données de validation invalides.", errors: validation.error.flatten() };
        // Pas de log ici car db n'existe pas
        return NextResponse.json(response, { status: 400 });
    }
    
    // --- DÉBUT DE L'ÉTAPE 1 DU DÉBOGAGE ---
    // Si nous arrivons jusqu'ici, la validation des données est réussie.
    // Nous allons nous arrêter là et renvoyer une réponse de succès statique.
    
    const debugResponse = { success: true, message: "DEBUG: Les données sont valides et l'API n'a pas planté." };
    // On ne journalise pas car on ne veut pas dépendre de Firestore pour ce test.
    // await logApiRequest(db, requestBody, debugResponse, 200, clientIp);
    return NextResponse.json(debugResponse, { status: 200 });
    // --- FIN DE L'ÉTAPE 1 DU DÉBOGAGE ---
}
