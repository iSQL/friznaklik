// src/app/api/admin/appointments/[id]/reject/route.ts

import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication
import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility

// Helper function to check if the authenticated user is an admin
async function isAdminUser(userId: string): Promise<boolean> {
  // Added null check for safety
  if (!userId) return false;
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  });
  return dbUser?.role === 'admin';
}

// Handles PUT requests to /api/admin/appointments/:id/reject
// Uses URL parsing to get the appointment ID
export async function PUT(
    request: Request // Only the request parameter is needed now
) {
  // Check authentication status using Clerk *first*
  const { userId } = await auth(); // Admin must be logged in

  if (!userId) {
    console.log('PUT /api/admin/appointments/reject: User not authenticated, returning 401');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Extract appointmentId from the URL path
  let appointmentId: string | undefined;
  try {
      const url = new URL(request.url);
      // Example URL: /api/admin/appointments/some-id/reject
      // Split by '/' -> ['', 'api', 'admin', 'appointments', 'some-id', 'reject']
      // The ID should be the second to last element
      appointmentId = url.pathname.split('/').at(-2);
  } catch (urlError) {
       console.error('PUT /api/admin/appointments/reject: Error parsing request URL:', urlError);
       return new NextResponse('Internal Server Error', { status: 500 });
  }


  if (!appointmentId) {
    console.log('PUT /api/admin/appointments/reject: Missing or could not parse appointment ID from URL, returning 400');
    return new NextResponse('Bad Request: Invalid Appointment ID in URL', { status: 400 });
  }

  console.log(`PUT /api/admin/appointments/${appointmentId}/reject: Request received for ID`);

  // Check if the authenticated user is an admin
  const isAdmin = await isAdminUser(userId);

  if (!isAdmin) {
    console.log(`PUT /api/admin/appointments/${appointmentId}/reject: User is not admin, returning 403`);
    return new NextResponse('Forbidden', { status: 403 });
  }

   console.log(`PUT /api/admin/appointments/${appointmentId}/reject: User is admin, attempting to reject...`);


  try {
    // Update the appointment status to 'rejected' in the database
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId, status: 'pending' }, // Only update if status is pending
      data: {
        status: 'rejected',
        // TODO: Optionally add admin user ID or rejection reason notes here
        // const body = await request.json(); // If you need data from body
        // adminNotes: body.adminNotes || null,
      },
    });

    console.log(`Appointment ${appointmentId} rejected successfully.`);

    // TODO: Trigger notification (e.g., email) to the user about the rejection

    // Return the updated appointment details with a 200 status code.
    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (error) {
    console.error(`Error rejecting appointment with ID ${appointmentId}:`, error);
     // Handle case where appointment is not found or not pending
     if (error instanceof Error && error.message.includes('Record to update not found')) {
       return new NextResponse('Appointment not found or not pending', { status: 404 });
     }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
