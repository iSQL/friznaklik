import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    parseISO,
    format,
    addMinutes,
    isBefore,
    startOfDay,
    endOfDay,
    isValid,
    setHours, 
    setMinutes,
    setSeconds,
    setMilliseconds
} from 'date-fns';
import { auth } from '@clerk/nextjs/server'; 

const BUSINESS_START_HOUR = 9; 
const BUSINESS_END_HOUR = 17; 
const BASE_SLOT_INTERVAL = 15;
const DEFAULT_VENDOR_ID =  "cmao5ay1d0001hm2kji2qrltf" //FrizNaKlik vendor ID

export async function GET(request: Request) {
  console.log('GET /api/appointments/available: Request received');

   const { userId } = await auth(); 
   if (!userId) {
       console.log('GET /api/appointments/available: User not authenticated');
       return new NextResponse('Unauthorized', { status: 401 });
   }
   console.log('GET /api/appointments/available: User authenticated:', userId);

  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const dateString = searchParams.get('date'); // Date received as YYYY-MM-DD string

    console.log('GET /api/appointments/available: serviceId:', serviceId, 'dateString:', dateString);

    if (!serviceId || !dateString) {
      console.log('GET /api/appointments/available: Missing serviceId or date');
      return new NextResponse('Missing serviceId or date', { status: 400 });
    }

    let selectedDate = parseISO(dateString);
    if (!isValid(selectedDate)) {
       console.log('GET /api/appointments/available: Invalid date format');
       return new NextResponse('Invalid date format', { status: 400 });
    }

    selectedDate = startOfDay(selectedDate);
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { duration: true, name: true }, 
    });

    if (!service) {
       console.log('GET /api/appointments/available: Service not found');
       return new NextResponse('Service not found', { status: 404 });
    }

    const serviceDuration = service.duration; 
    console.log(`GET /api/appointments/available: Checking for service "${service.name}" with duration ${serviceDuration} minutes.`);

    const dayStart = selectedDate; 
    const dayEnd = endOfDay(selectedDate);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
         vendorId: DEFAULT_VENDOR_ID,
         startTime: {
            lt: dayEnd 
         },
         endTime: {
            gt: dayStart 
         },
         status: {
          in: ['pending', 'approved'], 
        },
      },
      select: { startTime: true, endTime: true }, 
    });

    console.log(`GET /api/appointments/available: Found ${existingAppointments.length} existing appointments for date ${dateString}:`, existingAppointments);

    const availableSlots: string[] = [];
    let potentialSlotStart = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, BUSINESS_START_HOUR), 0), 0), 0);
    const businessEndTime = setMilliseconds(setSeconds(setMinutes(setHours(selectedDate, BUSINESS_END_HOUR), 0), 0), 0);
    console.log(`GET /api/appointments/available: Business hours: ${format(potentialSlotStart, 'yyyy-MM-dd HH:mm')} - ${format(businessEndTime, 'yyyy-MM-dd HH:mm')}`);

    while (isBefore(potentialSlotStart, businessEndTime)) {
        const potentialSlotEnd = addMinutes(potentialSlotStart, serviceDuration);

        const now = new Date(); 
        console.log(`\n[Slot Check Loop] Checking Slot Start: ${format(potentialSlotStart, 'yyyy-MM-dd HH:mm')}`);
        console.log(`[Slot Check Loop] Calculated Slot End:   ${format(potentialSlotEnd, 'yyyy-MM-dd HH:mm')}`);
        console.log(`[Slot Check Loop] Business End Time:     ${format(businessEndTime, 'yyyy-MM-dd HH:mm')}`);
        console.log(`[Slot Check Loop] Current Time (Now):    ${format(now, 'yyyy-MM-dd HH:mm')}`);

        const endsAfterBusinessHours = !isBefore(potentialSlotEnd, businessEndTime) && potentialSlotEnd.getTime() !== businessEndTime.getTime();
        if (endsAfterBusinessHours) {
            console.log(`[Slot Check Loop] -> Slot ends at or after business end time. Breaking loop.`);
            break; 
        } else {
            console.log(`[Slot Check Loop] -> Slot ends within business hours.`);
        }

        const isPastSlot = isBefore(potentialSlotStart, now);
        console.log(`[Slot Check Loop] -> isBefore(potentialSlotStart, now) [${format(potentialSlotStart, 'yyyy-MM-dd HH:mm:ss')}, ${format(now, 'yyyy-MM-dd HH:mm:ss')}] resulted in: ${isPastSlot}`);
        if (isPastSlot) {
            console.log(`[Slot Check Loop] -> Slot is in the past. Skipping.`);
        } else {
             console.log(`[Slot Check Loop] -> Slot is not in the past.`);
        }

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

        potentialSlotStart = addMinutes(potentialSlotStart, BASE_SLOT_INTERVAL);
    }

    console.log('GET /api/appointments/available: Calculated available slots:', availableSlots);

    return NextResponse.json(availableSlots, { status: 200 });

  } catch (error) {
    console.error('Error fetching available slots:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
