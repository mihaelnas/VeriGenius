
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { studentValidationSchema } from '@/lib/verigenius-types';
import type { Student } from '@/lib/verigenius-types';

// Fonction de journalisation séparée
async function logApiRequest(db: admin.firestore.Firestore, requestBody: any, responseBody: any, statusCode: number, clientIp: string | null) {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            requestBody,
            responseBody,
            statusCode,
            isSuccess: statusCode === 200,
            clientIp: clientIp || 'Unknown',
        };
        await db.collection('request-logs').add(logEntry);
    } catch (error) {
        console.error("Erreur critique lors de la journalisation de la requête API:", error);
        // Ne pas propager l'erreur de journalisation pour ne pas masquer l'erreur originale
    }
}

export async function POST(request: NextRequest) {
    const clientIp = request.ip;
    let requestBody: any = {};
    let db: admin.firestore.Firestore;

    try {
        // --- DEBUT DE LA LOGIQUE D'INITIALISATION INTEGREE ---
        if (admin.apps.length > 0) {
            db = admin.firestore();
        } else {
            const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
            if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
                throw new Error("Variables d'environnement Firebase manquantes.");
            }
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: FIREBASE_PROJECT_ID,
                    clientEmail: FIREBASE_CLIENT_EMAIL,
                    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
            db = admin.firestore();
        }
        // --- FIN DE LA LOGIQUE D'INITIALISATION ---

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

        const studentsRef = db.collection('students');
        const snapshot = await studentsRef.where('studentId', '==', studentId).limit(1).get();

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
        
        // TENTATIVE DE LOGGING DE LA DERNIERE CHANCE
        // Si db est initialisé, on l'utilise. Sinon, on ne peut pas logger.
        if (admin.apps.length > 0) {
            try {
                await logApiRequest(admin.firestore(), requestBody, errorResponse, 500, clientIp);
            } catch (logError) {
                console.error("Impossible de logger l'erreur finale:", logError);
            }
        }
        
        return NextResponse.json(errorResponse, { status: 500 });
    }
}
