// src/app/api/admin/services/[id]/route.ts

import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication
import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility
import { isAdminUser } from '@/lib/authUtils'; // Import the centralized isAdminUser function

// Handles GET requests to /api/admin/services/:id
// Fetches a single service by its ID.
// Uses URL parsing for serviceId
// Helper function to parse serviceId from URL
function getServiceIdFromUrl(requestUrl: string): string | undefined {
  try {
     const url = new URL(requestUrl);
     // Example URL: /api/admin/services/some-service-id
     // The ID should be the last segment
     return url.pathname.split('/').pop();
 } catch (urlError) {
     console.error('Error parsing request URL:', urlError);
     return undefined;
 }
}

export async function GET(request: Request) {
  // 1. Authentication & Authorization
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Extract serviceId from URL
  const serviceId = getServiceIdFromUrl(request.url);
  if (!serviceId) {
      return new NextResponse('Bad Request: Invalid Service ID in URL', { status: 400 });
  }
  console.log(`GET /api/admin/services/${serviceId}: Request received`);

  // 3. Admin Check
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    console.log(`GET /api/admin/services/${serviceId}: User is not admin`);
    return new NextResponse('Forbidden', { status: 403 });
  }
  console.log(`GET /api/admin/services/${serviceId}: User is admin`);

  // 4. Data Fetching
  try {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      console.log(`GET /api/admin/services/${serviceId}: Service not found`);
      return new NextResponse('Service not found', { status: 404 });
    }

    return NextResponse.json(service, { status: 200 });
  } catch (error) {
    console.error(`Error fetching service with ID ${serviceId}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Handles PUT requests to /api/admin/services/:id
// Updates a single service by its ID.
// Uses URL parsing for serviceId
export async function PUT(request: Request) {
  // 1. Authentication & Authorization
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Extract serviceId from URL
  const serviceId = getServiceIdFromUrl(request.url);
   if (!serviceId) {
      return new NextResponse('Bad Request: Invalid Service ID in URL', { status: 400 });
  }
  console.log(`PUT /api/admin/services/${serviceId}: Request received`);


  // 3. Admin Check
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
     console.log(`PUT /api/admin/services/${serviceId}: User is not admin`);
    return new NextResponse('Forbidden', { status: 403 });
  }
   console.log(`PUT /api/admin/services/${serviceId}: User is admin`);

  // 4. Process Request Body & Update Data
  try {
    const body = await request.json();
    const { name, description, duration, price } = body;

    // Basic validation
     if (!name || typeof duration !== 'number' || typeof price !== 'number') {
        console.log(`PUT /api/admin/services/${serviceId}: Invalid request body`);
        return new NextResponse('Invalid request body', { status: 400 });
    }

    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: {
        name,
        description,
        duration,
        price,
      },
    });
    console.log(`PUT /api/admin/services/${serviceId}: Service updated successfully`);
    return NextResponse.json(updatedService, { status: 200 });

  } catch (error) {
    console.error(`Error updating service with ID ${serviceId}:`, error);
     if (error instanceof Error && error.message.includes('Record to update not found')) {
         console.log(`PUT /api/admin/services/${serviceId}: Service not found for update`);
         return new NextResponse('Service not found', { status: 404 });
     }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Handles DELETE requests to /api/admin/services/:id
// Deletes a single service by its ID.
// Uses URL parsing for serviceId
export async function DELETE(request: Request) {
   // 1. Authentication & Authorization
   const { userId } = await auth();
   if (!userId) {
     return new NextResponse('Unauthorized', { status: 401 });
   }

   // 2. Extract serviceId from URL
   const serviceId = getServiceIdFromUrl(request.url);
   if (!serviceId) {
       return new NextResponse('Bad Request: Invalid Service ID in URL', { status: 400 });
   }
   console.log(`DELETE /api/admin/services/${serviceId}: Request received`);


   // 3. Admin Check
   const isAdmin = await isAdminUser(userId);
   if (!isAdmin) {
      console.log(`DELETE /api/admin/services/${serviceId}: User is not admin`);
     return new NextResponse('Forbidden', { status: 403 });
   }
    console.log(`DELETE /api/admin/services/${serviceId}: User is admin`);

   // 4. Check for Related Appointments & Delete Service
   try {
     console.log(`DELETE /api/admin/services/${serviceId}: Checking for related appointments...`);
     const relatedAppointmentsCount = await prisma.appointment.count({
         where: { serviceId: serviceId },
     });
     console.log(`DELETE /api/admin/services/${serviceId}: Found ${relatedAppointmentsCount} related appointments.`);

     if (relatedAppointmentsCount > 0) {
         console.log(`DELETE /api/admin/services/${serviceId}: Cannot delete service due to related appointments.`);
         return new NextResponse('Cannot delete service: Related appointments exist. Please delete appointments first.', { status: 409 }); // 409 Conflict
     }

     console.log(`DELETE /api/admin/services/${serviceId}: No related appointments found, calling prisma.service.delete...`);
     const deletedService = await prisma.service.delete({
       where: { id: serviceId },
     });
     console.log(`DELETE /api/admin/services/${serviceId}: Service deleted successfully.`);
     return NextResponse.json(deletedService, { status: 200 });

   } catch (error) {
     console.error(`Error deleting service with ID ${serviceId}:`, error);
     if (error instanceof Error && error.message.includes('Record to delete not found')) {
        console.log(`DELETE /api/admin/services/${serviceId}: Service not found for deletion.`);
        return new NextResponse('Service not found', { status: 404 });
      }
     return new NextResponse('Internal Server Error', { status: 500 });
   }
}
