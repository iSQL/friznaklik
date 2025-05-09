// src/app/api/admin/appointments/[id]/duration/route.ts

import { NextResponse, type NextRequest } from 'next/server'; // Use NextRequest
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { addMinutes } from 'date-fns';
import { isAdminUser } from '@/lib/authUtils';
import { formatErrorMessage } from '@/lib/errorUtils'; // Import the error utility
import { Prisma } from '@prisma/client'; // Import Prisma for specific error types

// Define an interface for the route context, including params
interface RouteContext {
  params: {
    id: string; // This matches the [id] segment in the filename
  };
}

interface UpdateDurationRequestBody {
  newDuration: number; // New duration in minutes
}

export async function PUT(
  request: NextRequest, // Use NextRequest
  context: RouteContext   // Use the defined RouteContext type
) {
  const { userId } = await auth();
  if (!userId) {
    console.warn('PUT /api/admin/appointments/[id]/duration: Authentication required');
    // formatErrorMessage will log details, here we return a standard response
    return new NextResponse(JSON.stringify({ message: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const appointmentId = context.params.id;
  if (!appointmentId) {
    // This should ideally not be hit if routing is correct
    console.warn('PUT /api/admin/appointments/[id]/duration: Missing appointmentId in params');
    return new NextResponse(JSON.stringify({ message: 'Bad Request: Appointment ID is missing' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    console.warn(`PUT /api/admin/appointments/${appointmentId}/duration: User (Clerk ID: ${userId}) is not admin.`);
    return new NextResponse(JSON.stringify({ message: 'Forbidden: Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  let body: UpdateDurationRequestBody;
  try {
    body = await request.json();
  } catch (parseError: unknown) {
    const friendlyMessage = formatErrorMessage(parseError, `parsing JSON body for appointment ${appointmentId} duration update`);
    return new NextResponse(JSON.stringify({ message: 'Invalid JSON body', error: friendlyMessage }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { newDuration } = body;
  if (typeof newDuration !== 'number' || newDuration <= 0) {
    const message = 'Invalid newDuration. Must be a positive number.';
    console.warn(`PUT /api/admin/appointments/${appointmentId}/duration: ${message}`);
    return new NextResponse(JSON.stringify({ message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) {
      console.warn(`PUT /api/admin/appointments/${appointmentId}/duration: Appointment not found.`);
      return new NextResponse(JSON.stringify({ message: 'Appointment not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const newEndTime = addMinutes(appointment.startTime, newDuration);

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { endTime: newEndTime },
    });

    console.log(`PUT /api/admin/appointments/${appointmentId}/duration: Duration updated successfully for appointment.`);
    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (e: unknown) {
    // Use the centralized error formatter
    const userMessage = formatErrorMessage(e, `updating duration for appointment ${appointmentId}`);
    
    // Determine status code based on error type if possible
    let statusCode = 500;
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') { // Record to update not found
        statusCode = 404;
      }
      // Add other Prisma error codes as needed
    }
    
    return new NextResponse(JSON.stringify({ message: userMessage }), { status: statusCode, headers: { 'Content-Type': 'application/json' } });
  }
}
