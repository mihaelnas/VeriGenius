
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
        const adminApp = getFirebaseAdminApp();
        const db = adminApp.firestore();

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
        
        const studentsRef = db.collection('students');
        const snapshot = await studentsRef.where('studentId', '==', studentId).limit(1).get();

        if (snapshot.empty) {
            statusCode = 404;
            responsePayload = { success: false, message: "Aucun étudiant trouvé avec ce matricule." };
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        const studentDoc = snapshot.docs[0];
        const studentData = studentDoc.data();

        const isFirstNameMatch = studentData.firstName.toLowerCase() === firstName.toLowerCase();
        const isLastNameMatch = studentData.lastName.toLowerCase() === lastName.toLowerCase();

        if (isFirstNameMatch && isLastNameMatch) {
             if (studentData.status === 'inactive') {
                statusCode = 403;
                responsePayload = { success: false, message: "Le compte de l'étudiant est inactif." };
            } else {
                statusCode = 200;
                responsePayload = {
                    success: true,
                    message: "La validité de l'étudiant a été confirmée.",
                    classId: studentData.classId
                };
            }
        } else {
            statusCode = 403;
            responsePayload = { success: false, message: "Le nom ou le prénom ne correspond pas au matricule." };
        }
        
        return NextResponse.json(responsePayload, { status: statusCode });

    } catch (error: any) {
        console.error("Erreur interne majeure dans l'API:", error);
        statusCode = 500;
        responsePayload = { success: false, message: "Erreur interne du serveur.", error: error.message };
        return NextResponse.json(responsePayload, { status: statusCode });
    } finally {
        // Log the request regardless of outcome
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                requestBody,
                responseBody: responsePayload,
                statusCode,
                isSuccess: statusCode >= 200 && statusCode < 300,
                clientIp,
            };
            // We don't await this to avoid slowing down the response
            getFirebaseAdminApp().firestore().collection('request-logs').add(logEntry);
        } catch (logError) {
            console.error("Échec de la journalisation de la requête API:", logError);
        }
    }
}
