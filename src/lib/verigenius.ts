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
  studentId: string; // matricule
  level: string;
  fieldOfStudy: string;
  status: 'pending' | 'active' | 'inactive';
  classId: string; // Reference to the Class document
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
 * @returns The matching student record or null if not found or if data is inconsistent.
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
    console.log("Validation failed: No student found with the provided details.");
    return null;
  }

  const studentDoc = snapshot.docs[0];
  const studentData = studentDoc.data() as Omit<Student, 'id'>;

  // Ensure the student has a classId assigned.
  if (!studentData.classId) {
    console.log(`Validation failed: Student ${studentDoc.id} has no classId assigned.`);
    return null;
  }

  return { ...studentData, id: studentDoc.id };
}

/**
 * Retrieves the class assigned to the student.
 * @param firestore The Firestore instance.
 * @param student A valid student object with a classId.
 * @returns The matching Class object or null if not found.
 */
export async function assignClassForStudent(firestore: Firestore, student: Student): Promise<Class | null> {
    if (!student.classId) {
        console.error(`Attempted to assign class for student ${student.id} but classId is missing.`);
        return null;
    }

    const classRef = firestore.collection('classes').doc(student.classId);
    const classDoc = await classRef.get();

    if (!classDoc.exists) {
        console.error(`Class with ID ${student.classId} assigned to student ${student.id} does not exist.`);
        return null;
    }
    
    const classData = classDoc.data() as Omit<Class, 'id'>

    // Optional: Verify that student's level/filiere matches the class's
    if (classData.level !== student.level || classData.fieldOfStudy !== student.fieldOfStudy) {
        console.warn(`Mismatch: Student ${student.id} (${student.level}, ${student.fieldOfStudy}) is assigned to class ${classDoc.id} (${classData.level}, ${classData.fieldOfStudy})`);
        // Depending on strictness, you might want to return null here.
    }

    return { ...classData, id: classDoc.id };
}

/**
 * Updates a student's status to 'active' and ensures they are in the class's student list.
 * This function is now idempotent, it won't add the student if they are already in the list.
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

    // Update student's status to 'active'
    batch.update(studentRef, { status: 'active' });

    // Add student's document ID to the class's studentIds array if not already present
    batch.update(classRef, {
      studentIds: FieldValue.arrayUnion(studentId)
    });

    await batch.commit();
    
    console.log(`Firestore updated: Student ${studentId} status set to active and enrolled in class ${classId}.`);
    return true;
  } catch (error) {
    console.error("Error updating student status in DB:", error);
    return false;
  }
}