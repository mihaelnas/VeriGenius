
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { studentValidationSchema } from '@/lib/verigenius-types';
import type { Student } from '@/lib/verigenius-types';

// Configuration de l'application Admin (utilisant le SDK client pour la compatibilité Vercel)
let adminApp: any;

async function initializeAdminApp() {
    const appName = 'firebase-admin-app';
    // Éviter la réinitialisation si l'application existe déjà
    if (getApps().some(app => app.name === appName)) {
        return getApp(appName);
    }

    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        throw new Error("Variables d'environnement Firebase pour l'admin manquantes.");
    }
    
    // Ceci est la configuration du SDK client, mais nous l'utilisons pour notre instance "admin"
    const firebaseConfig = {
        projectId: FIREBASE_PROJECT_ID,
        // Ces valeurs sont nécessaires pour que le SDK client fonctionne en mode serveur
        authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
        apiKey: "dummy-key" // Le SDK client a besoin d'une clé, même si nous ne l'utilisons pas pour l'auth serveur
    };

    adminApp = initializeApp(firebaseConfig, appName);
    return adminApp;
}

// Fonction de journalisation utilisant l'instance de DB fournie
async function logApiRequest(db: any, requestBody: any, responseBody: any, statusCode: number, clientIp: string | null) {
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
    let db: any;

    try {
        // --- INITIALISATION DU SDK CLIENT EN MODE SERVEUR ---
        const app = await initializeAdminApp();
        db = getFirestore(app);
        // --- FIN DE L'INITIALISATION ---

        try {
            requestBody = await request.json();
        } catch (jsonError) {
            const response = { success: false, message: "Le corps de la requête est invalide ou n'est pas du JSON." };
            await logApiRequest(db, {error: "Invalid JSON body"}, response, 400, clientIp);
            return NextResponse.json(response, { status: 400 });
        }

        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            const response = { success: false, message: "Données de validation invalides.", errors: validation.error.flatten() };
            await logApiRequest(db, requestBody, response, 400, clientIp);
            return NextResponse.json(response, { status: 400 });
        }
        
        const { studentId, firstName, lastName } = validation.data;

        const studentsRef = collection(db, 'students');
        const q = query(studentsRef, where('studentId', '==', studentId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            const response = { success: false, message: "Aucun étudiant trouvé avec ce matricule." };
            await logApiRequest(db, requestBody, response, 404, clientIp);
            return NextResponse.json(response, { status: 404 });
        }

        const studentDoc = snapshot.docs[0];
        const studentFromDB = { id: studentDoc.id, ...studentDoc.data() } as Student;

        const isFirstNameMatch = studentFromDB.firstName.toLowerCase() === firstName.toLowerCase();
        const isLastNameMatch = studentFromDB.lastName.toLowerCase() === lastName.toLowerCase();

        if (!isFirstNameMatch || !isLastNameMatch) {
            const response = { success: false, message: "Le nom ou le prénom ne correspond pas." };
            await logApiRequest(db, requestBody, response, 403, clientIp);
            return NextResponse.json(response, { status: 403 });
        }
        
        if (studentFromDB.status !== 'fully_paid' && studentFromDB.status !== 'partially_paid') {
            const response = { 
                success: false, 
                message: "Le statut de paiement de l'étudiant ne permet pas la validation.",
                status: studentFromDB.status
            };
            await logApiRequest(db, requestBody, response, 403, clientIp);
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

        await logApiRequest(db, requestBody, successResponse, 200, clientIp);
        return NextResponse.json(successResponse, { status: 200 });

    } catch (error: any) {
        console.error("Erreur interne majeure dans l'API:", error);
        const errorResponse = { success: false, message: "Erreur interne du serveur lors de la validation.", error: error.message };
        
        // Si db est initialisé, on peut tenter de logger.
        if (db) {
            await logApiRequest(db, requestBody, errorResponse, 500, clientIp);
        }
        
        return NextResponse.json(errorResponse, { status: 500 });
    }
}
