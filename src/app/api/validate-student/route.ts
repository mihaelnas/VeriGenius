import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/firebase/server';
import { studentValidationSchema } from '@/lib/verigenius-types';

// Helper function to capitalize the first letter of each word
const capitalize = (str: string) => {
    if (!str) return '';
    return str
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

export async function POST(request: Request) {
  try {
    initializeAdminApp();
    const db = getFirestore();

    const body = await request.json();
    const validationResult = studentValidationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Données invalides', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { studentId, firstName, lastName } = validationResult.data;

    const studentsRef = db.collection('students');
    const snapshot = await studentsRef.where('studentId', '==', studentId).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Étudiant non trouvé avec ce matricule' }, { status: 404 });
    }

    const studentDoc = snapshot.docs[0];
    const studentData = studentDoc.data();

    // Normalize names for comparison
    const formattedRequestFirstName = capitalize(firstName);
    const formattedRequestLastName = lastName.toUpperCase();

    if (studentData.firstName !== formattedRequestFirstName || studentData.lastName !== formattedRequestLastName) {
      return NextResponse.json({ error: 'Le nom ou prénom ne correspond pas au matricule' }, { status: 403 });
    }
    
    if (studentData.status === 'pending_payment' || studentData.status === 'inactive') {
        return NextResponse.json({ error: 'Le statut de l\'étudiant ne permet pas l\'inscription. Paiement en attente ou inactif.' }, { status: 402 });
    }

    // If validation is successful
    return NextResponse.json({
      message: 'Étudiant validé avec succès',
      classId: studentData.classId,
    }, { status: 200 });

  } catch (error) {
    console.error('Erreur de validation de l\'étudiant:', error);
    if (error instanceof Error) {
        return NextResponse.json({ error: 'Erreur interne du serveur', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
