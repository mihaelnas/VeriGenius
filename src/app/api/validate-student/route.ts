
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema } from '@/lib/verigenius-types';
import admin from 'firebase-admin';

// Helper to prevent re-initialization in some environments
function getFirebaseAdminApp() {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Vercel automatically handles the newlines, but we replace \\n just in case
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        // This error should now be caught and logged properly
        throw new Error("Les variables d'environnement Firebase ne sont pas toutes définies.");
    }

    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });
}

// Helper for logging
async function logApiRequest(db: admin.firestore.Firestore, logEntry: object) {
    try {
        await db.collection('request-logs').add(logEntry);
    } catch (logError) {
        console.error("Échec de la journalisation de la requête API:", logError);
    }
}

export async function POST(request: NextRequest) {
    let requestBody: any = {};
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'inconnu';
    let responsePayload: object = {};
    let statusCode: number = 500;
    let isSuccess = false;

    try {
        // STEP 1: Parse request body
        try {
            requestBody = await request.json();
        } catch (jsonError) {
            statusCode = 400;
            responsePayload = { success: false, message: "Le corps de la requête est invalide ou n'est pas du JSON." };
            return NextResponse.json(responsePayload, { status: statusCode });
        }
        
        // STEP 2: Validate incoming data
        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            statusCode = 400;
            responsePayload = { success: false, message: "Données de validation invalides.", errors: validation.error.flatten() };
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        // DEBUG STEP 1 SUCCESS
        statusCode = 200;
        isSuccess = true;
        responsePayload = { success: true, message: "DEBUG Step 1: Validation successful. No Firebase interaction." };
        return NextResponse.json(responsePayload, { status: statusCode });

    } catch (error: any) {
        console.error("Erreur interne majeure dans l'API:", error);
        statusCode = 500;
        responsePayload = { success: false, message: "Erreur interne du serveur.", error: error.message };
        isSuccess = false;
        // The finally block will not run in this simple version, returning directly.
        return NextResponse.json(responsePayload, { status: statusCode });
    }
}
