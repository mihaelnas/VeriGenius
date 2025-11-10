
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
    let db: admin.firestore.Firestore | null = null;

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

        const { studentId, firstName, lastName } = validation.data;

        // STEP 3: Initialize Firebase Admin and get DB
        const app = getFirebaseAdminApp();
        db = app.firestore();

        // STEP 4: Query Firestore for the student
        // WORKAROUND: Instead of 'where', fetch the entire collection and filter in-memory.
        const studentsCollection = await db.collection('students').get();

        if (studentsCollection.empty) {
            statusCode = 404;
            responsePayload = { success: false, message: "Aucun étudiant trouvé dans la base de données." };
            isSuccess = false;
            // The finally block will handle logging
            return NextResponse.json(responsePayload, { status: statusCode });
        }
        
        // Find the student document in the results
        const studentDoc = studentsCollection.docs.find(doc => doc.data().studentId === studentId);

        if (!studentDoc) {
            statusCode = 404;
            responsePayload = { success: false, message: "Étudiant non trouvé." };
            isSuccess = false;
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        const studentData = studentDoc.data();

        // STEP 5: Compare data
        const isFirstNameMatch = studentData.firstName.toLowerCase() === firstName.toLowerCase();
        const isLastNameMatch = studentData.lastName.toUpperCase() === lastName.toUpperCase();
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
            studentData: {
                firstName: studentData.firstName,
                lastName: studentData.lastName,
                studentId: studentData.studentId,
                level: studentData.level,
                fieldOfStudy: studentData.fieldOfStudy,
                classId: studentData.classId
            }
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
        if (db) {
            const logEntry = {
                timestamp: new Date().toISOString(),
                requestBody,
                responseBody: responsePayload,
                statusCode,
                isSuccess,
                clientIp,
            };
            // Do not await, let it run in the background
            logApiRequest(db, logEntry);
        }
    }
}
