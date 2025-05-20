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
    getDay,
    addHours as addHoursFns,
    isSameDay,
} from 'date-fns';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import { Prisma } from '@prisma/client'; 
import { AppointmentStatus, VendorStatus } from '@/lib/types/prisma-enums'; 

const BASE_SLOT_INTERVAL = 15; //TODO: Make this configurable, maybe as a vendor setting
interface WorkerInfo {
    id: string;
    name: string | null;
}
interface SlotWithWorkers {
    time: string; // HH:mm format
    availableWorkers: WorkerInfo[];
}

interface EffectiveSchedule {
  openTime: Date;
  closeTime: Date;
}

interface DailyOperatingHour {
  open: string | null;
  close: string | null;
  isClosed?: boolean;
}
type OperatingHoursMap = {
  [key: string]: DailyOperatingHour | null;
};


// Helper to get vendor's operating hours for a specific day
function getVendorOperatingHoursForDay(
    operatingHoursJson: Prisma.JsonValue | OperatingHoursMap | null, 
    date: Date
): EffectiveSchedule | null {
    if (!operatingHoursJson || typeof operatingHoursJson !== 'object' || operatingHoursJson === null || Array.isArray(operatingHoursJson)) {
        console.warn("Vendor operatingHours is null or not an object.");
        return null;
    }
    const dayOfWeekString = format(date, 'eeee').toLowerCase(); // e.g., 'monday'
    const daySchedule = (operatingHoursJson as OperatingHoursMap)[dayOfWeekString];

    if (!daySchedule || !daySchedule.open || !daySchedule.close) {
        // console.log(`Vendor is closed on ${dayOfWeekString} or hours not set.`);
        return null;
    }

    try {
        const [openHour, openMinute] = daySchedule.open.split(':').map(Number);
        const [closeHour, closeMinute] = daySchedule.close.split(':').map(Number);

        if (isNaN(openHour) || isNaN(openMinute) || isNaN(closeHour) || isNaN(closeMinute)) {
            console.error('Invalid time format in vendor operatingHours:', daySchedule);
            return null;
        }
        const openTime = setMilliseconds(setSeconds(setMinutes(setHours(startOfDay(date), openHour), openMinute), 0), 0);
        const closeTime = setMilliseconds(setSeconds(setMinutes(setHours(startOfDay(date), closeHour), closeMinute), 0), 0);
        return { openTime, closeTime };
    } catch (e) {
        console.error('Error parsing vendor operating hours:', e);
        return null;
    }
}


