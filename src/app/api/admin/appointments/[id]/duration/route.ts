// src/app/api/admin/appointments/[id]/duration/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { addMinutes } from 'date-fns';
import { isAdminUser } from '@/lib/authUtils';
import { formatErrorMessage } from '@/lib/errorUtils'; // Import the error utility
import { Prisma } from '@prisma/client'; // Import Prisma for specific error types

// Define the expected request body structure
interface UpdateDurationRequestBody {
  newDuration: number; // New duration in minutes
}

export async function PUT(request: Request) { // Using global Request type as per user's working version
  const url = new URL(request.url);
  // Keep manual URL parsing as this was working for the user and avoided build issues
  const appointmentId = url.pathname.split('/').pop(); 

  const { userId } = await auth();
  if (!userId) {
    console.warn('PUT /api/admin/appointments/[id]/duration: Authentication required');
    return new NextResponse(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // Check if appointmentId was successfully extracted
  if (!appointmentId) {
    console.warn('PUT /api/admin/appointments/[id]/duration: Could not extract appointmentId from URL');
    return new NextResponse(JSON.stringify({ error: 'Bad Request: Invalid Appointment ID in URL' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    console.warn(`PUT /api/admin/appointments/${appointmentId}/duration: User (Clerk ID: ${userId}) is not admin.`);
    return new NextResponse(JSON.stringify({ error: 'Forbidden: Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  let body: UpdateDurationRequestBody;
  try {
    body = await request.json();
  } catch (parseError: unknown) { // Catch unknown for parsing error
    // Use formatErrorMessage for JSON parsing errors
    const friendlyMessage = formatErrorMessage(parseError, `parsing JSON body for appointment ${appointmentId} duration update`);
    return new NextResponse(JSON.stringify({ error: 'Invalid JSON body', details: friendlyMessage }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { newDuration } = body;
  if (typeof newDuration !== 'number' || newDuration <= 0) {
    const message = 'Invalid newDuration. Must be a positive number.';
    console.warn(`PUT /api/admin/appointments/${appointmentId}/duration: ${message}`);
    return new NextResponse(JSON.stringify({ error: message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) {
      console.warn(`PUT /api/admin/appointments/${appointmentId}/duration: Appointment not found.`);
      return new NextResponse(JSON.stringify({ error: 'Appointment not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const newEndTime = addMinutes(appointment.startTime, newDuration);

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { endTime: newEndTime },
    });

    console.log(`PUT /api/admin/appointments/${appointmentId}/duration: Duration updated successfully for appointment.`);
    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (e: unknown) { // Changed type from 'any' to 'unknown'
    // Use the centralized error formatter
    const userMessage = formatErrorMessage(e, `updating duration for appointment ${appointmentId}`);
    
    // Determine status code based on error type if possible
    let statusCode = 500;
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') { // Record to update not found
        statusCode = 404;
      }
      // Add other Prisma error codes as needed for specific status codes
    }
    // For other error types, formatErrorMessage already logged details.
    // We return the user-friendly message.
    return new NextResponse(JSON.stringify({ error: "Failed to update duration", details: userMessage }), { status: statusCode, headers: { 'Content-Type': 'application/json' } });
  }
}
