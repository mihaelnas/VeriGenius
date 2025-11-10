
import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase/server';
import { studentCreationSchema } from '@/lib/verigenius-types';

type RouteParams = {
  params: {
    studentId: string;
  };
};

// GET a single student by ID
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { firestore } = initializeFirebase();
        const studentRef = firestore.collection('students').doc(params.studentId);
        const studentDoc = await studentRef.get();

        if (!studentDoc.exists) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        return NextResponse.json({ id: studentDoc.id, ...studentDoc.data() });
    } catch (error) {
        console.error(`Error fetching student ${params.studentId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
    }
}

// PUT (update) a student by ID
export async function PUT(request: Request, { params }: RouteParams) {
    try {
        const { firestore } = initializeFirebase();
        const studentRef = firestore.collection('students').doc(params.studentId);

        // Check if student exists
        const studentDoc = await studentRef.get();
        if (!studentDoc.exists) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        const body = await request.json();
        // Use safeParse to avoid throwing errors on invalid data
        const validation = studentCreationSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
        }
        
        const { id, ...studentData } = validation.data; // Exclude id if present
        
        await studentRef.update(studentData);

        return NextResponse.json({ id: params.studentId, ...studentData });
    } catch (error) {
        console.error(`Error updating student ${params.studentId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
    }
}

// DELETE a student by ID
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const { firestore } = initializeFirebase();
        const studentRef = firestore.collection('students').doc(params.studentId);

        // Check if student exists before deleting
        const studentDoc = await studentRef.get();
        if (!studentDoc.exists) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        await studentRef.delete();

        return new NextResponse(null, { status: 204 }); // No Content
    } catch (error) {
        console.error(`Error deleting student ${params.studentId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
    }
}
