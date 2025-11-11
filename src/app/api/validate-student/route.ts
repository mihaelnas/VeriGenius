
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema, type Student } from '@/lib/verigenius-types';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, Firestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// --- INITIALISATION STABLE DU SDK CLIENT ---
let firebaseApp: FirebaseApp;
let db: Firestore;

if (getApps().length === 0) {
    firebaseApp = initializeApp(firebaseConfig);
} else {
    firebaseApp = getApp();
}
db = getFirestore(firebaseApp);

// Headers pour la gestion du CORS
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

        // 1. Validation des données d'entrée
        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            return NextResponse.json({ 
                success: false, 
                message: "Invalid validation data.", 
                errors: validation.error.flatten() 
            }, { status: 400, headers: corsHeaders });
        }

        const { studentId, firstName, lastName } = validation.data;

        // 2. Exécution de la requête
        const studentsRef = collection(db, 'students');
        const q = query(studentsRef, where('studentId', '==', studentId.toUpperCase()));
        const querySnapshot = await getDocs(q);

        // 3. Traitement des résultats
        if (querySnapshot.empty) {
            return NextResponse.json({
                success: false,
                message: `Student with ID '${studentId}' not found.`,
            }, { status: 404, headers: corsHeaders });
        }

        const studentDoc = querySnapshot.docs[0];
        const studentData = studentDoc.data() as Omit<Student, 'id'>;

        // Vérification du matricule, nom et prénom (insensible à la casse)
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
        
        // Vérification du statut
        if (studentData.status === 'inactive') {
            return NextResponse.json({
                success: false,
                message: "Student account is inactive.",
            }, { status: 403, headers: corsHeaders });
        }

        // Si tout est correct, renvoyer les données de l'étudiant, y compris la classe
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
        return NextResponse.json({ 
            success: false, 
            message: "Internal server error.", 
            error: error.message 
        }, { status: 500, headers: corsHeaders });
    }
}
