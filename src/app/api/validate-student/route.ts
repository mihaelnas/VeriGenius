
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema } from '@/lib/verigenius-types';
import admin from 'firebase-admin';
import { z } from 'zod';

// Helper to prevent re-initialization in some environments
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
    let requestBody: any;
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'inconnu';
    let responsePayload: object = {};
    let statusCode: number = 500;
    let isSuccess = false;

    const timestamp = new Date().toISOString();

    try {
        // STEP 1: Parse and Validate Request Body
        try {
            requestBody = await request.json();
        } catch (jsonError) {
            statusCode = 400;
            responsePayload = { success: false, message: "Le corps de la requête est invalide ou n'est pas du JSON." };
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            statusCode = 400;
            responsePayload = { success: false, message: "Données de validation invalides.", errors: validation.error.flatten() };
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        const { studentId, firstName, lastName } = validation.data;
        
        // STEP 2: Initialize Firebase Admin
        const adminApp = getFirebaseAdminApp();
        const db = admin.firestore(adminApp);
        
        // STEP 3.2a: Attempt a minimal read on the 'students' collection
        const studentsRef = db.collection('students');
        await studentsRef.limit(1).get();


        // If we reach here, the minimal read was successful
        statusCode = 200;
        isSuccess = true;
        responsePayload = { success: true, message: "DEBUG Step 3.2a: Simple read on 'students' collection attempted." };
        return NextResponse.json(responsePayload, { status: statusCode });

    } catch (error: any) {
        console.error("Erreur interne dans l'API:", error);
        statusCode = 500;
        responsePayload = { success: false, message: "Erreur interne du serveur.", error: error.message };
        isSuccess = false;

        // Attempt to log the failure if possible
        try {
            const db = admin.app().firestore();
            const logEntry = {
                timestamp,
                requestBody,
                responseBody: responsePayload,
                statusCode,
                isSuccess,
                clientIp,
                error: error.message || 'Unknown error during execution',
            };
            await db.collection('request-logs').add(logEntry);
        } catch (logError) {
            console.error("Échec de la journalisation de l'erreur:", logError);
        }
        
        return NextResponse.json(responsePayload, { status: statusCode });
    }
}
