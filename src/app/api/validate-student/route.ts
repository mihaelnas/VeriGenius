
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema, type Student } from '@/lib/verigenius-types';
import { initializeApp, getApps, getApp, deleteApp, FirebaseOptions } from 'firebase/app';
import { getFirestore as getClientFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import * as admin from 'firebase-admin';

// --- Configuration Firebase ---
const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- Initialisation du SDK Admin ---
// Pour l'écriture sécurisée des logs
function initializeAdminApp() {
    const appName = `firebase-admin-app:${Date.now()}`;
    if (admin.apps.some(app => app?.name === appName)) {
        return admin.app(appName);
    }
    
    // Vérification que les variables d'environnement sont bien présentes
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error("Firebase Admin SDK environment variables are not set.");
    }
    
    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    }, appName);
}


// --- Initialisation du SDK Client ---
// Pour la lecture des données étudiant
function initializeClientApp() {
    const appName = `firebase-client-app:${Date.now()}`;
    if (getApps().some(app => app.name === appName)) {
        return getApp(appName);
    }
    return initializeApp(firebaseConfig, appName);
}

// --- Logique de l'API ---
export async function POST(request: NextRequest) {
    let requestBody: any;
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'inconnu';
    let responsePayload: object = {};
    let statusCode: number = 500;
    let isSuccess = false;

    const timestamp = new Date().toISOString();

    const clientApp = initializeClientApp();
    const clientDb = getClientFirestore(clientApp);
    
    let adminApp: admin.app.App | null = null;
    try {
        adminApp = initializeAdminApp();
        const adminDb = adminApp.firestore();

        // 1. Validation de la requête
        try {
            requestBody = await request.json();
        } catch (jsonError) {
            statusCode = 400;
            responsePayload = { success: false, message: "Invalid JSON body." };
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            statusCode = 400;
            responsePayload = { success: false, message: "Invalid validation data.", errors: validation.error.flatten() };
            return NextResponse.json(responsePayload, { status: statusCode });
        }
        const { studentId, firstName, lastName } = validation.data;

        // 2. Requête Firestore avec le SDK CLIENT (pour la lecture)
        const studentsRef = collection(clientDb, "students");
        const q = query(studentsRef, where("studentId", "==", studentId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            statusCode = 404;
            responsePayload = { success: false, message: `Validation failed: Student with matricule '${studentId}' not found.` };
            return NextResponse.json(responsePayload, { status: statusCode });
        }
        const studentDoc = querySnapshot.docs[0];
        const studentData = studentDoc.data() as Student;

        // 3. Logique de comparaison
        const isFirstNameMatch = studentData.firstName.toLowerCase() === firstName.toLowerCase();
        const isLastNameMatch = studentData.lastName.toUpperCase() === lastName.toUpperCase();

        if (!isFirstNameMatch || !isLastNameMatch) {
            statusCode = 401;
            responsePayload = { success: false, message: "Validation failed: First name or last name does not match." };
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        if (studentData.status === 'inactive') {
            statusCode = 403;
            responsePayload = { success: false, message: "Validation failed: Student account is inactive." };
            return NextResponse.json(responsePayload, { status: statusCode });
        }
        
        // 4. Succès
        statusCode = 200;
        isSuccess = true;
        responsePayload = {
            success: true,
            message: "Validation successful.",
            student: {
                firstName: studentData.firstName,
                lastName: studentData.lastName,
                studentId: studentData.studentId,
                fieldOfStudy: studentData.fieldOfStudy,
                level: studentData.level,
                status: studentData.status
            }
        };

        return NextResponse.json(responsePayload, { status: statusCode });

    } catch (error: any) {
        console.error("Internal API Error:", error);
        statusCode = 500;
        responsePayload = { success: false, message: "Internal server error.", error: error.message };
        return NextResponse.json(responsePayload, { status: statusCode });

    } finally {
        // 5. Journalisation avec le SDK ADMIN (pour l'écriture)
        if (adminApp) {
             try {
                await adminApp.firestore().collection('request-logs').add({
                    timestamp,
                    requestBody: requestBody || {},
                    responseBody: responsePayload,
                    statusCode,
                    isSuccess,
                    clientIp,
                });
             } catch (logError) {
                console.error("Failed to write to log:", logError);
             }
             // Nettoyage de l'app admin
             await adminApp.delete();
        }
        // Nettoyage de l'app client
        await deleteApp(clientApp);
    }
}
