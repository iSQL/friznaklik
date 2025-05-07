// src/app/api/appointments/[id]/cancel/route.ts

import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication
import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility

// Handles PUT requests to /api/appointments/:id/cancel
// This allows a user to cancel their specific appointment.
export async function PUT(
    request: Request, // The request object
    { params }: { params: { id: string } } // Destructure 'id' from params
) {
  // 1. Authentication
  const { userId } = await auth(); // User must be logged in to cancel their appointment
  if (!userId) {
    console.log('PUT /api/appointments/[id]/cancel: User not authenticated, returning 401');
    return new NextResponse('Unauthorized', { status: 401 });
  }
  console.log('PUT /api/appointments/[id]/cancel: Clerk userId:', userId);

  // 2. Get appointmentId from params
  const appointmentId = params.id; // Directly use the id from params

  if (!appointmentId) {
    // This case should ideally not be hit if the route is matched correctly by Next.js,
    // as `params.id` would be populated from the URL segment.
    // However, adding a check for robustness.
    console.log('PUT /api/appointments/[id]/cancel: Appointment ID is missing from params, returning 400');
    return new NextResponse('Bad Request: Appointment ID is missing', { status: 400 });
  }
  console.log(`PUT /api/appointments/${appointmentId}/cancel: Request received for ID`);


  // 3. Data Update Logic
  try {
    // Find the database user ID based on the Clerk userId
    const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }, // Only fetch the database user ID
    });

    if (!dbUser) {
        console.error(`PUT /api/appointments/${appointmentId}/cancel: Database user not found for clerkId:`, userId);
        // This indicates a mismatch between Clerk and your DB - webhook is crucial
        return new NextResponse('User not found in database', { status: 404 });
    }
    console.log(`PUT /api/appointments/${appointmentId}/cancel: Database userId: ${dbUser.id}`);

    // Update the appointment status to 'cancelled' in the database
    // Crucially, ensure the appointment belongs to the authenticated user AND is not already cancelled/completed
    const updatedAppointment = await prisma.appointment.update({
      where: {
          id: appointmentId,
          userId: dbUser.id, // Ensure the appointment belongs to the logged-in user
          status: {           // Only allow cancellation if status is pending or approved
              in: ['pending', 'approved']
          }
      },
      data: {
        status: 'cancelled',
        // Optionally add a cancellation timestamp or notes
      },
    });

    console.log(`Appointment ${appointmentId} cancelled successfully.`);

    // TODO: Optional: Trigger notification (e.g., email) to admin about the cancellation

    // Return the updated appointment details with a 200 status code.
    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (error) { 
    console.error(`Error cancelling appointment with ID ${appointmentId}:`, error);

     // Handle case where appointment is not found, doesn't belong to user, or is not in a cancellable status
     // Prisma's `update` throws an error (P2025 by default) if the record to update is not found based on the `where` clause.
     if (error instanceof Error && (error as any).code === 'P2025') { // Check for Prisma's specific error code for "Record to update not found"
       console.log(`PUT /api/appointments/${appointmentId}/cancel: Appointment not found, does not belong to user, or is not in a cancellable status.`);
       return new NextResponse('Appointment not found, does not belong to you, or cannot be cancelled.', { status: 404 });
     }
     console.log(`PUT /api/appointments/${appointmentId}/cancel: Unexpected internal server error during cancellation.`);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
