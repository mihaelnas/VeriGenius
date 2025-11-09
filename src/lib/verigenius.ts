import { z } from 'zod';

// Schema for student data received in the API request
export const studentValidationSchema = z.object({
  studentId: z.string().min(1, 'L\'ID de l\'étudiant est requis'),
  name: z.string().min(1, 'Le nom de l\'étudiant est requis'),
  level: z.string().min(1, 'Le niveau de l\'étudiant est requis'),
  fieldOfStudy: z.string().min(1, 'Le domaine d\'études est requis'),
});

export type StudentValidationPayload = z.infer<typeof studentValidationSchema>;

// Internal student representation (mock database record)
export interface Student {
  id: string;
  name: string;
  level: string;
  fieldOfStudy: string;
  status: 'pending' | 'active' | 'inactive';
}

// Internal class representation
export interface Class {
  id: string;
  name:string;
  level: string;
  fieldOfStudy: string;
}

// --- Mock Database ---
const mockStudents: Student[] = [
  { id: 'STU12345', name: 'Alice Johnson', level: 'Undergraduate', fieldOfStudy: 'Computer Science', status: 'pending' },
  { id: 'STU67890', name: 'Bob Williams', level: 'Graduate', fieldOfStudy: 'Data Science', status: 'pending' },
  { id: 'STU11223', name: 'Charlie Brown', level: 'Undergraduate', fieldOfStudy: 'Electrical Engineering', status: 'pending' },
  { id: 'STU44556', name: 'Diana Prince', level: 'Undergraduate', fieldOfStudy: 'Computer Science', status: 'active' },
];

const mockClasses: Class[] = [
  { id: 'CS101', name: 'Introduction à la programmation', level: 'Undergraduate', fieldOfStudy: 'Computer Science' },
  { id: 'DS501', name: 'Apprentissage automatique avancé', level: 'Graduate', fieldOfStudy: 'Data Science' },
  { id: 'EE202', name: 'Circuits numériques', level: 'Undergraduate', fieldOfStudy: 'Electrical Engineering' },
];
// --- End Mock Database ---


/**
 * Validates student identity against the "university's database"
 * @param payload The student data from the API request
 * @returns The matching student record or null if not found
 */
export function validateStudentIdentity(payload: StudentValidationPayload): Student | null {
  const student = mockStudents.find(
    (s) =>
      s.id.toLowerCase() === payload.studentId.toLowerCase() &&
      s.name.toLowerCase() === payload.name.toLowerCase() &&
      s.level === payload.level &&
      s.fieldOfStudy === payload.fieldOfStudy
  );
  return student || null;
}

/**
 * Determines the corresponding class for a validated student
 * @param student A valid student object
 * @returns A matching class or null if not found
 */
export function assignClassForStudent(student: Student): Class | null {
    // Simple logic: find a class that matches the student's level and field of study.
    // In a real scenario, this could be much more complex, e.g., checking prerequisites, class capacity etc.
    const assignedClass = mockClasses.find(
        (c) => c.level === student.level && c.fieldOfStudy === student.fieldOfStudy
    );
    return assignedClass || null;
}

/**
 * Simulates updating a student's record in Firestore or another database
 * @param studentId The ID of the student to update
 * @param classId The ID of the class to enroll the student in
 * @returns A boolean indicating success
 */
export async function updateStudentStatusInDb(studentId: string, classId: string): Promise<boolean> {
  // In a real application, you would use the Firebase Admin SDK or a client library
  // to update the student's status to 'active' and add them to the class roster in Firestore.
  // e.g., 
  // const studentRef = db.collection('students').doc(studentId);
  // await studentRef.update({ status: 'active', classId: classId });
  // 
  // const classRef = db.collection('classes').doc(classId);
  // await classRef.update({ students: firebase.firestore.FieldValue.arrayUnion(studentId) });
  
  console.log(`Simulation de la mise à jour de la base de données : le statut de l'étudiant ${studentId} est passé à actif et ajouté à la classe ${classId}.`);
  
  // Find student in mock DB and update status
  const student = mockStudents.find(s => s.id === studentId);
  if (student) {
    student.status = 'active';
  }

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return true;
}
