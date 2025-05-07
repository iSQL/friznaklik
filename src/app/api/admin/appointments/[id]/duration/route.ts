// src/app/api/admin/appointments/[id]/duration/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server'; // For Clerk authentication
import { addMinutes } from 'date-fns'; // To help recalculate endTime
import { isAdminUser } from '@/lib/authUtils'; // Import the centralized isAdminUser function

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

  const { userId } = await auth(); // `userId` here is the Clerk user ID

  if (!userId) {
    console.log(`PUT /api/admin/appointments/${appointmentId}/duration: User not authenticated`);
    return new NextResponse(JSON.stringify({ message: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  console.log(`PUT /api/admin/appointments/${appointmentId}/duration: Authenticated Clerk userId: ${userId}`);

  // 2. Authorize Admin by checking role using the centralized utility
  const isAdmin = await isAdminUser(userId); // Use the imported helper
  if (!isAdmin) {
    console.warn(`PUT /api/admin/appointments/${appointmentId}/duration: User (Clerk ID: ${userId}) attempted admin action without admin role.`);
    return new NextResponse(JSON.stringify({ message: 'Forbidden: Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  console.log(`PUT /api/admin/appointments/${appointmentId}/duration: Admin (Clerk ID: ${userId}) attempting to update duration.`);

  // 3. Validate Request Body
  let body: UpdateDurationRequestBody;
  try {
    body = await request.json();
  } catch (e) {
    console.error(`PUT /api/admin/appointments/${appointmentId}/duration: Invalid JSON body`, e);
    return new NextResponse(JSON.stringify({ message: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { newDuration } = body;

  if (typeof newDuration !== 'number' || newDuration <= 0) {
    console.log(`PUT /api/admin/appointments/${appointmentId}/duration: Invalid newDuration: ${newDuration}`);
    return new NextResponse(JSON.stringify({ message: 'Invalid newDuration. Must be a positive number.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // 4. Fetch the Appointment
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    console.log(`PUT /api/admin/appointments/${appointmentId}/duration: Appointment not found`);
    return new NextResponse(JSON.stringify({ message: 'Appointment not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  // 5. Recalculate endTime
  const newEndTime = addMinutes(appointment.startTime, newDuration);

  // 6. Update the Appointment
  try {
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        endTime: newEndTime,
        // Potentially update service duration here if that's intended,
        // or ensure the service's own duration field is the source of truth
        // and this is just an override for this specific appointment's end time.
        // For now, only endTime is updated based on newDuration.
      },
    });

    console.log(`PUT /api/admin/appointments/${appointmentId}/duration: Appointment duration updated successfully. New endTime: ${newEndTime}`);
    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (error: any) {
    console.error(`Error during appointment duration update for ID ${appointmentId} by user ${userId}:`, error);
    // Check if it's a Prisma error (e.g., record not found for update if it was deleted between fetch and update)
    if (error.code === 'P2025') { 
        console.log(`PUT /api/admin/appointments/${appointmentId}/duration: Appointment not found for update (possibly deleted).`);
        return new NextResponse(JSON.stringify({ message: 'Appointment not found for update' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error', error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
