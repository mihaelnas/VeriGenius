
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema } from '@/lib/verigenius-types';
import admin from 'firebase-admin';

// Helper to prevent re-initialization
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

// Helper for logging
async function logApiRequest(db: admin.firestore.Firestore, logEntry: object) {
    try {
        await db.collection('request-logs').add(logEntry);
    } catch (logError) {
        // This will be visible in Vercel logs if logging itself fails
        console.error("Échec de la journalisation de la requête API:", logError);
    }
}

export async function POST(request: NextRequest) {
    let requestBody: any = {};
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'inconnu';
    let responsePayload: object = {};
    let statusCode: number = 500;
    let isSuccess = false;

    const db = getFirebaseAdminApp().firestore();

    try {
        // STEP 0: Parse request body
        try {
            requestBody = await request.json();
        } catch (jsonError) {
            statusCode = 400;
            responsePayload = { success: false, message: "Le corps de la requête est invalide ou n'est pas du JSON." };
            isSuccess = false;
            return NextResponse.json(responsePayload, { status: statusCode });
        }
        
        // STEP 1: Validate incoming data
        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            statusCode = 400;
            responsePayload = { success: false, message: "Données de validation invalides.", errors: validation.error.flatten() };
            isSuccess = false;
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        const { studentId, firstName, lastName } = validation.data;

        // STEP 2: Query Firestore for the student
        const studentQuery = db.collection('students').where('studentId', '==', studentId);
        const querySnapshot = await studentQuery.get();

        if (querySnapshot.empty) {
            statusCode = 404;
            responsePayload = { success: false, message: "Étudiant non trouvé." };
            isSuccess = false;
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        // Assume studentId is unique, so we take the first result
        const studentDoc = querySnapshot.docs[0];
        const studentData = studentDoc.data();

        // STEP 3: Compare data
        const isFirstNameMatch = studentData.firstName.toLowerCase() === firstName.toLowerCase();
        const isLastNameMatch = studentData.lastName.toLowerCase() === lastName.toLowerCase();
        const isStudentActive = studentData.status === 'fully_paid' || studentData.status === 'partially_paid';

        if (!isFirstNameMatch || !isLastNameMatch) {
            statusCode = 403;
            responsePayload = { success: false, message: "Le nom ou prénom ne correspond pas." };
            isSuccess = false;
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        if (!isStudentActive) {
            statusCode = 402;
            responsePayload = { success: false, message: `Statut de l'étudiant invalide: ${studentData.status}` };
            isSuccess = false;
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        // SUCCESS
        statusCode = 200;
        responsePayload = {
            success: true,
            message: "La validité de l'étudiant a été confirmée.",
            classId: studentData.classId
        };
        isSuccess = true;
        return NextResponse.json(responsePayload, { status: statusCode });

    } catch (error: any) {
        console.error("Erreur interne majeure dans l'API:", error);
        statusCode = 500;
        responsePayload = { success: false, message: "Erreur interne du serveur.", error: error.message };
        isSuccess = false;
        return NextResponse.json(responsePayload, { status: statusCode });
    } finally {
        // This will always run, ensuring we log every request that reaches the API handler
        const logEntry = {
            timestamp: new Date().toISOString(),
            requestBody,
            responseBody: responsePayload,
            statusCode,
            isSuccess,
            clientIp,
        };
        await logApiRequest(db, logEntry);
    }
}
