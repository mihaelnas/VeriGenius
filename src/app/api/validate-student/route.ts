
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/firebase/admin';
import { studentValidationSchema } from '@/lib/verigenius-types';
import type { Student } from '@/lib/verigenius-types';

export const dynamic = 'force-dynamic';

async function logApiRequest(requestBody: any, responseBody: any, statusCode: number, clientIp: string | null) {
    if (!adminDb) {
      console.error("Tentative de log, mais adminDb n'est pas initialisé.");
      return;
    };

    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            requestBody,
            responseBody,
            statusCode,
            isSuccess: statusCode === 200,
            clientIp: clientIp || 'Unknown',
        };
        await adminDb.collection('request-logs').add(logEntry);
    } catch (error) {
        console.error("Erreur lors de la journalisation de la requête API:", error);
    }
}

export async function POST(request: NextRequest) {
    const clientIp = request.ip;
    let requestBody: any;

    if (!adminDb) {
        const response = { success: false, message: "Erreur critique du serveur: La base de données n'est pas initialisée." };
        // Le log échouera probablement aussi, mais on tente quand même
        await logApiRequest({}, response, 500, clientIp);
        return NextResponse.json(response, { status: 500 });
    }

    try {
        requestBody = await request.json();
    } catch (error) {
        const response = { success: false, message: "Le corps de la requête est invalide ou n'est pas du JSON." };
        await logApiRequest({}, response, 400, clientIp);
        return NextResponse.json(response, { status: 400 });
    }

    const validation = studentValidationSchema.safeParse(requestBody);

    if (!validation.success) {
        const response = { success: false, message: "Données de validation invalides.", errors: validation.error.flatten() };
        await logApiRequest(requestBody, response, 400, clientIp);
        return NextResponse.json(response, { status: 400 });
    }

    const { studentId, firstName, lastName } = validation.data;

    try {
        const studentsRef = adminDb.collection('students');
        const querySnapshot = await studentsRef
            .where('studentId', '==', studentId)
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            const response = { success: false, message: "Validation échouée: Étudiant non trouvé." };
            await logApiRequest(requestBody, response, 404, clientIp);
            return NextResponse.json(response, { status: 404 });
        }

        const studentDoc = querySnapshot.docs[0];
        const studentData = studentDoc.data() as Student;

        const isNameMatch = studentData.firstName.toLowerCase() === firstName.toLowerCase() &&
                            studentData.lastName.toLowerCase() === lastName.toLowerCase();

        if (!isNameMatch) {
            const response = { success: false, message: "Validation échouée: Le nom ne correspond pas." };
            await logApiRequest(requestBody, response, 403, clientIp);
            return NextResponse.json(response, { status: 403 });
        }
        
        if (studentData.status !== 'fully_paid' && studentData.status !== 'partially_paid') {
            const response = { success: false, message: "Validation échouée: Le statut de l'étudiant n'est pas valide pour l'accès.", status: studentData.status };
            await logApiRequest(requestBody, response, 403, clientIp);
            return NextResponse.json(response, { status: 403 });
        }

        const response = { success: true, message: "Validation réussie.", classId: studentData.classId };
        await logApiRequest(requestBody, response, 200, clientIp);
        return NextResponse.json(response, { status: 200 });

    } catch (error: any) {
        console.error("Erreur serveur lors de la validation:", error);
        const response = { success: false, message: "Erreur interne du serveur." };
        await logApiRequest(requestBody, response, 500, clientIp);
        return NextResponse.json(response, { status: 500 });
    }
}
