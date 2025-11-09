import { NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  studentValidationSchema, 
  validateStudentIdentity, 
  assignClassForStudent, 
  updateStudentStatusInDb 
} from '@/lib/verigenius';

// It's highly recommended to store the API key in environment variables
const API_KEY = process.env.VERIGENIUS_API_KEY || 'your-secret-api-key-for-development';

export async function POST(request: Request) {
  try {
    // 1. Check API Key
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'En-tête d\'autorisation manquant ou mal formé' }, { status: 401 });
    }
    const providedKey = authHeader.split(' ')[1];
    if (providedKey !== API_KEY) {
      return NextResponse.json({ success: false, error: 'Clé d\'API invalide' }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const validationResult = studentValidationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ success: false, error: 'Corps de la requête invalide', details: validationResult.error.flatten() }, { status: 400 });
    }
    
    const studentPayload = validationResult.data;

    // 3. Validate student data against the "database"
    const student = validateStudentIdentity(studentPayload);
    if (!student) {
      return NextResponse.json({ success: false, error: 'La validation de l\'étudiant a échoué. Veuillez vérifier les données fournies.' }, { status: 404 });
    }
    
    if (student.status === 'active') {
       return NextResponse.json({ success: false, error: 'L\'étudiant est déjà actif.' }, { status: 409 });
    }

    // 4. Assign student to a class
    const assignedClass = assignClassForStudent(student);
    if (!assignedClass) {
        return NextResponse.json({ success: false, error: `Impossible de trouver un cours approprié pour ${student.fieldOfStudy} au niveau ${student.level}.` }, { status: 404 });
    }

    // 5. Update student status in DB (simulated)
    const dbUpdateSuccess = await updateStudentStatusInDb(student.id, assignedClass.id);
    if (!dbUpdateSuccess) {
      return NextResponse.json({ success: false, error: 'Échec de la mise à jour du statut de l\'étudiant dans la base de données.' }, { status: 500 });
    }
    
    // 6. Return successful response
    return NextResponse.json({
      success: true,
      message: 'Étudiant validé et inscrit avec succès.',
      studentId: student.id,
      classId: assignedClass.id,
      className: assignedClass.name
    });

  } catch (error) {
    console.error('Erreur API:', error);
    if (error instanceof z.ZodError) {
       return NextResponse.json({ success: false, error: 'Charge utile JSON invalide' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Une erreur interne inattendue s\'est produite.' }, { status: 500 });
  }
}
