// src/app/api/appointments/my/route.ts

import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication
import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility

// Handles GET requests to /api/appointments/my
// This will fetch appointments for the currently logged-in user.
export async function GET(request: Request) {
  console.log('GET /api/appointments/my: Request received'); // Debug log

  // Check authentication status using Clerk
  const { userId } = await auth(); // User must be logged in to fetch their appointments
   console.log('GET /api/appointments/my: Clerk userId:', userId); // Debug log


  if (!userId) {
    console.log('GET /api/appointments/my: User not authenticated, returning 401'); // Debug log
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Find the database user ID based on the Clerk userId
    const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }, // Only fetch the database user ID
    });

    if (!dbUser) {
        console.error('GET /api/appointments/my: Database user not found for clerkId:', userId); // Debug log
         // This indicates a mismatch between Clerk and your DB - webhook is crucial
        return new NextResponse('User not found in database', { status: 404 });
    }

    console.log(`GET /api/appointments/my: Fetching appointments for database userId: ${dbUser.id}`); // Debug log

    // Fetch appointments for the found database user
    const userAppointments = await prisma.appointment.findMany({
      where: {
        userId: dbUser.id, // Filter appointments by the database user ID
      },
      include: {
        service: true, // Include related Service data for display
      },
      orderBy: {
        startTime: 'asc', // Order appointments by start time
      },
    });

    console.log(`GET /api/appointments/my: Found ${userAppointments.length} user appointments.`); // Debug log


    // Return the user's appointments as a JSON response with a 200 status code.
    return NextResponse.json(userAppointments, { status: 200 });

  } catch (error) {
    console.error('Error fetching user appointments:', error); // Debug log
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Note: POST, PUT, DELETE operations for user appointments might be handled differently
// depending on your requirements (e.g., user cancellation, admin changes).
