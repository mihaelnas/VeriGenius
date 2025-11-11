
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema, type Student } from '@/lib/verigenius-types';
import { adminDb } from '@/firebase/admin';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase client app if not already initialized
if (!getApps().length) {
    initializeApp(firebaseConfig);
}
const db = getFirestore();


// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function logRequest(request: NextRequest, responseBody: object, statusCode: number) {
    try {
        const requestBody = await request.json().catch(() => ({}));
        const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

        await adminDb.collection('request-logs').add({
            timestamp: new Date().toISOString(),
            clientIp,
            requestBody,
            responseBody,
            statusCode,
            isSuccess: statusCode === 200,
        });
    } catch (logError) {
        console.error("Failed to write to request-logs:", logError);
    }
}


export async function OPTIONS(request: NextRequest) {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
    let responseBody: object;
    let statusCode: number;

    try {
        const requestBody = await request.clone().json();

        // 1. Validation des données d'entrée avec Zod
        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            statusCode = 400;
            responseBody = { 
                success: false, 
                message: "Invalid validation data.", 
                errors: validation.error.flatten() 
            };
            await logRequest(request, responseBody, statusCode);
            return NextResponse.json(responseBody, { status: statusCode, headers: corsHeaders });
        }

        const { studentId, firstName, lastName } = validation.data;

        // 2. Exécution de la requête avec le SDK Client
        const studentsRef = collection(db, 'students');
        const q = query(studentsRef, where('studentId', '==', studentId.toUpperCase()), limit(1));
        const querySnapshot = await getDocs(q);

        // 3. Traitement des résultats
        if (querySnapshot.empty) {
            statusCode = 404;
            responseBody = {
                success: false,
                message: `Student with ID '${studentId}' not found.`,
            };
            await logRequest(request, responseBody, statusCode);
            return NextResponse.json(responseBody, { status: statusCode, headers: corsHeaders });
        }

        const studentDoc = querySnapshot.docs[0];
        const studentData = studentDoc.data() as Omit<Student, 'id'>;

        // 4. Comparaison stricte et insensible à la casse
        if (
            studentData.studentId.toLowerCase() !== studentId.toLowerCase() ||
            studentData.firstName.toLowerCase() !== firstName.toLowerCase() || 
            studentData.lastName.toLowerCase() !== lastName.toLowerCase()
        ) {
            statusCode = 403;
            responseBody = {
                success: false,
                message: "Student ID, first name, or last name does not match.",
            };
            await logRequest(request, responseBody, statusCode);
            return NextResponse.json(responseBody, { status: statusCode, headers: corsHeaders });
        }
        
        // 5. Vérification du statut de l'étudiant
        if (studentData.status === 'inactive') {
             statusCode = 403;
             responseBody = {
                success: false,
                message: "Student account is inactive.",
            };
            await logRequest(request, responseBody, statusCode);
            return NextResponse.json(responseBody, { status: statusCode, headers: corsHeaders });
        }

        // 6. Si tout est correct, renvoyer la charge utile de succès
        const responsePayload = {
            firstName: studentData.firstName,
            lastName: studentData.lastName,
            studentId: studentData.studentId,
            fieldOfStudy: studentData.fieldOfStudy,
            level: studentData.level,
            status: studentData.status,
            classId: studentData.classId
        };
        
        statusCode = 200;
        responseBody = {
            success: true,
            message: "Validation successful.",
            student: responsePayload
        };
        await logRequest(request, responseBody, statusCode);
        return NextResponse.json(responseBody, { status: statusCode, headers: corsHeaders });

    } catch (error: any) {
        console.error("Internal API Error:", error);
        statusCode = 500;
        responseBody = { 
            success: false, 
            message: "Internal server error.", 
            error: error.message 
        };
        // Can't log request body if it fails to parse, so we log the error message
        await logRequest(request, { error: 'Failed to parse request or internal error', details: error.message }, statusCode);
        return NextResponse.json(responseBody, { status: statusCode, headers: corsHeaders });
    }
}
