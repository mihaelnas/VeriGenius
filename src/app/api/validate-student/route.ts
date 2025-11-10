
import { NextRequest, NextResponse } from 'next/server';
import { studentValidationSchema, type Student } from '@/lib/verigenius-types';
import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// Helper to initialize Firebase App on the server, specific for this route
function getFirebaseApp() {
    // Use a unique name to avoid conflicts
    const appName = `api-validate-student-${Date.now()}`;
    if (getApps().some(app => app.name === appName)) {
        return getApp(appName);
    }
    return initializeApp(firebaseConfig, appName);
}

export async function POST(request: NextRequest) {
    let requestBody: any;
    const clientIp = request.ip || request.headers.get('x-forwarded-for') || 'inconnu';
    let responsePayload: object = {};
    let statusCode: number = 500;
    let isSuccess = false;
    let logMessage = "An unexpected error occurred.";

    const timestamp = new Date().toISOString();
    const app = getFirebaseApp();
    const db = getFirestore(app);

    try {
        // STEP 1: Parse and Validate Request Body
        try {
            requestBody = await request.json();
        } catch (jsonError) {
            statusCode = 400;
            logMessage = "Invalid JSON body.";
            responsePayload = { success: false, message: logMessage };
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        const validation = studentValidationSchema.safeParse(requestBody);
        if (!validation.success) {
            statusCode = 400;
            logMessage = "Invalid validation data.";
            responsePayload = { success: false, message: logMessage, errors: validation.error.flatten() };
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        const { studentId, firstName, lastName } = validation.data;

        // STEP 2: Query Firestore using the client SDK
        const studentsRef = collection(db, "students");
        const studentQuery = query(studentsRef, where("studentId", "==", studentId));
        const querySnapshot = await getDocs(studentQuery);

        if (querySnapshot.empty) {
            statusCode = 404;
            isSuccess = false;
            logMessage = `Validation failed: Student with matricule '${studentId}' not found.`;
            responsePayload = { success: isSuccess, message: logMessage };
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        const studentDoc = querySnapshot.docs[0];
        const studentData = studentDoc.data() as Student;

        // STEP 3: Compare names (case-insensitive for first name, case-sensitive for last name)
        const isFirstNameMatch = studentData.firstName.toLowerCase() === firstName.toLowerCase();
        const isLastNameMatch = studentData.lastName === lastName.toUpperCase();

        if (!isFirstNameMatch || !isLastNameMatch) {
            statusCode = 401;
            isSuccess = false;
            logMessage = "Validation failed: First name or last name does not match.";
            responsePayload = { success: isSuccess, message: logMessage };
            return NextResponse.json(responsePayload, { status: statusCode });
        }
        
        // STEP 4: Check student status
        if (studentData.status === 'inactive') {
            statusCode = 403;
            isSuccess = false;
            logMessage = "Validation failed: Student account is inactive.";
            responsePayload = { success: isSuccess, message: logMessage };
            return NextResponse.json(responsePayload, { status: statusCode });
        }

        // STEP 5: Success
        statusCode = 200;
        isSuccess = true;
        logMessage = "Validation successful.";
        responsePayload = {
            success: isSuccess,
            message: logMessage,
            student: {
                firstName: studentData.firstName,
                lastName: studentData.lastName,
                studentId: studentData.studentId,
                fieldOfStudy: studentData.fieldOfStudy,
                level: studentData.level,
                status: studentData.status
            }
        };

        return NextResponse.json(responsePayload, { status: statusCode });

    } catch (error: any) {
        console.error("Internal API Error:", error);
        statusCode = 500;
        isSuccess = false;
        logMessage = "Internal server error during API execution.";
        responsePayload = { success: false, message: logMessage, error: error.message };
        
        // This will now only be hit for unexpected errors, not for validation failures
        return NextResponse.json(responsePayload, { status: statusCode });

    } finally {
        // Log the final outcome
        try {
            const logEntry = {
                timestamp,
                requestBody,
                responseBody: responsePayload,
                statusCode,
                isSuccess,
                clientIp,
            };
            // Note: We're not using admin SDK here, so direct log writing isn't straightforward
            // In a real scenario, you'd send this to a separate logging service or a different Firebase function.
            // For now, we console.log it on the server.
            console.log("API Request Log:", JSON.stringify(logEntry, null, 2));

        } catch (logError) {
            console.error("Failed to log API request:", logError);
        }
        
        // Clean up the temporary Firebase app instance
        await deleteApp(app);
    }
}
