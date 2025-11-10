
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema, type Student } from '@/lib/verigenius-types';
import { initializeApp, getApps, getApp, deleteApp, FirebaseOptions } from 'firebase/app';
import { getFirestore as getClientFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import * as admin from 'firebase-admin';

// --- Configuration Firebase Client ---
const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- Fonctions d'initialisation ---
function initializeAdminApp() {
    const appName = 'admin-app-for-logging';
    if (admin.apps.find(app => app?.name === appName)) {
        return admin.app(appName);
    }
    
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        console.error("Firebase Admin SDK environment variables are not set for logging.");
        return null;
    }
    
    try {
        return admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        }, appName);
    } catch (error) {
        console.error("Failed to initialize Firebase Admin App:", error);
        return null;
    }
}

function initializeClientApp() {
    const appName = 'client-app-for-reading';
    if (getApps().some(app => app.name === appName)) {
        return getApp(appName);
    }
    try {
        return initializeApp(firebaseConfig, appName);
    } catch (error) {
        console.error("Failed to initialize Firebase Client App:", error);
        return null;
    }
}

// --- Fonction de Journalisation ---
async function writeLog(adminApp: admin.app.App | null, logData: any) {
    if (!adminApp) {
        console.error("Admin app not initialized. Cannot write log.");
        return;
    }
    try {
        await adminApp.firestore().collection('request-logs').add(logData);
    } catch (logError) {
        console.error("CRITICAL: Failed to write log to Firestore:", logError);
    }
}

// --- Logique de l'API ---
export async function POST(request: NextRequest) {
    let requestBody: any;
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    let responsePayload: object = {};
    let statusCode: number = 500;
    let isSuccess = false;
    const timestamp = new Date().toISOString();

    const adminApp = initializeAdminApp();
    const clientApp = initializeClientApp();

    if (!clientApp) {
         return NextResponse.json({ success: false, message: "Internal Server Error: Client Firebase App failed to initialize." }, { status: 500 });
    }

    try {
        try {
            requestBody = await request.json();
        } catch (jsonError) {
            statusCode = 400;
            responsePayload = { success: false, message: "Invalid JSON body." };
            await writeLog(adminApp, { timestamp, requestBody: requestBody || {}, responseBody: responsePayload, statusCode, isSuccess, clientIp });
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            statusCode = 400;
            responsePayload = { success: false, message: "Invalid validation data.", errors: validation.error.flatten() };
            await writeLog(adminApp, { timestamp, requestBody, responseBody: responsePayload, statusCode, isSuccess, clientIp });
            return NextResponse.json(responsePayload, { status: statusCode });
        }
        const { studentId, firstName, lastName } = validation.data;

        // Requête Firestore avec le SDK CLIENT
        const clientDb = getClientFirestore(clientApp);
        const studentsRef = collection(clientDb, "students");
        const q = query(studentsRef, where("studentId", "==", studentId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            statusCode = 404;
            responsePayload = { success: false, message: `Validation failed: Student with matricule '${studentId}' not found.` };
            await writeLog(adminApp, { timestamp, requestBody, responseBody: responsePayload, statusCode, isSuccess, clientIp });
            return NextResponse.json(responsePayload, { status: statusCode });
        }
        const studentDoc = querySnapshot.docs[0];
        const studentData = studentDoc.data() as Student;

        const isFirstNameMatch = studentData.firstName.toLowerCase() === firstName.toLowerCase();
        const isLastNameMatch = studentData.lastName.toUpperCase() === lastName.toUpperCase();

        if (!isFirstNameMatch || !isLastNameMatch) {
            statusCode = 401;
            responsePayload = { success: false, message: "Validation failed: First name or last name does not match." };
            await writeLog(adminApp, { timestamp, requestBody, responseBody: responsePayload, statusCode, isSuccess, clientIp });
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        if (studentData.status === 'inactive') {
            statusCode = 403;
            responsePayload = { success: false, message: "Validation failed: Student account is inactive." };
            await writeLog(adminApp, { timestamp, requestBody, responseBody: responsePayload, statusCode, isSuccess, clientIp });
            return NextResponse.json(responsePayload, { status: statusCode });
        }
        
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

        await writeLog(adminApp, { timestamp, requestBody, responseBody: responsePayload, statusCode, isSuccess, clientIp });
        return NextResponse.json(responsePayload, { status: statusCode });

    } catch (error: any) {
        console.error("Internal API Error:", error);
        statusCode = 500;
        responsePayload = { success: false, message: "Internal server error.", error: error.message };
        // Tenter de journaliser même en cas d'erreur interne
        await writeLog(adminApp, { timestamp, requestBody: requestBody || {}, responseBody: responsePayload, statusCode, isSuccess, clientIp });
        return NextResponse.json(responsePayload, { status: statusCode });
    }
}
