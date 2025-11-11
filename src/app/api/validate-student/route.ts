
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema, type Student } from '@/lib/verigenius-types';
import { adminDb } from '@/firebase/admin';

// Headers pour la gestion du CORS, au cas où vous en auriez besoin pour un client web à l'avenir
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS(request: NextRequest) {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
    try {
        const requestBody = await request.json();

        // 1. Validation des données d'entrée avec Zod
        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            return NextResponse.json({ 
                success: false, 
                message: "Invalid validation data.", 
                errors: validation.error.flatten() 
            }, { status: 400, headers: corsHeaders });
        }

        const { studentId, firstName, lastName } = validation.data;

        // 2. Exécution de la requête avec le SDK Admin
        const studentsRef = adminDb.collection('students');
        const querySnapshot = await studentsRef.where('studentId', '==', studentId.toUpperCase()).limit(1).get();

        // 3. Traitement des résultats
        if (querySnapshot.empty) {
            return NextResponse.json({
                success: false,
                message: `Student with ID '${studentId}' not found.`,
            }, { status: 404, headers: corsHeaders });
        }

        const studentDoc = querySnapshot.docs[0];
        const studentData = studentDoc.data() as Omit<Student, 'id'>;

        // 4. Comparaison stricte et insensible à la casse
        if (
            studentData.studentId.toLowerCase() !== studentId.toLowerCase() ||
            studentData.firstName.toLowerCase() !== firstName.toLowerCase() || 
            studentData.lastName.toLowerCase() !== lastName.toLowerCase()
        ) {
            return NextResponse.json({
                success: false,
                message: "Student ID, first name, or last name does not match.",
            }, { status: 403, headers: corsHeaders });
        }
        
        // 5. Vérification du statut de l'étudiant
        if (studentData.status === 'inactive') {
            return NextResponse.json({
                success: false,
                message: "Student account is inactive.",
            }, { status: 403, headers: corsHeaders });
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

        return NextResponse.json({
            success: true,
            message: "Validation successful.",
            student: responsePayload
        }, { status: 200, headers: corsHeaders });

    } catch (error: any) {
        console.error("Internal API Error:", error);
        // Utiliser le SDK Admin peut générer des erreurs différentes, il est bon de les logger
        return NextResponse.json({ 
            success: false, 
            message: "Internal server error.", 
            error: error.message 
        }, { status: 500, headers: corsHeaders });
    }
}
