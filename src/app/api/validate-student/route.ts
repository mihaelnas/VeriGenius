
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema } from '@/lib/verigenius-types';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// --- ÉTAPE 2 DU DÉBOGAGE ---
// Initialisation stable du SDK Client Firebase
// https://firebase.google.com/docs/web/setup
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(firebaseApp);

export async function POST(request: NextRequest) {
    try {
        const requestBody = await request.json();

        // 1. Validation des données d'entrée (Étape 1 - acquise)
        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            return NextResponse.json({ 
                success: false, 
                message: "Invalid validation data.", 
                errors: validation.error.flatten() 
            }, { status: 400 });
        }

        const { studentId } = validation.data;

        // 2. Tenter une lecture simple sur Firestore
        const studentsRef = collection(db, 'students');
        const q = query(studentsRef, where('studentId', '==', studentId));
        
        // Exécuter la requête mais ne rien faire avec le résultat pour le moment.
        // Le but est de voir si cette ligne elle-même provoque une erreur.
        await getDocs(q);

        // Si la ligne ci-dessus n'a pas crashé, c'est un succès pour cette étape.
        return NextResponse.json({
            success: true,
            message: "DEBUG STEP 2: Firebase query executed successfully."
        }, { status: 200 });

    } catch (error: any) {
        console.error("DEBUG STEP 2 - Internal API Error:", error);
        return NextResponse.json({ 
            success: false, 
            message: "Internal server error during Firebase query.", 
            error: error.message 
        }, { status: 500 });
    }
}
