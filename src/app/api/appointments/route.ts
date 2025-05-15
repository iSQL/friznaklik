import { auth } from '@clerk/nextjs/server'; 
import { NextResponse } from 'next/server'; 
import prisma from '@/lib/prisma'; 
import { parseISO, setHours, setMinutes, isValid, addMinutes, isBefore } from 'date-fns'; 

const DEFAULT_VENDOR_ID = "cmao5ay1d0001hm2kji2qrltf"
export async function POST(request: Request) {
  console.log('POST /api/appointments: Request received'); 

  const { userId } = await auth(); 
  if (!userId) {
    console.log('POST /api/appointments: User not authenticated, returning 401'); 
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const { serviceId, date: dateString, slot: slotString } = body; // dateString (YYYY-MM-DD), slotString (HH:mm)
    console.log('POST /api/appointments: Booking details:', { serviceId, dateString, slotString }); 

    if (!serviceId || !dateString || !slotString) {
      console.log('POST /api/appointments: Missing required fields in body'); 
      return new NextResponse('Missing required fields (serviceId, date, or slot)', { status: 400 });
    }

    const [hours, minutes] = slotString.split(':').map(Number);
    const selectedDate = parseISO(dateString);
    const startTime = setMinutes(setHours(selectedDate, hours), minutes);

    if (!isValid(startTime)) {
        console.log('POST /api/appointments: Invalid date or time format'); 
        return new NextResponse('Invalid date or time format', { status: 400 });
    }

    const now = new Date();
    if (isBefore(startTime, now)) { 
        console.log('POST /api/appointments: Cannot book in the past'); 
        return new NextResponse('Cannot book appointments in the past', { status: 400 });
    }

    const service = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { duration: true },
    });

    if (!service) {
        console.log('POST /api/appointments: Service not found'); 
        return new NextResponse('Service not found', { status: 404 });
    }

    const endTime = addMinutes(startTime, service.duration);

    const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true },
    });

    if (!dbUser) {
        console.error('POST /api/appointments: Database user not found for clerkId:', userId); 
        return new NextResponse('User not found in database', { status: 404 });
    }

    const newAppointment = await prisma.appointment.create({
      data: {
        vendorId: DEFAULT_VENDOR_ID,
        userId: dbUser.id, 
        serviceId: serviceId,
        startTime: startTime,
        endTime: endTime,
        status: 'pending',
      },
    });

    console.log('POST /api/appointments: Pending appointment created:', newAppointment); 
    return NextResponse.json(newAppointment, { status: 201 });

  } catch (error) {
    console.error('Error creating appointment:', error); 
    // TODO: Handle specific errors, e.g., unique constraint violation if re-checking availability
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
