
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema } from '@/lib/verigenius-types';

export async function POST(request: NextRequest) {
    let requestBody: any = {};

    try {
        try {
            requestBody = await request.json();
        } catch (jsonError) {
            const response = { success: false, message: "Le corps de la requête est invalide ou n'est pas du JSON." };
            // Pas de log ici car Firestore n'est pas initialisé
            return NextResponse.json(response, { status: 400 });
        }

        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            const response = { success: false, message: "Données de validation invalides.", errors: validation.error.flatten() };
             // Pas de log ici
            return NextResponse.json(response, { status: 400 });
        }
        
        // Si la validation réussit, on s'arrête là pour ce test.
        const successResponse = {
            success: true,
            message: "DEBUG Step 1: Validation successful. No Firebase interaction."
        };

        return NextResponse.json(successResponse, { status: 200 });

    } catch (error: any) {
        console.error("Erreur interne majeure dans l'API (Étape 1):", error);
        const errorResponse = { success: false, message: "Erreur interne du serveur lors de la validation (Étape 1).", error: error.message };
        
        return NextResponse.json(errorResponse, { status: 500 });
    }
}
