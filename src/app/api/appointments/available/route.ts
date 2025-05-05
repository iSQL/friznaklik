// src/app/api/appointments/available/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Import date-fns for date manipulation
import {
    parseISO,
    format,
    addMinutes,
    isBefore,
    startOfDay,
    endOfDay,
    isValid,
    setHours, // Added for setting business hours start/end
    setMinutes,
    setSeconds,
    setMilliseconds
} from 'date-fns';
import { auth } from '@clerk/nextjs/server'; // Import auth for security

// Define standard operating hours (e.g., 9 AM to 5 PM)
const BUSINESS_START_HOUR = 9; // 9 AM
const BUSINESS_END_HOUR = 17; // 5 PM (exclusive, last slot must *end* by 5 PM)
const BASE_SLOT_INTERVAL = 30; // Check for potential start times every 30 minutes

// Handles GET requests to /api/appointments/available
// Receives serviceId and date as query parameters
export async function GET(request: Request) {
  console.log('GET /api/appointments/available: Request received');

   // --- Authentication Check ---
   const { userId } = await auth(); // Added await
   if (!userId) {
       console.log('GET /api/appointments/available: User not authenticated');
       return new NextResponse('Unauthorized', { status: 401 });
   }
   console.log('GET /api/appointments/available: User authenticated:', userId);
   // --- End Authentication Check ---


  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const dateString = searchParams.get('date'); // Date received as YYYY-MM-DD string

    console.log('GET /api/appointments/available: serviceId:', serviceId, 'dateString:', dateString);

    // Basic validation for query parameters
    if (!serviceId || !dateString) {
      console.log('GET /api/appointments/available: Missing serviceId or date');
      return new NextResponse('Missing serviceId or date', { status: 400 });
    }

    // Parse the date string into a Date object
    let selectedDate = parseISO(dateString);

    // Validate the parsed date
    if (!isValid(selectedDate)) {
       console.log('GET /api/appointments/available: Invalid date format');
       return new NextResponse('Invalid date format', { status: 400 });
    }
    // Ensure we use the start of the selected day for calculations
    selectedDate = startOfDay(selectedDate);


    // Fetch the selected service to get its duration
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { duration: true, name: true }, // Fetch duration and name
    });

    // If service not found
    if (!service) {
       console.log('GET /api/appointments/available: Service not found');
       return new NextResponse('Service not found', { status: 404 });
    }

    const serviceDuration = service.duration; // Duration in minutes
    console.log(`GET /api/appointments/available: Checking for service "${service.name}" with duration ${serviceDuration} minutes.`);


    // Fetch existing appointments for the selected date that are confirmed or pending
    const dayStart = selectedDate; // Already startOfDay
    const dayEnd = endOfDay(selectedDate);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
         // Check for appointments that overlap with the selected day
         startTime: {
            lt: dayEnd // Starts before the end of the selected day
         },
         endTime: {
            gt: dayStart // Ends after the start of the selected day
         },
         status: {
          in: ['pending', 'approved'], // Only consider pending and approved appointments
        },
      },
      select: { startTime: true, endTime: true }, // Only fetch start and end times
    });

    console.log(`GET /api/appointments/available: Found ${existingAppointments.length} existing appointments for date ${dateString}:`, existingAppointments);


    // --- Calculate Available Slots ---
    const availableSlots: string[] = [];

    // Set the start time for checking slots based on business hours
    let potentialSlotStart = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, BUSINESS_START_HOUR), 0), 0), 0);

    // Set the absolute end time for the business day
    const businessEndTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, BUSINESS_END_HOUR), 0), 0), 0);

    console.log(`GET /api/appointments/available: Business hours: ${format(potentialSlotStart, 'yyyy-MM-dd HH:mm')} - ${format(businessEndTime, 'yyyy-MM-dd HH:mm')}`);


    // Iterate through potential start times within business hours
    while (isBefore(potentialSlotStart, businessEndTime)) {
        // Calculate the potential end time based on the specific service duration
        const potentialSlotEnd = addMinutes(potentialSlotStart, serviceDuration);

        // *** Debug Logging Start ***
        const now = new Date(); // Get current time for comparison
        console.log(`\n[Slot Check Loop] Checking Slot Start: ${format(potentialSlotStart, 'yyyy-MM-dd HH:mm')}`);
        console.log(`[Slot Check Loop] Calculated Slot End:   ${format(potentialSlotEnd, 'yyyy-MM-dd HH:mm')}`);
        console.log(`[Slot Check Loop] Business End Time:     ${format(businessEndTime, 'yyyy-MM-dd HH:mm')}`);
        console.log(`[Slot Check Loop] Current Time (Now):    ${format(now, 'yyyy-MM-dd HH:mm')}`);

        // Check end time condition
        const endsAfterBusinessHours = !isBefore(potentialSlotEnd, businessEndTime) && potentialSlotEnd.getTime() !== businessEndTime.getTime();
        if (endsAfterBusinessHours) {
            console.log(`[Slot Check Loop] -> Slot ends at or after business end time. Breaking loop.`);
            break; // Exit the loop
        } else {
            console.log(`[Slot Check Loop] -> Slot ends within business hours.`);
        }

        // Check if past
        const isPastSlot = isBefore(potentialSlotStart, now);
        // *** More explicit logging for isPastSlot check ***
        console.log(`[Slot Check Loop] -> isBefore(potentialSlotStart, now) [${format(potentialSlotStart, 'yyyy-MM-dd HH:mm:ss')}, ${format(now, 'yyyy-MM-dd HH:mm:ss')}] resulted in: ${isPastSlot}`);
        if (isPastSlot) {
            console.log(`[Slot Check Loop] -> Slot is in the past. Skipping.`);
        } else {
             console.log(`[Slot Check Loop] -> Slot is not in the past.`);
        }

        // Check overlap (only if not past)
        let isOverlap = false;
        if (!isPastSlot) {
            isOverlap = existingAppointments.some(appointment => {
                const overlap = isBefore(potentialSlotStart, appointment.endTime) && isBefore(appointment.startTime, potentialSlotEnd);
                // if (overlap) { // Keep commented unless needed for intense debugging
                //     console.log(`[Slot Check Loop] -> Overlap detected with existing appointment: ${format(appointment.startTime, 'HH:mm')}-${format(appointment.endTime, 'HH:mm')}.`);
                // }
                return overlap;
            });
             if (isOverlap) {
                 console.log(`[Slot Check Loop] -> Overlap found. Skipping.`);
             } else {
                  console.log(`[Slot Check Loop] -> No overlap found.`);
             }
        }

        // Add if valid
        if (!isOverlap && !isPastSlot) {
            availableSlots.push(format(potentialSlotStart, 'HH:mm'));
            console.log(`[Slot Check Loop] -> SUCCESS: Added available slot: ${format(potentialSlotStart, 'HH:mm')}`);
        } else {
             console.log(`[Slot Check Loop] -> SKIPPED: Slot not added (Past: ${isPastSlot}, Overlap: ${isOverlap}).`);
        }
         // *** Debug Logging End ***


        // Move to the next potential start time based on the base interval
        potentialSlotStart = addMinutes(potentialSlotStart, BASE_SLOT_INTERVAL);
    }


    console.log('GET /api/appointments/available: Calculated available slots:', availableSlots);


    // Return the calculated available slots
    return NextResponse.json(availableSlots, { status: 200 });

  } catch (error) {
    console.error('Error fetching available slots:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
