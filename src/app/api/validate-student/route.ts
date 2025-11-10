
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema } from '@/lib/verigenius-types';

// --- ÉTAPE 1 DU DÉBOGAGE ---
// Ce code ne contacte PAS Firebase. Il valide uniquement les données d'entrée.

export async function POST(request: NextRequest) {
    try {
        const requestBody = await request.json();

        // 1. Validation des données d'entrée
        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            // Le corps de la requête est invalide
            return NextResponse.json({ 
                success: false, 
                message: "Invalid validation data.", 
                errors: validation.error.flatten() 
            }, { status: 400 });
        }

        // Si la validation réussit, on renvoie une réponse de succès simple.
        // Aucune base de données n'est contactée.
        return NextResponse.json({
            success: true,
            message: "DEBUG STEP 1: Input data validation successful."
        }, { status: 200 });

    } catch (error: any) {
        // Gère les erreurs si le corps de la requête n'est pas un JSON valide
        console.error("DEBUG STEP 1 - Internal API Error:", error);
        return NextResponse.json({ 
            success: false, 
            message: "Internal server error.", 
            error: error.message 
        }, { status: 500 });
    }
}
