// src/app/api/admin/appointments/[id]/approve/route.ts

import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication
import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility
import { isAdminUser } from '@/lib/authUtils'; // Import the centralized isAdminUser function

// Handles PUT requests to /api/admin/appointments/:id/approve
export async function PUT(
  request: Request // Keep request parameter
) {
  // Check authentication status using Clerk *first*
  const { userId } = await auth();

  if (!userId) {
    console.log('PUT /api/admin/appointments/approve: User not authenticated, returning 401');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Extract appointmentId from the URL
  const url = new URL(request.url);
  const appointmentId = url.pathname.split('/').at(-2); // Extract the dynamic ID from the URL

  if (!appointmentId) {
    console.log('PUT /api/admin/appointments/approve: Missing appointment ID, returning 400');
    return new NextResponse('Bad Request', { status: 400 });
  }

  console.log(`PUT /api/admin/appointments/${appointmentId}/approve: Request received for ID`);

  // Check if the authenticated user is an admin
  const isAdmin = await isAdminUser(userId);

  if (!isAdmin) {
    console.log(`PUT /api/admin/appointments/${appointmentId}/approve: User is not admin, returning 403`);
    return new NextResponse('Forbidden', { status: 403 });
  }

  console.log(`PUT /api/admin/appointments/${appointmentId}/approve: User is admin, attempting to approve...`);

  try {
    // Update the appointment status to 'approved' in the database
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId, status: 'pending' }, // Only update if status is pending
      data: {
        status: 'approved',
      },
    });

    console.log(`Appointment ${appointmentId} approved successfully.`);

    // Return the updated appointment details with a 200 status code.
    return NextResponse.json(updatedAppointment, { status: 200 });
  } catch (error) {
    console.error(`Error approving appointment with ID ${appointmentId}:`, error);
    // Handle case where appointment is not found or not pending
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return new NextResponse('Appointment not found or not pending', { status: 404 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
