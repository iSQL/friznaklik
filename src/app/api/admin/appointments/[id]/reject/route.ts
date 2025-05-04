// src/app/api/admin/appointments/[id]/reject/route.ts

import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication
import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility

// Helper function to check if the authenticated user is an admin
// (Copied from other admin route handlers - consider moving to shared utility later)
async function isAdminUser(userId: string): Promise<boolean> {
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  });
  return dbUser?.role === 'admin';
}

// Handles PUT requests to /api/admin/appointments/:id/reject
// This will reject a specific appointment by its ID.
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  console.log(`PUT /api/admin/appointments/${params.id}/reject: Request received`); // Debug log

  // Check authentication status using Clerk
  const { userId } = await auth(); // Admin must be logged in

  if (!userId) {
    console.log('PUT /api/admin/appointments/reject: User not authenticated, returning 401'); // Debug log
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Check if the authenticated user is an admin
  const isAdmin = await isAdminUser(userId);

  if (!isAdmin) {
    console.log('PUT /api/admin/appointments/reject: User is not admin, returning 403'); // Debug log
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Get the appointment ID from the dynamic route parameters
  const appointmentId = params.id;
   console.log(`PUT /api/admin/appointments/${appointmentId}/reject: User is admin, attempting to reject...`); // Debug log


  try {
    // Update the appointment status to 'rejected' in the database
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId, status: 'pending' }, // Only update if status is pending
      data: {
        status: 'rejected',
        // TODO: Optionally add admin user ID or rejection reason notes here
        // const body = await request.json();
        // adminNotes: body.adminNotes || null,
      },
    });

    console.log(`Appointment ${appointmentId} rejected successfully.`); // Debug log

    // TODO: Trigger notification (e.g., email) to the user about the rejection

    // Return the updated appointment details with a 200 status code.
    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (error) {
    console.error(`Error rejecting appointment with ID ${appointmentId}:`, error); // Debug log
     // Handle case where appointment is not found or not pending
     if (error instanceof Error && error.message.includes('Record to update not found')) {
       return new NextResponse('Appointment not found or not pending', { status: 404 });
     }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
