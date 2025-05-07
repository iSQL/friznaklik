// src/app/api/admin/appointments/[id]/approve/route.ts

import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication
import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility

// Helper function to check if the authenticated user is an admin
// TODO: Consider moving this to a shared utility file (e.g., /lib/authUtils.ts)
async function isAdminUser(userId: string): Promise<boolean> {
  // Added null check for safety
  if (!userId) return false;
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  });
  return dbUser?.role === 'admin';
}

// Handles PUT requests to /api/admin/appointments/:id/approve
export async function PUT(
  request: Request, // The request object
  { params }: { params: { id: string } } // Destructure 'id' as appointmentId from params
) {
  // 1. Authentication
  const { userId } = await auth(); // Admin must be logged in

  if (!userId) {
    console.log('PUT /api/admin/appointments/[id]/approve: User not authenticated, returning 401');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Get appointmentId from params
  const appointmentId = params.id;

  if (!appointmentId) {
    // This case should ideally not be hit if the route is matched correctly by Next.js.
    console.log('PUT /api/admin/appointments/[id]/approve: Appointment ID is missing from params, returning 400');
    return new NextResponse('Bad Request: Invalid Appointment ID in URL', { status: 400 });
  }

  console.log(`PUT /api/admin/appointments/${appointmentId}/approve: Request received for ID`);

  // 3. Authorization (Admin Check)
  const isAdmin = await isAdminUser(userId);

  if (!isAdmin) {
    console.log(`PUT /api/admin/appointments/${appointmentId}/approve: User is not admin, returning 403`);
    return new NextResponse('Forbidden', { status: 403 });
  }

  console.log(`PUT /api/admin/appointments/${appointmentId}/approve: User is admin, attempting to approve...`);

  // 4. Data Update Logic
  try {
    // Update the appointment status to 'approved' in the database
    const updatedAppointment = await prisma.appointment.update({
      where: { 
        id: appointmentId, 
        status: 'pending' // Only update if status is pending
      },
      data: {
        status: 'approved',
      },
    });

    console.log(`Appointment ${appointmentId} approved successfully.`);

    // TODO: Optional: Trigger notification (e.g., email) to the user about the approval

    // Return the updated appointment details with a 200 status code.
    return NextResponse.json(updatedAppointment, { status: 200 });
  } catch (error) {
    console.error(`Error approving appointment with ID ${appointmentId}:`, error);
    // Handle case where appointment is not found or not pending
    // Prisma's `update` throws P2025 if the record to update (matching the where clause) is not found.
    if (error instanceof Error && (error as any).code === 'P2025') {
      console.log(`PUT /api/admin/appointments/${appointmentId}/approve: Appointment not found or not in 'pending' state.`);
      return new NextResponse('Appointment not found or not pending', { status: 404 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
