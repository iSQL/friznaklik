// src/app/api/appointments/route.ts

import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication
import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility
// Added 'isBefore' to the import from date-fns
import { parseISO, setHours, setMinutes, isValid, addMinutes, isBefore } from 'date-fns'; // Import date-fns for date/time manipulation

// Handles POST requests to /api/appointments
// Receives booking details (serviceId, date, slot) in the body
export async function POST(request: Request) {
  console.log('POST /api/appointments: Request received'); // Debug log

  // Check authentication status using Clerk
  const { userId } = await auth(); // User must be logged in to book

  if (!userId) {
    console.log('POST /api/appointments: User not authenticated, returning 401'); // Debug log
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Parse the request body
    const body = await request.json();
    const { serviceId, date: dateString, slot: slotString } = body; // dateString (YYYY-MM-DD), slotString (HH:mm)

    console.log('POST /api/appointments: Booking details:', { serviceId, dateString, slotString }); // Debug log

    // Basic validation for request body
    if (!serviceId || !dateString || !slotString) {
      console.log('POST /api/appointments: Missing required fields in body'); // Debug log
      return new NextResponse('Missing required fields (serviceId, date, or slot)', { status: 400 });
    }

    // Parse date and time
    const [hours, minutes] = slotString.split(':').map(Number);
    const selectedDate = parseISO(dateString);

    // Create a Date object for the start time of the appointment
    // Combine the date and the time slot
    const startTime = setMinutes(setHours(selectedDate, hours), minutes);

    // Validate the parsed date and time
    if (!isValid(startTime)) {
        console.log('POST /api/appointments: Invalid date or time format'); // Debug log
        return new NextResponse('Invalid date or time format', { status: 400 });
    }

    // Ensure the start time is not in the past
    const now = new Date();
    if (isBefore(startTime, now)) { // isBefore is now imported
        console.log('POST /api/appointments: Cannot book in the past'); // Debug log
        return new NextResponse('Cannot book appointments in the past', { status: 400 });
    }


    // Fetch the service duration to calculate the end time
    const service = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { duration: true },
    });

    if (!service) {
        console.log('POST /api/appointments: Service not found'); // Debug log
        return new NextResponse('Service not found', { status: 404 });
    }

    const endTime = addMinutes(startTime, service.duration);

    // TODO: Optional but Recommended: Re-check availability at the moment of booking
    // This prevents double bookings if two users try to book the same slot simultaneously.
    // You would re-run a check similar to the logic in /api/appointments/available
    // focusing on the specific slot being booked. If an overlap is found, return a 409 Conflict.


    // Create a new user record in your database if it doesn't exist (via webhook is better)
    // Or ensure the user exists from a previous step (like webhook or initial signup flow)
    // For now, assume the user exists in your DB with the matching clerkId
    const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }, // Get the database user ID
    });

    if (!dbUser) {
        console.error('POST /api/appointments: Database user not found for clerkId:', userId); // Debug log
         // This indicates a mismatch between Clerk and your DB - webhook is crucial
        return new NextResponse('User not found in database', { status: 404 });
    }


    // Create the new pending appointment in the database
    const newAppointment = await prisma.appointment.create({
      data: {
        userId: dbUser.id, // Use the database user ID
        serviceId: serviceId,
        startTime: startTime,
        endTime: endTime,
        status: 'pending', // New appointments are initially pending admin approval
      },
    });

    console.log('POST /api/appointments: Pending appointment created:', newAppointment); // Debug log

    // Return the newly created appointment details with a 201 status code
    return NextResponse.json(newAppointment, { status: 201 });

  } catch (error) {
    console.error('Error creating appointment:', error); // Debug log
    // TODO: Handle specific errors, e.g., unique constraint violation if re-checking availability
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
