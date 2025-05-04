// src/app/api/admin/services/[id]/route.ts

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

// Handles GET requests to /api/admin/services/:id
// This will fetch a single service by its ID.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  // Check authentication status using Clerk
  const { userId } = await auth(); // Added await here

  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Check if the authenticated user is an admin
  const isAdmin = await isAdminUser(userId);

  if (!isAdmin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Get the service ID from the dynamic route parameters
  const serviceId = params.id;

  try {
    // Find the service by its ID using Prisma
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    // If the service is not found, return a 404 Not Found response.
    if (!service) {
      return new NextResponse('Service not found', { status: 404 });
    }

    // Return the service as a JSON response with a 200 status code.
    return NextResponse.json(service, { status: 200 });
  } catch (error) {
    console.error(`Error fetching service with ID ${serviceId}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Handles PUT requests to /api/admin/services/:id
// This will update a single service by its ID.
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  // Check authentication status using Clerk
  const { userId } = await auth(); // Added await here

  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Check if the authenticated user is an admin
  const isAdmin = await isAdminUser(userId);

  if (!isAdmin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Get the service ID from the dynamic route parameters
  const serviceId = params.id;

  try {
    // Parse the request body to get the updated service data
    const body = await request.json();
    const { name, description, duration, price } = body;

    // Basic validation
     if (!name || typeof duration !== 'number' || typeof price !== 'number') {
      return new NextResponse('Invalid request body', { status: 400 });
    }

    // Update the service in the database using Prisma
    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: {
        name,
        description,
        duration,
        price,
      },
    });

    // Return the updated service as a JSON response with a 200 status code.
    return NextResponse.json(updatedService, { status: 200 });
  } catch (error) {
    console.error(`Error updating service with ID ${serviceId}:`, error);
    // Handle case where service is not found during update
     if (error instanceof Error && error.message.includes('Record to update not found')) {
       return new NextResponse('Service not found', { status: 404 });
     }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Handles DELETE requests to /api/admin/services/:id
// This will delete a single service by its ID.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  console.log(`DELETE /api/admin/services/${params.id}: Request received`); // Debug log
  // Log incoming request headers for DELETE
  console.log('DELETE /api/admin/services/[id]: Request Headers:', Object.fromEntries(request.headers.entries())); // Debug log
  console.log('DELETE /api/admin/services/[id]: Cookie Header:', request.headers.get('cookie')); // Debug log


  // Check authentication status using Clerk
  const { userId } = await auth(); // Added await here
  console.log('DELETE /api/admin/services/[id]: Clerk userId:', userId); // Debug log


  if (!userId) {
    console.log('DELETE /api/admin/services/[id]: User not authenticated, returning 401'); // Debug log
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Check if the authenticated user is an admin
  const isAdmin = await isAdminUser(userId);
   console.log('DELETE /api/admin/services/[id]: isAdmin:', isAdmin); // Debug log


  if (!isAdmin) {
     console.log('DELETE /api/admin/services/[id]: User is not admin, returning 403'); // Debug log
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Get the service ID from the dynamic route parameters
  const serviceId = params.id;
   console.log(`DELETE /api/admin/services/${serviceId}: User is admin, attempting to delete...`); // Debug log


  try {
    // --- Check for related appointments before deleting the service ---
    console.log(`DELETE /api/admin/services/${serviceId}: Checking for related appointments...`); // Debug log
    const relatedAppointmentsCount = await prisma.appointment.count({
        where: { serviceId: serviceId },
    });

    console.log(`DELETE /api/admin/services/${serviceId}: Found ${relatedAppointmentsCount} related appointments.`); // Debug log

    if (relatedAppointmentsCount > 0) {
        // If related appointments exist, prevent deletion and return a conflict response
        console.log(`DELETE /api/admin/services/${serviceId}: Cannot delete service due to related appointments.`); // Debug log
        return new NextResponse('Cannot delete service: Related appointments exist. Please delete appointments first.', { status: 409 }); // 409 Conflict
    }
    // --- End of check ---


     console.log(`DELETE /api/admin/services/${serviceId}: No related appointments found, calling prisma.service.delete...`); // Debug log before Prisma call
    // Delete the service from the database using Prisma
    const deletedService = await prisma.service.delete({
      where: { id: serviceId },
    });

    console.log(`DELETE /api/admin/services/${serviceId}: Service deleted successfully.`); // Debug log after Prisma call

    // TODO: Trigger notification (e.g., email) to the user about the approval

    // Return the deleted service as a JSON response with a 200 status code.
    // Returning the deleted item is common practice, but you could also return a success status.
    return NextResponse.json(deletedService, { status: 200 });

  } catch (error: any) { // Catch error as 'any' to access message property
    console.error(`Error deleting service with ID ${serviceId}:`, error); // Debug log the error object
    console.error(`Error message: ${error.message}`); // Log the error message

     // Handle case where service is not found during delete (if it wasn't caught by related appointments check)
     if (error.message && error.message.includes('Record to delete not found')) { // Check error message property
       console.log(`DELETE /api/admin/services/${serviceId}: Service not found for deletion.`); // Debug log
       return new NextResponse('Service not found', { status: 404 });
     }
     console.log(`DELETE /api/admin/services/${serviceId}: Unexpected internal server error during deletion.`); // Debug log
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
