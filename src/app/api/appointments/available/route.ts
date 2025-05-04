// src/app/api/appointments/available/route.ts

import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility
// Import date-fns for date manipulation
import { parseISO, format, addMinutes, isBefore, startOfDay, endOfDay, isValid } from 'date-fns'; // Added isValid


// Define standard operating hours (e.g., 9 AM to 5 PM)
// In a real app, this might come from a database or configuration
const BUSINESS_START_HOUR = 9; // 9 AM
const BUSINESS_END_HOUR = 17; // 5 PM (exclusive, so last slot starts before 5 PM)
const BASE_SLOT_DURATION = 30; // Base slot duration in minutes

// Handles GET requests to /api/appointments/available
// Receives serviceId and date as query parameters
export async function GET(request: Request) {
  console.log('GET /api/appointments/available: Request received'); // Debug log

  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const dateString = searchParams.get('date'); // Date received as YYYY-MM-DD string

    console.log('GET /api/appointments/available: serviceId:', serviceId, 'dateString:', dateString); // Debug log

    // Basic validation for query parameters
    if (!serviceId || !dateString) {
      console.log('GET /api/appointments/available: Missing serviceId or date'); // Debug log
      return new NextResponse('Missing serviceId or date', { status: 400 });
    }

    // Parse the date string into a Date object
    const selectedDate = parseISO(dateString);

    // Validate the parsed date
    if (!isValid(selectedDate)) { // Use isValid from date-fns
       console.log('GET /api/appointments/available: Invalid date format'); // Debug log
       return new NextResponse('Invalid date format', { status: 400 });
    }

    // Removed the check: if (isBefore(selectedDate, today))
    // The check for past slots is handled within the loop below.


    // Fetch the selected service to get its duration
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { duration: true }, // Only fetch duration
    });

    // If service not found
    if (!service) {
       console.log('GET /api/appointments/available: Service not found'); // Debug log
       return new NextResponse('Service not found', { status: 404 });
    }

    const serviceDuration = service.duration;

    // Fetch existing appointments for the selected date
    // Consider 'pending' and 'approved' appointments as booked slots
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        startTime: {
          gte: startOfDay(selectedDate), // Appointments starting from the beginning of the day
          lt: endOfDay(selectedDate),   // Appointments ending before the end of the day
        },
        status: {
          in: ['pending', 'approved'], // Only consider pending and approved appointments
        },
      },
      select: { startTime: true, endTime: true }, // Only fetch start and end times
    });

    console.log('GET /api/appointments/available: Existing appointments for date:', existingAppointments); // Debug log

    // --- Calculate Available Slots ---
    const availableSlots: string[] = [];
    let currentTime = new Date(selectedDate); // Start from the selected date's beginning

    // Set the start time for checking slots based on business hours
    currentTime.setHours(BUSINESS_START_HOUR, 0, 0, 0);

    // Set the end time for checking slots based on business hours
    const businessEndTime = new Date(selectedDate);
    businessEndTime.setHours(BUSINESS_END_HOUR, 0, 0, 0);

    // Iterate through potential slots within business hours
    while (isBefore(addMinutes(currentTime, serviceDuration), businessEndTime)) {
      const slotStartTime = new Date(currentTime);
      const slotEndTime = addMinutes(slotStartTime, serviceDuration);

      // Check for overlaps with existing appointments
      const isOverlap = existingAppointments.some(appointment => {
        // An overlap occurs if the new slot starts before an existing one ends AND ends after an existing one starts
        return (
          isBefore(slotStartTime, appointment.endTime) &&
          isBefore(appointment.startTime, slotEndTime)
        );
      });

      // Check if the slot start time is in the past (relative to the current time)
      const now = new Date();
      const isPastSlot = isBefore(slotStartTime, now);


      // If there is no overlap and the slot is not in the past, add it to available slots
      if (!isOverlap && !isPastSlot) {
        availableSlots.push(format(slotStartTime, 'HH:mm')); // Format time as HH:mm
      }

      // Move to the next slot (increment by base slot duration, or service duration if preferred)
      // Incrementing by base slot duration (30 min) checks all possible start times.
      // Incrementing by service duration is simpler but might leave gaps.
      // Incrementing by base slot duration (30 min) checks all possible start times.
      currentTime = addMinutes(currentTime, BASE_SLOT_DURATION); // Increment by base slot duration
    }

    console.log('GET /api/appointments/available: Calculated available slots:', availableSlots); // Debug log


    // Return the calculated available slots
    return NextResponse.json(availableSlots, { status: 200 });

  } catch (error) {
    console.error('Error fetching available slots:', error); // Debug log
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
