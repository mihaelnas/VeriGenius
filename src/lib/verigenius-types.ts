import { z } from 'zod';

// Schema for student data received in the API request
export const studentValidationSchema = z.object({
  studentId: z.string().min(1, 'Le matricule de l\'étudiant est requis'),
  firstName: z.string().min(1, 'Le prénom de l\'étudiant est requis'),
  lastName: z.string().min(1, 'Le nom de l\'étudiant est requis'),
  level: z.string().min(1, 'Le niveau de l\'étudiant est requis'),
  fieldOfStudy: z.string().min(1, 'La filière est requise'),
});

// Schema for creating/updating a student (includes status)
export const studentCreationSchema = studentValidationSchema.extend({
  id: z.string().optional(),
  status: z.enum(["pending", "active", "inactive"]),
  classId: z.string().min(1, "L'ID de la classe est requis"),
});

export type StudentValidationPayload = z.infer<typeof studentValidationSchema>;
export type StudentCreationPayload = z.infer<typeof studentCreationSchema>;


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
