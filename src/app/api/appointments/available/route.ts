import { NextRequest, NextResponse } from 'next/server';
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
    setMilliseconds,
} from 'date-fns';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import { AppointmentStatus, VendorStatus } from '@prisma/client'; 

const BASE_SLOT_INTERVAL = 15; 

// Helper funkcija za parsiranje radnog vremena iz JSON-a
function getBusinessHoursForDay(operatingHours: any, date: Date): { open: Date, close: Date } | null {
    if (!operatingHours || typeof operatingHours !== 'object') {
        console.log('Nema definisanog radnog vremena za salon.');
        return null;
    }

    const dayOfWeek = format(date, 'eeee').toLowerCase(); // npr. 'monday'
    const hoursForDay = operatingHours[dayOfWeek];

    if (!hoursForDay || !hoursForDay.open || !hoursForDay.close) {
        console.log(`Salon ne radi na dan: ${dayOfWeek}`);
        return null;
    }

    try {
        const [openHour, openMinute] = hoursForDay.open.split(':').map(Number);
        const [closeHour, closeMinute] = hoursForDay.close.split(':').map(Number);

        if (isNaN(openHour) || isNaN(openMinute) || isNaN(closeHour) || isNaN(closeMinute)) {
            console.error('Neispravan format vremena u operatingHours:', hoursForDay);
            return null;
        }
        
        const openTime = setMilliseconds(setSeconds(setMinutes(setHours(startOfDay(date), openHour), openMinute), 0), 0);
        const closeTime = setMilliseconds(setSeconds(setMinutes(setHours(startOfDay(date), closeHour), closeMinute), 0), 0);
        
        return { open: openTime, close: closeTime };

    } catch (e) {
        console.error('Greška pri parsiranju radnog vremena:', e);
        return null;
    }
}


export async function GET(request: NextRequest) {

    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ message: 'Neautorizovan pristup.' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const serviceId = searchParams.get('serviceId');
        const dateString = searchParams.get('date'); // Datum u formatu YYYY-MM-DD
        const vendorId = searchParams.get('vendorId');


        if (!serviceId || !dateString || !vendorId) {
            return NextResponse.json({ message: 'Nedostaju obavezni parametri: serviceId, date, vendorId.' }, { status: 400 });
        }

        let selectedDate = parseISO(dateString);
        if (!isValid(selectedDate)) {
            return NextResponse.json({ message: 'Neispravan format datuma. Očekivani format je YYYY-MM-DD.' }, { status: 400 });
        }
        selectedDate = startOfDay(selectedDate);

        const vendor = await prisma.vendor.findUnique({
            where: { id: vendorId },
            select: { operatingHours: true, status: true, name: true }
        });

        if (!vendor) {
            return NextResponse.json({ message: 'Traženi salon nije pronađen.' }, { status: 404 });
        }

        if (vendor.status !== VendorStatus.ACTIVE) { // Koristimo enum
            return NextResponse.json({ availableSlots: [], message: `Salon "${vendor.name}" trenutno nije aktivan.` }, { status: 200 }); 
        }
        
        const businessHours = getBusinessHoursForDay(vendor.operatingHours, selectedDate);
        if (!businessHours) {
            return NextResponse.json({ availableSlots: [], message: `Salon ne radi na odabrani dan (${format(selectedDate, 'dd.MM.yyyy')}) ili radno vreme nije podešeno.` }, { status: 200 });
        }
        const { open: businessStartTime, close: businessEndTime } = businessHours;

        const service = await prisma.service.findUnique({
            where: { 
                id: serviceId, 
                vendorId: vendorId, 
                active: true      
            }, 
            select: { duration: true, name: true },
        });

        if (!service) {
            return NextResponse.json({ message: 'Aktivna usluga nije pronađena ili ne pripada odabranom salonu.' }, { status: 404 });
        }
        const serviceDuration = service.duration;

        const dayStartQuery = startOfDay(selectedDate);
        const dayEndQuery = endOfDay(selectedDate);

        const existingAppointments = await prisma.appointment.findMany({
            where: {
                vendorId: vendorId,
                OR: [
                    { startTime: { gte: dayStartQuery, lt: dayEndQuery } },
                    { endTime: { gt: dayStartQuery, lte: dayEndQuery } },
                    { startTime: { lt: dayStartQuery }, endTime: { gt: dayEndQuery } }
                ],
                status: {
                    in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
                },
            },
            select: { startTime: true, endTime: true },
        });

        const availableSlots: string[] = [];
        let potentialSlotStart = businessStartTime;
        const now = new Date();

        while (isBefore(potentialSlotStart, businessEndTime)) {
            const potentialSlotEnd = addMinutes(potentialSlotStart, serviceDuration);

            if (isBefore(businessEndTime, potentialSlotEnd)) {
                break;
            }

            const isPastSlot = isBefore(potentialSlotStart, now);
            if (isPastSlot) {
                potentialSlotStart = addMinutes(potentialSlotStart, BASE_SLOT_INTERVAL);
                continue;
            }

            const isOverlap = existingAppointments.some(appointment =>
                isBefore(potentialSlotStart, appointment.endTime) && isBefore(appointment.startTime, potentialSlotEnd)
            );

            if (!isOverlap) {
                availableSlots.push(format(potentialSlotStart, 'HH:mm'));
            }

            potentialSlotStart = addMinutes(potentialSlotStart, BASE_SLOT_INTERVAL);
        }

        return NextResponse.json({ availableSlots }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ message: 'Interna greška servera.' }, { status: 500 });
    }
}
