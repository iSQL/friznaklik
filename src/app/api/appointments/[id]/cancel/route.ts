// src/app/api/appointments/[id]/cancel/route.ts

import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication
import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility

// Handles PUT requests to /api/appointments/:id/cancel
// This allows a user to cancel their specific appointment.
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  console.log(`PUT /api/appointments/${params.id}/cancel: Request received`); // Debug log

  // Check authentication status using Clerk
  const { userId } = await auth(); // User must be logged in to cancel their appointment
   console.log('PUT /api/appointments/cancel: Clerk userId:', userId); // Debug log


  if (!userId) {
    console.log('PUT /api/appointments/cancel: User not authenticated, returning 401'); // Debug log
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Get the appointment ID from the dynamic route parameters
  const appointmentId = params.id;
   console.log(`PUT /api/appointments/${appointmentId}/cancel: Attempting to cancel...`); // Debug log


  try {
    // Find the database user ID based on the Clerk userId
    const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }, // Only fetch the database user ID
    });

    if (!dbUser) {
        console.error('PUT /api/appointments/cancel: Database user not found for clerkId:', userId); // Debug log
         // This indicates a mismatch between Clerk and your DB - webhook is crucial
        return new NextResponse('User not found in database', { status: 404 });
    }

    console.log(`PUT /api/appointments/${appointmentId}/cancel: Database userId: ${dbUser.id}`); // Debug log

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

    console.log(`Appointment ${appointmentId} cancelled successfully.`); // Debug log

    // TODO: Optional: Trigger notification (e.g., email) to admin about the cancellation

    // Return the updated appointment details with a 200 status code.
    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (error: any) { // Catch error as 'any' to access message property
    console.error(`Error cancelling appointment with ID ${appointmentId}:`, error); // Debug log the error object
    console.error(`Error message: ${error.message}`); // Log the error message

     // Handle case where appointment is not found, doesn't belong to user, or is not in a cancellable status
     if (error.message && error.message.includes('Record to update not found')) { // Check error message property
       console.log(`PUT /api/appointments/cancel: Appointment not found, does not belong to user, or is not cancellable.`); // Debug log
       return new NextResponse('Appointment not found, does not belong to you, or cannot be cancelled.', { status: 404 }); // Use 404 or 403
     }
     console.log(`PUT /api/appointments/cancel: Unexpected internal server error during cancellation.`); // Debug log
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
