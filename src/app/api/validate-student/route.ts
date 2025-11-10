
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema } from '@/lib/verigenius-types';
import admin from 'firebase-admin';

// Helper function to get the initialized app, or initialize it if it doesn't exist.
// This helps prevent re-initialization on every request in a serverless environment.
function getFirebaseAdminApp() {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
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


export async function POST(request: NextRequest) {
    let requestBody: any = {};
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'inconnu';
    let responsePayload: object = {};
    let statusCode: number = 500;

    try {
        // STEP 0: Parse request body
        try {
            requestBody = await request.json();
        } catch (jsonError) {
            statusCode = 400;
            responsePayload = { success: false, message: "Le corps de la requête est invalide ou n'est pas du JSON." };
            return NextResponse.json(responsePayload, { status: statusCode });
        }
        
        // STEP 1: Validate incoming data (already confirmed working)
        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            statusCode = 400;
            responsePayload = { success: false, message: "Données de validation invalides.", errors: validation.error.flatten() };
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        // STEP 2: Initialize Firebase Admin SDK (already confirmed working)
        const adminApp = getFirebaseAdminApp();
        const db = adminApp.firestore();
        
        // STEP 3.1: Try to WRITE to firestore (logging) but do not read student data
        statusCode = 200;
        responsePayload = { success: true, message: "DEBUG Step 3.1: Firestore write (logging) attempted." };
        
        // We will attempt to log, but not await it to not slow down the debug response
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                requestBody,
                responseBody: responsePayload,
                statusCode,
                isSuccess: true,
                clientIp,
                debugStep: "3.1"
            };
            db.collection('request-logs').add(logEntry);
        } catch (logError: any) {
            // If logging fails, we modify the response to indicate that.
            responsePayload = { success: false, message: "DEBUG Step 3.1: Firestore write (logging) FAILED.", error: logError.message };
            statusCode = 500;
        }

        return NextResponse.json(responsePayload, { status: statusCode });

    } catch (error: any) {
        console.error("Erreur interne majeure dans l'API:", error);
        statusCode = 500;
        responsePayload = { success: false, message: "Erreur interne du serveur.", error: error.message };
        return NextResponse.json(responsePayload, { status: statusCode });
    }
}
