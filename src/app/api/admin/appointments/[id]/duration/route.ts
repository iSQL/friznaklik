// src/app/api/admin/appointments/[id]/duration/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuth } from '@clerk/nextjs/server'; // For Clerk authentication
import { addMinutes } from 'date-fns'; // To help recalculate endTime

// Define the expected request body structure
interface UpdateDurationRequestBody {
  newDuration: number; // New duration in minutes
}

// PUT handler to update the duration of a specific appointment
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const appointmentId = params.id;

  // 1. Authenticate User
  const { userId } = getAuth(request as any); // `userId` here is the Clerk user ID

  if (!userId) {
    return new NextResponse(JSON.stringify({ message: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // 2. Authorize Admin by checking role from local database
  try {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId }, // Assuming your User model has a unique 'clerkId' field storing Clerk's userId
      select: { role: true },    // Only fetch the role field
    });

    const isAdmin = dbUser?.role === 'admin';
    if (!isAdmin) {
      console.warn(`User (Clerk ID: ${userId}) attempted admin action without admin role. Role found: ${dbUser?.role}`);
      return new NextResponse(JSON.stringify({ message: 'Forbidden: Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    console.log(`Admin (Clerk ID: ${userId}, Role: ${dbUser?.role}) attempting to update duration for appointment ID: ${appointmentId}`);

    // 3. Validate Request Body
    let body: UpdateDurationRequestBody;
    try {
      body = await request.json();
    } catch (e) {
      return new NextResponse(JSON.stringify({ message: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { newDuration } = body;

    if (typeof newDuration !== 'number' || newDuration <= 0) {
      return new NextResponse(JSON.stringify({ message: 'Invalid newDuration. Must be a positive number.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 4. Fetch the Appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      return new NextResponse(JSON.stringify({ message: 'Appointment not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // 5. Recalculate endTime
    const newEndTime = addMinutes(appointment.startTime, newDuration);

    // 6. Update the Appointment
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        endTime: newEndTime,
      },
    });

    console.log(`Appointment ${appointmentId} duration updated successfully. New endTime: ${newEndTime}`);
    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (error: any) {
    console.error(`Error during appointment duration update for ID ${appointmentId} by user ${userId}:`, error);
    // Check if it's a Prisma error or other type of error for more specific logging if needed
    if (error.code) { // Prisma errors often have a 'code' property
        console.error(`Prisma error code: ${error.code}`);
    }
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error', error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
