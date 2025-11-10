import { z } from 'zod';

export const SupportedFieldOfStudy = z.enum(["IG", "GB", "ASR", "OCC", "GID"]);
export const SupportedLevel = z.enum(["L1", "L2", "L3", "M1", "M2"]);

// Schema for student data received in the API request for validation
export const studentValidationSchema = z.object({
  studentId: z.string().regex(/^\d{4} [A-Z]-[A-Z]$/, "Le format du matricule doit être '1234 A-B'."),
  firstName: z.string().min(1, 'Le prénom de l\'étudiant est requis'),
  lastName: z.string().min(1, 'Le nom de l\'étudiant est requis'),
});

// Schema for creating/updating a student via the dashboard (includes status)
export const studentCreationSchema = studentValidationSchema.extend({
  id: z.string().optional(),
  level: SupportedLevel,
  fieldOfStudy: SupportedFieldOfStudy,
  status: z.enum(["pending_payment", "partially_paid", "fully_paid", "inactive"]).default('pending_payment'),
  classId: z.string()
    .min(1, "L'ID de la classe est requis")
    .regex(/^(L[1-3]|M[1-2])-(IG|GB|ASR|OCC|GID)-G[1-9][0-9]*$/, "Le format de l'ID de classe doit être NIVEAU-FILIERE-GROUPE (ex: L1-IG-G1)"),
});

export type StudentValidationPayload = z.infer<typeof studentValidationSchema>;
export type StudentCreationPayload = z.infer<typeof studentCreationSchema>;


// Internal student representation (matches Firestore document)
export interface Student {
  id: string; // Document ID
  firstName: string;
  lastName: string;
  studentId: string; // matricule
  level: z.infer<typeof SupportedLevel>;
  fieldOfStudy: z.infer<typeof SupportedFieldOfStudy>;
  status: 'pending_payment' | 'partially_paid' | 'fully_paid' | 'inactive';
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
