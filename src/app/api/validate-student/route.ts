
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema, type Student } from '@/lib/verigenius-types';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

// --- Configuration Firebase Client ---
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- Initialisation stable de l'app client ---
let clientApp: FirebaseApp;
if (!getApps().length) {
    clientApp = initializeApp(firebaseConfig);
} else {
    clientApp = getApp();
}
const clientDb = getFirestore(clientApp);


// --- Logique de l'API ---
export async function POST(request: NextRequest) {
    try {
        const requestBody = await request.json();

        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            return NextResponse.json({ success: false, message: "Invalid validation data.", errors: validation.error.flatten() }, { status: 400 });
        }
        const { studentId, firstName, lastName } = validation.data;

        const studentsRef = collection(clientDb, "students");
        const q = query(studentsRef, where("studentId", "==", studentId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return NextResponse.json({ success: false, message: `Validation failed: Student with matricule '${studentId}' not found.` }, { status: 404 });
        }
        
        const studentDoc = querySnapshot.docs[0];
        const studentData = studentDoc.data() as Student;

        const isFirstNameMatch = studentData.firstName.toLowerCase() === firstName.toLowerCase();
        const isLastNameMatch = studentData.lastName.toUpperCase() === lastName.toUpperCase();

        if (!isFirstNameMatch || !isLastNameMatch) {
            return NextResponse.json({ success: false, message: "Validation failed: First name or last name does not match." }, { status: 401 });
        }

        if (studentData.status === 'inactive') {
            return NextResponse.json({ success: false, message: "Validation failed: Student account is inactive." }, { status: 403 });
        }
        
        const responsePayload = {
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

        return NextResponse.json(responsePayload, { status: 200 });

    } catch (error: any) {
        console.error("Internal API Error:", error);
        return NextResponse.json({ success: false, message: "Internal server error.", error: error.message }, { status: 500 });
    }
}
