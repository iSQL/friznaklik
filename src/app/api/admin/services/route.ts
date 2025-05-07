// src/app/api/admin/services/route.ts

console.log('--- Loading /api/admin/services/route.ts ---'); // Debug log at the top of the file

import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication
import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility
import { isAdminUser } from '@/lib/authUtils'; // Import the centralized isAdminUser function

// Handles GET requests to /api/admin/services
// This will fetch all services from the database.
export async function GET(request: Request) {
  console.log('GET /api/admin/services: Request received'); // Debug log - Indicates the handler was hit

  // Log incoming request headers
  console.log('GET /api/admin/services: Request Headers:', Object.fromEntries(request.headers.entries())); // Debug log - Log all headers
  console.log('GET /api/admin/services: Cookie Header:', request.headers.get('cookie')); // Debug log - Specifically log the Cookie header


  // Check authentication status using Clerk
  const { userId } = await auth(); 
  console.log('GET /api/admin/services: Clerk userId:', userId); // Debug log - Shows the Clerk User ID from authentication


  // If no user ID is found, the user is not authenticated.
  if (!userId) {
    console.log('GET /api/admin/services: User not authenticated'); // Debug log
    // Return an Unauthorized response.
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Check if the authenticated user is an admin
  const isAdmin = await isAdminUser(userId);
  console.log('GET /api/admin/services: isAdmin:', isAdmin); // Debug log - Shows the final result of the admin check


  // If the user is not an admin, return a Forbidden response.
  if (!isAdmin) {
    console.log('GET /api/admin/services: User is not admin, returning 403'); // Debug log
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    console.log('GET /api/admin/services: User is admin, fetching services...'); // Debug log
    // Fetch all services from the database using Prisma
    const services = await prisma.service.findMany();
    console.log('GET /api/admin/services: Services fetched successfully'); // Debug log

    // Return the services as a JSON response with a 200 status code.
    return NextResponse.json(services, { status: 200 });
  } catch (error) {
    // Log the error for debugging purposes
    console.error('Error fetching services:', error); // Debug log
    // Return an Internal Server Error response.
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Handles POST requests to /api/admin/services
// This will create a new service in the database.
export async function POST(request: Request) {
   // Check authentication status using Clerk
  const { userId } = await auth(); 

  // If no user ID is found, the user is not authenticated.
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Check if the authenticated user is an admin
  const isAdmin = await isAdminUser(userId);

  // If the user is not an admin, return a Forbidden response.
  if (!isAdmin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    // Parse the request body to get the service data
    const body = await request.json();
    const { name, description, duration, price } = body;

    // Basic validation (you'll want more robust validation in a real app)
    if (!name || typeof duration !== 'number' || typeof price !== 'number') {
      return new NextResponse('Invalid request body', { status: 400 });
    }

    // Create the new service in the database using Prisma
    const newService = await prisma.service.create({
      data: {
        name,
        description,
        duration,
        price,
      },
    });

    // Return the newly created service as a JSON response with a 201 status code.
    return NextResponse.json(newService, { status: 201 });
  } catch (error) {
    // Log the error
    console.error('Error creating service:', error);
    // Return an Internal Server Error response.
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
