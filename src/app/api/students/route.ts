import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase/server';
import { studentCreationSchema, type Student } from '@/lib/verigenius-types';

// GET all students
export async function GET() {
    try {
        const { firestore } = initializeFirebase();
        const studentsSnapshot = await firestore.collection('students').get();
        const students: Student[] = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
        return NextResponse.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST a new student
export async function POST(request: Request) {
    try {
        const { firestore } = initializeFirebase();
        const body = await request.json();

        const validation = studentCreationSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
        }

        const { id, ...studentData } = validation.data; // Exclude id if present

        const newStudentRef = await firestore.collection('students').add(studentData);

        return NextResponse.json({ id: newStudentRef.id, ...studentData }, { status: 201 });

    } catch (error) {
        console.error('Error creating student:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
