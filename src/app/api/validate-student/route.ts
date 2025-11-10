
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema } from '@/lib/verigenius-types';
import admin from 'firebase-admin';

// Helper function to safely initialize the admin app
function initializeAdminApp() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Replace the escaped newline characters from the environment variable
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error("Les variables d'environnement Firebase ne sont pas toutes définies.");
    }
    
    // Use a unique name for the app instance to avoid conflicts
    const appName = `firebase-admin-app-${Date.now()}-${Math.random()}`;

    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    }, appName);
}

export async function POST(request: NextRequest) {
    let requestBody: any = {};
    let clientIp = request.ip || request.headers.get('x-forwarded-for') || 'inconnu';

    try {
        try {
            requestBody = await request.json();
        } catch (jsonError) {
            const response = { success: false, message: "Le corps de la requête est invalide ou n'est pas du JSON." };
            return NextResponse.json(response, { status: 400 });
        }

        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            const response = { success: false, message: "Données de validation invalides.", errors: validation.error.flatten() };
            return NextResponse.json(response, { status: 400 });
        }
        
        // --- STEP 2: Initialize Firebase Admin SDK ---
        const adminApp = initializeAdminApp();
        
        // If we get here, initialization was successful. Delete the app to clean up.
        await adminApp.delete();

        const successResponse = {
            success: true,
            message: "DEBUG Step 2: Firebase Admin SDK initialized successfully."
        };

        return NextResponse.json(successResponse, { status: 200 });

    } catch (error: any) {
        console.error("Erreur interne majeure dans l'API (Étape 2):", error);
        const errorResponse = { success: false, message: "Erreur interne du serveur lors de l'initialisation (Étape 2).", error: error.message };
        
        return NextResponse.json(errorResponse, { status: 500 });
    }
}