// Helper to get a worker's effective schedule for a specific date, considering overrides and weekly defaults
async function getWorkerEffectiveSchedule(
  workerId: string,
  forDate: Date, // Should be startOfDay(forDate)
  vendorOperatingHoursJson: Prisma.JsonValue | OperatingHoursMap | null // Updated type
): Promise<EffectiveSchedule | null> {
  const dayOfWeek = getDay(forDate); // 0 for Sunday, 1 for Monday, etc.

  // 1. Check for specific date override
  const override = await prisma.workerScheduleOverride.findUnique({
    where: { workerId_date: { workerId, date: forDate } },
  });

  if (override) {
    if (override.isDayOff || !override.startTime || !override.endTime) {
      return null; // Worker is off or no specific times given for this override day
    }
    try {
      const [overrideOpenHour, overrideOpenMinute] = override.startTime.split(':').map(Number);
      const [overrideCloseHour, overrideCloseMinute] = override.endTime.split(':').map(Number);
      const openTime = setMilliseconds(setSeconds(setMinutes(setHours(forDate, overrideOpenHour), overrideOpenMinute), 0), 0);
      const closeTime = setMilliseconds(setSeconds(setMinutes(setHours(forDate, overrideCloseHour), overrideCloseMinute), 0), 0);
      return { openTime, closeTime };
    } catch (e) {
      console.error(`Error parsing override times for worker ${workerId} on ${format(forDate, 'yyyy-MM-dd')}:`, e);
      return null; // Invalid time format in override
    }
  }

  // 2. Check for weekly availability
  const weeklyAvail = await prisma.workerAvailability.findUnique({
    where: { workerId_dayOfWeek: { workerId, dayOfWeek } },
  });

  if (weeklyAvail) {
    if (!weeklyAvail.isAvailable || !weeklyAvail.startTime || !weeklyAvail.endTime) {
        return null; // Worker not available on this day of week based on their default schedule
    }
    try {
      const [weeklyOpenHour, weeklyOpenMinute] = weeklyAvail.startTime.split(':').map(Number);
      const [weeklyCloseHour, weeklyCloseMinute] = weeklyAvail.endTime.split(':').map(Number);
      const openTime = setMilliseconds(setSeconds(setMinutes(setHours(forDate, weeklyOpenHour), weeklyOpenMinute), 0), 0);
      const closeTime = setMilliseconds(setSeconds(setMinutes(setHours(forDate, weeklyCloseHour), weeklyCloseMinute), 0), 0);
      return { openTime, closeTime };
    } catch (e) {
      console.error(`Error parsing weekly availability times for worker ${workerId} on day ${dayOfWeek}:`, e);
      // Fall through to vendor hours if weekly is misconfigured or error occurs
    }
  }

  // 3. Fallback to vendor's general operating hours for that day of the week
  return getVendorOperatingHoursForDay(vendorOperatingHoursJson, forDate);
}


