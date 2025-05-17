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
import { AppointmentStatus, VendorStatus, Prisma, Worker } from '@prisma/client';

const BASE_SLOT_INTERVAL = 15;

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
        // console.log('Nema definisanog radnog vremena za salon.');
        return null;
    }
    const dayOfWeek = format(date, 'eeee').toLowerCase();
    const hoursForDay = operatingHours[dayOfWeek];
    if (!hoursForDay || !hoursForDay.open || !hoursForDay.close) {
        // console.log(`Salon ne radi na dan: ${dayOfWeek}`);
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
    console.log("--- /api/appointments/available ---");
    const user: AuthenticatedUser | null = await getCurrentUser();
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
        console.log(`Selected Date (start of day): ${selectedDate.toISOString()}`);

        const vendor = await prisma.vendor.findUnique({
            where: { id: vendorId },
            select: {
                operatingHours: true,
                status: true,
                name: true,
                workers: {
                    select: { id: true, name: true },
                }
            }
        });

        if (!vendor) {
            return NextResponse.json({ message: 'Traženi salon nije pronađen.' }, { status: 404 });
        }
        console.log(`Vendor: ${vendor.name}, Status: ${vendor.status}, Workers count: ${vendor.workers.length}`);
        if (vendor.status !== VendorStatus.ACTIVE) {
            return NextResponse.json({ availableSlots: [], message: `Salon "${vendor.name}" trenutno nije aktivan.` }, { status: 200 });
        }
        if (vendor.workers.length === 0) {
            return NextResponse.json({ availableSlots: [], message: `Salon "${vendor.name}" trenutno nema definisanih radnika.` }, { status: 200 });
        }

        const businessHours = getBusinessHoursForDay(vendor.operatingHours, selectedDate);
        if (!businessHours) {
            return NextResponse.json({ availableSlots: [], message: `Salon ne radi na odabrani dan (${format(selectedDate, 'dd.MM.yyyy')}) ili radno vreme nije podešeno.` }, { status: 200 });
        }
        console.log(`Business Hours for ${format(selectedDate, 'dd.MM.yyyy')}: Open: ${businessHours.open.toISOString()}, Close: ${businessHours.close.toISOString()}`);
        
        const service = await prisma.service.findUnique({
            where: { id: serviceId, vendorId: vendorId, active: true },
            select: { duration: true, name: true },
        });

        if (!service) {
            return NextResponse.json({ message: 'Aktivna usluga nije pronađena ili ne pripada odabranom salonu.' }, { status: 404 });
        }
        const serviceDuration = service.duration;
        console.log(`Service: ${service.name}, Duration: ${serviceDuration} min`);

        const dayStartQuery = startOfDay(selectedDate);
        const dayEndQuery = endOfDay(selectedDate);

        const existingAppointments = await prisma.appointment.findMany({
            where: {
                vendorId: vendorId,
                startTime: { // Check appointments that start within the selected day
                    gte: dayStartQuery,
                    lt: dayEndQuery,
                },
                status: {
                    in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
                },
                workerId: { not: null },
            },
            select: { startTime: true, endTime: true, workerId: true },
        });
        console.log(`Existing appointments for vendor ${vendorId} on ${dateString}: ${existingAppointments.length}`, existingAppointments);

        const availableSlotsWithWorkers: SlotWithWorkers[] = [];
        let potentialSlotStart = businessHours.open;
        const now = new Date();

        console.log(`Starting slot generation. Current time: ${now.toISOString()}`);

        while (isBefore(potentialSlotStart, businessHours.close)) {
            const potentialSlotEnd = addMinutes(potentialSlotStart, serviceDuration);

            if (isBefore(businessHours.close, potentialSlotEnd)) {
                // console.log(`Slot ${format(potentialSlotStart, 'HH:mm')} - ${format(potentialSlotEnd, 'HH:mm')} ends after closing time ${format(businessHours.close, 'HH:mm')}. Breaking.`);
                break;
            }

            if (isBefore(potentialSlotStart, now)) {
                // console.log(`Slot ${format(potentialSlotStart, 'HH:mm')} is in the past. Skipping.`);
                potentialSlotStart = addMinutes(potentialSlotStart, BASE_SLOT_INTERVAL);
                continue;
            }
            // console.log(`Checking slot: ${format(potentialSlotStart, 'HH:mm')} - ${format(potentialSlotEnd, 'HH:mm')}`);

            const freeWorkersAtThisSlot: WorkerInfo[] = [];
            for (const worker of vendor.workers) {
                const isWorkerBusy = existingAppointments.some(appointment => {
                    const overlap = appointment.workerId === worker.id &&
                                  isBefore(appointment.startTime, potentialSlotEnd) &&
                                  isBefore(potentialSlotStart, appointment.endTime);
                    // if (overlap && appointment.workerId === worker.id) {
                    //     console.log(`  Worker ${worker.name} (ID: ${worker.id}) is BUSY due to appointment: ${appointment.startTime.toISOString()} - ${appointment.endTime.toISOString()}`);
                    // }
                    return overlap;
                });

                if (!isWorkerBusy) {
                    // console.log(`  Worker ${worker.name} (ID: ${worker.id}) is FREE for this slot.`);
                    freeWorkersAtThisSlot.push({ id: worker.id, name: worker.name });
                } else {
                    // console.log(`  Worker ${worker.name} (ID: ${worker.id}) is BUSY for this slot.`);
                }
            }

            if (freeWorkersAtThisSlot.length > 0) {
                // console.log(`  Slot ${format(potentialSlotStart, 'HH:mm')} is AVAILABLE with workers:`, freeWorkersAtThisSlot.map(w=>w.name));
                availableSlotsWithWorkers.push({
                    time: format(potentialSlotStart, 'HH:mm'),
                    availableWorkers: freeWorkersAtThisSlot,
                });
            } else {
                // console.log(`  Slot ${format(potentialSlotStart, 'HH:mm')} has NO free workers.`);
            }

            potentialSlotStart = addMinutes(potentialSlotStart, BASE_SLOT_INTERVAL);
        }
        console.log(`Total available slots with worker details for ${dateString}: ${availableSlotsWithWorkers.length}`);
        return NextResponse.json({ availableSlots: availableSlotsWithWorkers }, { status: 200 });

    } catch (error) {
        console.error('Greška pri dobavljanju dostupnih termina:', error);
        let errorMessage = 'Interna greška servera.';
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             errorMessage = 'Greška pri komunikaciji sa bazom podataka.';
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ message: errorMessage, details: error instanceof Error ? error.stack : null }, { status: 500 });
    }
}
