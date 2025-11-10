
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc, Firestore } from 'firebase/firestore';
import { studentValidationSchema } from '@/lib/verigenius-types';
import type { Student } from '@/lib/verigenius-types';

// Mise en cache de l'instance de l'application et de Firestore en dehors de la fonction de requête
let app: FirebaseApp | undefined;
let db: Firestore | undefined;

async function initializeFirebaseAndGetDB() {
    // Si l'application et la DB sont déjà initialisées, les retourner immédiatement
    if (app && db) {
        return db;
    }

    const appName = 'firebase-server-instance';
    // Vérifier si une application avec ce nom existe déjà
    if (getApps().some(existingApp => existingApp.name === appName)) {
        app = getApp(appName);
    } else {
        const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

        if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
            throw new Error("Variables d'environnement Firebase pour le serveur manquantes.");
        }

        const firebaseConfig = {
            projectId: FIREBASE_PROJECT_ID,
            authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
            apiKey: "dummy-key-for-server-init"
        };
        app = initializeApp(firebaseConfig, appName);
    }

    db = getFirestore(app);
    return db;
}


async function logApiRequest(db: Firestore, requestBody: any, responseBody: any, statusCode: number, clientIp: string | null) {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            requestBody,
            responseBody,
            statusCode,
            isSuccess: statusCode === 200,
            clientIp: clientIp || 'Unknown',
        };
        await addDoc(collection(db, 'request-logs'), logEntry);
    } catch (error) {
        console.error("Erreur critique lors de la journalisation de la requête API:", error);
    }
}

export async function POST(request: NextRequest) {
    const clientIp = request.ip;
    let requestBody: any = {};
    let localDb: Firestore;

    try {
        localDb = await initializeFirebaseAndGetDB();

        try {
            requestBody = await request.json();
        } catch (jsonError) {
            const response = { success: false, message: "Le corps de la requête est invalide ou n'est pas du JSON." };
            await logApiRequest(localDb, {error: "Invalid JSON body"}, response, 400, clientIp);
            return NextResponse.json(response, { status: 400 });
        }

        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            const response = { success: false, message: "Données de validation invalides.", errors: validation.error.flatten() };
            await logApiRequest(localDb, requestBody, response, 400, clientIp);
            return NextResponse.json(response, { status: 400 });
        }
        
        const { studentId, firstName, lastName } = validation.data;

        const studentsRef = collection(localDb, 'students');
        const q = query(studentsRef, where('studentId', '==', studentId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            const response = { success: false, message: "Aucun étudiant trouvé avec ce matricule." };
            await logApiRequest(localDb, requestBody, response, 404, clientIp);
            return NextResponse.json(response, { status: 404 });
        }

        const studentDoc = snapshot.docs[0];
        const studentFromDB = { id: studentDoc.id, ...studentDoc.data() } as Student;

        const isFirstNameMatch = studentFromDB.firstName.toLowerCase() === firstName.toLowerCase();
        const isLastNameMatch = studentFromDB.lastName.toLowerCase() === lastName.toLowerCase();

        if (!isFirstNameMatch || !isLastNameMatch) {
            const response = { success: false, message: "Le nom ou le prénom ne correspond pas." };
            await logApiRequest(localDb, requestBody, response, 403, clientIp);
            return NextResponse.json(response, { status: 403 });
        }
        
        if (studentFromDB.status !== 'fully_paid' && studentFromDB.status !== 'partially_paid') {
            const response = { 
                success: false, 
                message: "Le statut de paiement de l'étudiant ne permet pas la validation.",
                status: studentFromDB.status
            };
            await logApiRequest(localDb, requestBody, response, 403, clientIp);
            return NextResponse.json(response, { status: 403 });
        }

        const successResponse = {
            success: true,
            message: "La validité de l'étudiant a été confirmée.",
            student: {
                studentId: studentFromDB.studentId,
                firstName: studentFromDB.firstName,
                lastName: studentFromDB.lastName,
                level: studentFromDB.level,
                fieldOfStudy: studentFromDB.fieldOfStudy,
                status: studentFromDB.status,
                classId: studentFromDB.classId
            }
        };

        await logApiRequest(localDb, requestBody, successResponse, 200, clientIp);
        return NextResponse.json(successResponse, { status: 200 });

    } catch (error: any) {
        console.error("Erreur interne majeure dans l'API:", error);
        const errorResponse = { success: false, message: "Erreur interne du serveur lors de la validation.", error: error.message };
        
        // Si la DB a pu être initialisée, on tente de logger.
        // `db` est la variable globale mise en cache.
        if (db) {
            await logApiRequest(db, requestBody, errorResponse, 500, clientIp);
        }
        
        return NextResponse.json(errorResponse, { status: 500 });
    }
}