export async function GET(request: NextRequest) {
  console.log("--- GET /api/appointments/available (Phase 4 Logic) ---");
  const user: AuthenticatedUser | null = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Neautorizovan pristup.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const dateString = searchParams.get('date');
    const vendorId = searchParams.get('vendorId');
    const requestedWorkerId = searchParams.get('workerId'); // Optional

    if (!serviceId || !dateString || !vendorId) {
      return NextResponse.json({ message: 'Nedostaju obavezni parametri: serviceId, date, vendorId.' }, { status: 400 });
    }

    let selectedDate = parseISO(dateString);
    if (!isValid(selectedDate)) {
      return NextResponse.json({ message: 'Neispravan format datuma. Očekivani format je YYYY-MM-DD.' }, { status: 400 });
    }
    selectedDate = startOfDay(selectedDate); // Normalize to start of day

    // Fetch Service
    const service = await prisma.service.findUnique({
      where: { id: serviceId, vendorId: vendorId, active: true },
      select: { duration: true, name: true },
    });
    if (!service) {
      return NextResponse.json({ message: 'Tražena usluga nije pronađena, nije aktivna, ili ne pripada odabranom salonu.' }, { status: 404 });
    }
    const serviceDuration = service.duration;

    // Fetch Vendor
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { operatingHours: true, status: true, name: true },
    });
    if (!vendor) {
      return NextResponse.json({ message: 'Salon nije pronađen.' }, { status: 404 });
    }
    if (vendor.status !== VendorStatus.ACTIVE) {
      return NextResponse.json({ availableSlots: [], message: `Salon "${vendor.name}" trenutno nije aktivan.` }, { status: 200 });
    }

    // Determine which workers to consider
    let workersToConsider: Array<{ id: string; name: string | null; services: Array<{id: string}> }> = [];
    if (requestedWorkerId) {
      const worker = await prisma.worker.findUnique({
        where: { id: requestedWorkerId, vendorId: vendorId },
        select: { id: true, name: true, services: { where: { id: serviceId, active: true }, select: {id: true} } },
      });
      if (worker && worker.services.length > 0) {
        workersToConsider.push(worker);
      } else {
        return NextResponse.json({ availableSlots: [], message: `Izabrani radnik nije pronađen, ne pripada salonu, ili ne pruža odabranu uslugu.` }, { status: 200 });
      }
    } else {
      const allVendorWorkers = await prisma.worker.findMany({
        where: { vendorId: vendorId },
        select: { id: true, name: true, services: { where: { active: true }, select: {id: true} } },
      });
      workersToConsider = allVendorWorkers.filter(w => w.services.some(s => s.id === serviceId));
      if (workersToConsider.length === 0) {
        return NextResponse.json({ availableSlots: [], message: `Nema dostupnih radnika u salonu "${vendor.name}" koji mogu da izvrše odabranu uslugu.` }, { status: 200 });
      }
    }

    // Fetch existing appointments for all potentially relevant workers on the selected date
    const dayStartQuery = startOfDay(selectedDate);
    const dayEndQuery = endOfDay(selectedDate);
    const workerIdsToQuery = workersToConsider.map(w => w.id);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        vendorId: vendorId,
        workerId: { in: workerIdsToQuery },
        startTime: { gte: dayStartQuery, lt: dayEndQuery },
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
      select: { startTime: true, endTime: true, workerId: true },
    });

    const availableSlotsMap = new Map<string, WorkerInfo[]>();
    const now = new Date();
    const minBookingTime = addHoursFns(now, 1); // Minimum 1 hour from now for booking

    for (const worker of workersToConsider) {
      const workerSchedule = await getWorkerEffectiveSchedule(worker.id, selectedDate, vendor.operatingHours);
      if (!workerSchedule) continue; // Worker not working this day

      let potentialSlotStart = workerSchedule.openTime;

      while (isBefore(potentialSlotStart, workerSchedule.closeTime)) {
        const potentialSlotEnd = addMinutes(potentialSlotStart, serviceDuration);

        if (isBefore(workerSchedule.closeTime, potentialSlotEnd) || potentialSlotEnd > workerSchedule.closeTime) {
            break; // Slot extends beyond worker's closing time
        }

        // Check if slot is in the past or too soon
        if (isBefore(potentialSlotStart, minBookingTime) && isSameDay(selectedDate, now)) {
            potentialSlotStart = addMinutes(potentialSlotStart, BASE_SLOT_INTERVAL);
            continue;
        }

        // Check for conflicts with this worker's existing appointments
        const conflict = existingAppointments.some(app =>
          app.workerId === worker.id &&
          isBefore(app.startTime, potentialSlotEnd) &&
          isBefore(potentialSlotStart, app.endTime)
        );

        if (!conflict) {
          const slotTimeStr = format(potentialSlotStart, 'HH:mm');
          if (!availableSlotsMap.has(slotTimeStr)) {
            availableSlotsMap.set(slotTimeStr, []);
          }
          availableSlotsMap.get(slotTimeStr)?.push({ id: worker.id, name: worker.name });
        }
        potentialSlotStart = addMinutes(potentialSlotStart, BASE_SLOT_INTERVAL);
      }
    }

    const finalSlots: SlotWithWorkers[] = Array.from(availableSlotsMap.entries())
      .map(([time, workers]) => ({ time, availableWorkers: workers }))
      .sort((a, b) => a.time.localeCompare(b.time));

    if (finalSlots.length === 0 && !requestedWorkerId) {
         return NextResponse.json({ availableSlots: [], message: `Nema slobodnih termina za odabranu uslugu i datum kod bilo kog radnika.` }, { status: 200 });
    }
    if (finalSlots.length === 0 && requestedWorkerId) {
        return NextResponse.json({ availableSlots: [], message: `Izabrani radnik nema slobodnih termina za odabranu uslugu i datum.` }, { status: 200 });
    }

    return NextResponse.json({ availableSlots: finalSlots }, { status: 200 });

  } catch (error: unknown) {
    console.error('Greška pri dobavljanju dostupnih termina (Phase 4):', error);
    let errorMessage = 'Interna greška servera.';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
         errorMessage = 'Greška pri komunikaciji sa bazom podataka.';
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: errorMessage, details: error instanceof Error ? error.stack : null }, { status: 500 });
  }
}
