// src/app/api/appointments/available/route.ts
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
// Ensure Enums are imported from your custom path if they exist there
import { AppointmentStatus, VendorStatus } from '@/lib/types/prisma-enums';
import { Prisma } from '@prisma/client'; // Worker type not needed here directly

const BASE_SLOT_INTERVAL = 15; // Or your desired slot interval

interface WorkerInfo {
    id: string;
    name: string | null;
}
interface SlotWithWorkers {
    time: string;
    availableWorkers: WorkerInfo[];
}

function getBusinessHoursForDay(operatingHours: any, date: Date): { open: Date, close: Date } | null {
    if (!operatingHours || typeof operatingHours !== 'object') {
        return null;
    }
    const dayOfWeek = format(date, 'eeee').toLowerCase(); // e.g., 'monday'
    const hoursForDay = operatingHours[dayOfWeek];

    if (!hoursForDay || !hoursForDay.open || !hoursForDay.close) {
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
    console.log("--- /api/appointments/available (Phase 3 Updated) ---");
    const user: AuthenticatedUser | null = await getCurrentUser(); // Assuming this route is protected
    if (!user) {
        return NextResponse.json({ message: 'Neautorizovan pristup.' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const serviceId = searchParams.get('serviceId');
        const dateString = searchParams.get('date');
        const vendorId = searchParams.get('vendorId');

        console.log(`Params: serviceId=${serviceId}, dateString=${dateString}, vendorId=${vendorId}`);

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
            select: {
                operatingHours: true,
                status: true,
                name: true,
                workers: { // Fetch all workers and their assigned services
                    select: {
                        id: true,
                        name: true,
                        services: { // Services this worker can perform
                            where: { active: true }, // Only consider active services
                            select: { id: true }
                        }
                    }
                }
            }
        });

        if (!vendor) {
            return NextResponse.json({ message: 'Traženi salon nije pronađen.' }, { status: 404 });
        }
        if (vendor.status !== VendorStatus.ACTIVE) {
            return NextResponse.json({ availableSlots: [], message: `Salon "${vendor.name}" trenutno nije aktivan.` }, { status: 200 });
        }

        // Filter workers who can perform the selected service
        const qualifiedWorkers = vendor.workers.filter(worker =>
            worker.services.some(s => s.id === serviceId)
        );

        if (qualifiedWorkers.length === 0) {
            return NextResponse.json({ availableSlots: [], message: `Nema dostupnih radnika u salonu "${vendor.name}" koji mogu da izvrše odabranu uslugu.` }, { status: 200 });
        }
        console.log(`Qualified workers for service ${serviceId}: ${qualifiedWorkers.length}`, qualifiedWorkers.map(w=>w.name));


        const businessHours = getBusinessHoursForDay(vendor.operatingHours, selectedDate);
        if (!businessHours) {
            return NextResponse.json({ availableSlots: [], message: `Salon ne radi na odabrani dan (${format(selectedDate, 'dd.MM.yyyy')}) ili radno vreme nije podešeno.` }, { status: 200 });
        }
        
        const service = await prisma.service.findUnique({
            where: { id: serviceId, vendorId: vendorId, active: true },
            select: { duration: true, name: true },
        });

        if (!service) {
            // This check might be redundant if qualifiedWorkers logic implies service existence, but good for safety.
            return NextResponse.json({ message: 'Aktivna usluga nije pronađena ili ne pripada odabranom salonu.' }, { status: 404 });
        }
        const serviceDuration = service.duration;

        const dayStartQuery = startOfDay(selectedDate);
        const dayEndQuery = endOfDay(selectedDate);

        const existingAppointments = await prisma.appointment.findMany({
            where: {
                vendorId: vendorId,
                startTime: { gte: dayStartQuery, lt: dayEndQuery },
                status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
                workerId: { in: qualifiedWorkers.map(w => w.id) } // Only consider appointments of qualified workers
            },
            select: { startTime: true, endTime: true, workerId: true },
        });
        console.log(`Existing appointments for qualified workers on ${dateString}: ${existingAppointments.length}`);

        const availableSlotsWithWorkers: SlotWithWorkers[] = [];
        let potentialSlotStart = businessHours.open;
        const now = new Date(); // Ensure appointments are not in the past

        while (isBefore(potentialSlotStart, businessHours.close)) {
            const potentialSlotEnd = addMinutes(potentialSlotStart, serviceDuration);

            if (isBefore(businessHours.close, potentialSlotEnd)) break;
            if (isBefore(potentialSlotStart, now)) { // Ensure slot is not in the past
                potentialSlotStart = addMinutes(potentialSlotStart, BASE_SLOT_INTERVAL);
                continue;
            }

            const freeWorkersAtThisSlot: WorkerInfo[] = [];
            // Iterate only through workers qualified for the service
            for (const worker of qualifiedWorkers) {
                const isWorkerBusy = existingAppointments.some(appointment =>
                    appointment.workerId === worker.id &&
                    isBefore(appointment.startTime, potentialSlotEnd) &&
                    isBefore(potentialSlotStart, appointment.endTime)
                );

                if (!isWorkerBusy) {
                    freeWorkersAtThisSlot.push({ id: worker.id, name: worker.name });
                }
            }

            if (freeWorkersAtThisSlot.length > 0) {
                availableSlotsWithWorkers.push({
                    time: format(potentialSlotStart, 'HH:mm'),
                    availableWorkers: freeWorkersAtThisSlot,
                });
            }
            potentialSlotStart = addMinutes(potentialSlotStart, BASE_SLOT_INTERVAL);
        }
        
        console.log(`Total available slots with worker details for ${dateString} (service ${serviceId}): ${availableSlotsWithWorkers.length}`);
        return NextResponse.json({ availableSlots: availableSlotsWithWorkers }, { status: 200 });

    } catch (error) {
        console.error('Greška pri dobavljanju dostupnih termina (Phase 3):', error);
        let errorMessage = 'Interna greška servera.';
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             errorMessage = 'Greška pri komunikaciji sa bazom podataka.';
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ message: errorMessage, details: error instanceof Error ? error.stack : null }, { status: 500 });
    }
}