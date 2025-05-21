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
    isToday 
} from 'date-fns';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import { Prisma } from '@prisma/client';
import { AppointmentStatus, VendorStatus } from '@/lib/types/prisma-enums';

const BASE_SLOT_INTERVAL = 15;

interface WorkerInfo {
    id: string;
    name: string | null;
}
interface SlotWithWorkers {
    time: string;
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

function getVendorOperatingHoursForDay(
    operatingHoursJson: Prisma.JsonValue | OperatingHoursMap | null,
    date: Date
): EffectiveSchedule | null {
    if (!operatingHoursJson || typeof operatingHoursJson !== 'object' || operatingHoursJson === null || Array.isArray(operatingHoursJson)) {
        return null;
    }
    const dayOfWeekString = format(date, 'eeee').toLowerCase();
    const daySchedule = (operatingHoursJson as OperatingHoursMap)[dayOfWeekString];

    if (!daySchedule || !daySchedule.open || !daySchedule.close) {
        return null;
    }
    try {
        const [openHour, openMinute] = daySchedule.open.split(':').map(Number);
        const [closeHour, closeMinute] = daySchedule.close.split(':').map(Number);
        if (isNaN(openHour) || isNaN(openMinute) || isNaN(closeHour) || isNaN(closeMinute)) return null;
        const openTime = setMilliseconds(setSeconds(setMinutes(setHours(startOfDay(date), openHour), openMinute), 0), 0);
        const closeTime = setMilliseconds(setSeconds(setMinutes(setHours(startOfDay(date), closeHour), closeMinute), 0), 0);
        return { openTime, closeTime };
    } catch (e) {
        console.error('Error parsing vendor operating hours:', e);
        return null;
    }
}

async function getWorkerEffectiveSchedule(
  workerId: string,
  forDate: Date,
  vendorOperatingHoursJson: Prisma.JsonValue | OperatingHoursMap | null
): Promise<EffectiveSchedule | null> {
  const dayOfWeek = getDay(forDate);

  const override = await prisma.workerScheduleOverride.findUnique({
    where: { workerId_date: { workerId, date: forDate } },
  });

  if (override) {
    if (override.isDayOff || !override.startTime || !override.endTime) return null;
    try {
      const [oH, oM] = override.startTime.split(':').map(Number);
      const [cH, cM] = override.endTime.split(':').map(Number);
      return {
        openTime: setMilliseconds(setSeconds(setMinutes(setHours(forDate, oH), oM), 0), 0),
        closeTime: setMilliseconds(setSeconds(setMinutes(setHours(forDate, cH), cM), 0), 0),
      };
    } catch { return null; }
  }

  const weeklyAvail = await prisma.workerAvailability.findUnique({
    where: { workerId_dayOfWeek: { workerId, dayOfWeek } },
  });

  if (weeklyAvail) {
    if (!weeklyAvail.isAvailable || !weeklyAvail.startTime || !weeklyAvail.endTime) return null;
    try {
      const [wOH, wOM] = weeklyAvail.startTime.split(':').map(Number);
      const [wCH, wCM] = weeklyAvail.endTime.split(':').map(Number);
      return {
        openTime: setMilliseconds(setSeconds(setMinutes(setHours(forDate, wOH), wOM), 0), 0),
        closeTime: setMilliseconds(setSeconds(setMinutes(setHours(forDate, wCH), wCM), 0), 0),
      };
    } catch { /* Fall through */ }
  }
  return getVendorOperatingHoursForDay(vendorOperatingHoursJson, forDate);
}


export async function GET(request: NextRequest) {
  const user: AuthenticatedUser | null = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Neautorizovan pristup.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const dateString = searchParams.get('date');
    const vendorId = searchParams.get('vendorId');
    const requestedWorkerId = searchParams.get('workerId');

    if (!serviceId || !dateString || !vendorId) {
      return NextResponse.json({ message: 'Nedostaju obavezni parametri: serviceId, date, vendorId.' }, { status: 400 });
    }

    let selectedDate = parseISO(dateString);
    if (!isValid(selectedDate)) {
      return NextResponse.json({ message: 'Neispravan format datuma. Očekivani format je YYYY-MM-DD.' }, { status: 400 });
    }
    selectedDate = startOfDay(selectedDate);

    // Prevent fetching slots for today
    if (isToday(selectedDate)) {
        return NextResponse.json({ availableSlots: [], message: "Rezervacije za danas nisu moguće. Molimo odaberite sutrašnji ili kasniji datum." }, { status: 200 });
    }


    const service = await prisma.service.findUnique({
      where: { id: serviceId, vendorId: vendorId, active: true },
      select: { duration: true, name: true },
    });
    if (!service) {
      return NextResponse.json({ message: 'Tražena usluga nije pronađena, nije aktivna, ili ne pripada odabranom salonu.' }, { status: 404 });
    }
    const serviceDuration = service.duration;

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
    // const now = new Date(); // Not needed if we block today entirely
    // const minBookingTime = addHoursFns(now, 1);

    for (const worker of workersToConsider) {
      const workerSchedule = await getWorkerEffectiveSchedule(worker.id, selectedDate, vendor.operatingHours);
      if (!workerSchedule) continue;

      let potentialSlotStart = workerSchedule.openTime;

      while (isBefore(potentialSlotStart, workerSchedule.closeTime)) {
        const potentialSlotEnd = addMinutes(potentialSlotStart, serviceDuration);

        if (isBefore(workerSchedule.closeTime, potentialSlotEnd) || potentialSlotEnd > workerSchedule.closeTime) {
            break;
        }

        // No need to check minBookingTime if today is blocked
        // if (isBefore(potentialSlotStart, minBookingTime) && isSameDay(selectedDate, now)) {
        //     potentialSlotStart = addMinutes(potentialSlotStart, BASE_SLOT_INTERVAL);
        //     continue;
        // }

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
