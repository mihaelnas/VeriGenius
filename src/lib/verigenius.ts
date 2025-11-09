import { z } from 'zod';
import { Firestore, FieldValue } from 'firebase-admin/firestore';

// Schema for student data received in the API request
export const studentValidationSchema = z.object({
  studentId: z.string().min(1, 'Le matricule de l\'étudiant est requis'),
  firstName: z.string().min(1, 'Le prénom de l\'étudiant est requis'),
  lastName: z.string().min(1, 'Le nom de l\'étudiant est requis'),
  level: z.string().min(1, 'Le niveau de l\'étudiant est requis'),
  fieldOfStudy: z.string().min(1, 'La filière est requise'),
});

export type StudentValidationPayload = z.infer<typeof studentValidationSchema>;

// Internal student representation (matches Firestore document)
export interface Student {
  id: string; // Document ID
  firstName: string;
  lastName: string;
  studentId: string;
  level: string;
  fieldOfStudy: string;
  status: 'pending' | 'active' | 'inactive';
}

// Internal class representation (matches Firestore document)
export interface Class {
  id: string; // Document ID
  name: string;
  level: string;
  fieldOfStudy: string;
  studentIds?: string[];
}


/**
 * Validates student identity against the Firestore database.
 * @param firestore The Firestore instance.
 * @param payload The student data from the API request.
 * @returns The matching student record or null if not found.
 */
export async function validateStudentIdentity(firestore: Firestore, payload: StudentValidationPayload): Promise<Student | null> {
  const studentsRef = firestore.collection('students');
  const snapshot = await studentsRef
    .where('studentId', '==', payload.studentId)
    .where('firstName', '==', payload.firstName)
    .where('lastName', '==', payload.lastName)
    .where('level', '==', payload.level)
    .where('fieldOfStudy', '==', payload.fieldOfStudy)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const studentDoc = snapshot.docs[0];
  const studentData = studentDoc.data() as Omit<Student, 'id'>;

  return { ...studentData, id: studentDoc.id };
}

/**
 * Finds all matching classes and assigns the student to the one with the fewest students.
 * @param firestore The Firestore instance.
 * @param student A valid student object.
 * @returns A matching class or null if not found.
 */
export async function assignClassForStudent(firestore: Firestore, student: Student): Promise<Class | null> {
    const classesRef = firestore.collection('classes');
    const snapshot = await classesRef
        .where('level', '==', student.level)
        .where('fieldOfStudy', '==', student.fieldOfStudy)
        .get();

    if (snapshot.empty) {
        return null; // No classes found for this level and field of study
    }
    
    const classes = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            level: data.level,
            fieldOfStudy: data.fieldOfStudy,
            studentIds: data.studentIds || []
        } as Class;
    });

    // Find the class with the minimum number of students
    const classWithFewestStudents = classes.reduce((prev, current) => {
        return (prev.studentIds!.length < current.studentIds!.length) ? prev : current;
    });

    return classWithFewestStudents;
}

/**
 * Updates a student's status to 'active' and enrolls them in a class in Firestore.
 * @param firestore The Firestore instance.
 * @param studentId The ID of the student to update.
 * @param classId The ID of the class to enroll the student in.
 * @returns A boolean indicating success.
 */
export async function updateStudentStatusInDb(firestore: Firestore, studentId: string, classId: string): Promise<boolean> {
  try {
    const studentRef = firestore.collection('students').doc(studentId);
    const classRef = firestore.collection('classes').doc(classId);

    const batch = firestore.batch();

    // Update student's status
    batch.update(studentRef, { status: 'active' });

    // Add student's ID to the class's studentIds array
    batch.update(classRef, {
      studentIds: FieldValue.arrayUnion(studentId)
    });

    await batch.commit();
    
    console.log(`Firestore updated: Student ${studentId} status set to active and added to class ${classId}.`);
    return true;
  } catch (error) {
    console.error("Error updating student status in DB:", error);
    return false;
  }
}
