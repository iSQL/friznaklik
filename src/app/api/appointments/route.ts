// src/app/api/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    ensureAuthenticated,
    getCurrentUser,
    withRoleProtection,
    AuthenticatedUser
} from '@/lib/authUtils';
// Ensure UserRole and AppointmentStatus are imported from your custom enum path
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums';
import { Prisma, Worker, VendorStatus } from '@prisma/client'; // Added VendorStatus
import { z } from 'zod';
import {
    parseISO,
    addMinutes,
    isBefore,
    startOfDay,
    endOfDay,
    isValid,
    setHours,
    setMinutes,
    setSeconds,
    setMilliseconds,
    format,
    addHours as addHoursFns,
} from 'date-fns';

const createAppointmentSchema = z.object({
  serviceId: z.string().cuid('Neispravan ID usluge.'),
  vendorId: z.string().cuid('Neispravan ID salona.'),
  workerId: z.string().cuid('Neispravan ID radnika.').nullable().optional(),
  startTime: z.string().datetime('Neispravan format početnog vremena.'),
  notes: z.string().max(500, "Napomena ne može biti duža od 500 karaktera.").optional().nullable(), // Added notes field
});

async function isWorkerAvailable(
    workerId: string,
    vendorId: string,
    startTime: Date,
    endTime: Date
): Promise<boolean> {
    const conflictingAppointments = await prisma.appointment.count({
        where: {
            workerId: workerId,
            vendorId: vendorId,
            status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
            OR: [
                { startTime: { lt: endTime }, endTime: { gt: startTime } },
            ],
        },
    });
    return conflictingAppointments === 0;
}

function getBusinessHoursForDay(operatingHours: any, date: Date): { open: Date, close: Date } | null {
    if (!operatingHours || typeof operatingHours !== 'object') return null;
    const dayOfWeek = format(date, 'eeee').toLowerCase();
    const hoursForDay = operatingHours[dayOfWeek];
    if (!hoursForDay || !hoursForDay.open || !hoursForDay.close) return null;
    try {
        const [openHour, openMinute] = hoursForDay.open.split(':').map(Number);
        const [closeHour, closeMinute] = hoursForDay.close.split(':').map(Number);
        if (isNaN(openHour) || isNaN(openMinute) || isNaN(closeHour) || isNaN(closeMinute)) return null;
        const openTime = setMilliseconds(setSeconds(setMinutes(setHours(startOfDay(date), openHour), openMinute), 0), 0);
        const closeTime = setMilliseconds(setSeconds(setMinutes(setHours(startOfDay(date), closeHour), closeMinute), 0), 0);
        return { open: openTime, close: closeTime };
    } catch (e) { return null; }
}

async function GET_handler(req: NextRequest) {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Niste autorizovani.' }, { status: 401 });
    }

    const queryParams = req.nextUrl.searchParams;
    const statusFilter = queryParams.get('status') as AppointmentStatus | null;
    const page = parseInt(queryParams.get('page') || '1', 10);
    const limit = parseInt(queryParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const whereClause: Prisma.AppointmentWhereInput = {};

    if (statusFilter) {
        whereClause.status = statusFilter;
    }

    if (user.role === UserRole.SUPER_ADMIN) {
    } else if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId) {
        return NextResponse.json({ message: 'Vlasnik salona nema povezan salon.' }, { status: 403 });
      }
      whereClause.vendorId = user.ownedVendorId;
    } else {
      return NextResponse.json({ message: 'Zabranjeno: Nedovoljne dozvole.' }, { status: 403 });
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
        service: {
          select: { name: true, duration: true },
        },
        vendor: {
            select: { name: true, id: true }
        },
        worker: {
            select: { id: true, name: true }
        }
      },
      orderBy: {
        startTime: 'desc',
      },
      skip: skip,
      take: limit,
    });

    const totalAppointments = await prisma.appointment.count({ where: whereClause });

    return NextResponse.json({
        appointments,
        totalPages: Math.ceil(totalAppointments / limit),
        currentPage: page,
        totalAppointments
    });

  } catch (error) {
    console.error('Greška pri dobavljanju termina (admin):', error);
    return NextResponse.json({ message: 'Interna greška servera prilikom dobavljanja termina.' }, { status: 500 });
  }
}

async function POST_handler(req: NextRequest) {
  try {
    const bookingUser = await ensureAuthenticated();

    const body = await req.json();
    const parseResult = createAppointmentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Neispravan unos.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { serviceId, vendorId, workerId: requestedWorkerId, startTime: startTimeString, notes } = parseResult.data;
    const parsedStartTime = parseISO(startTimeString);

    if (!isValid(parsedStartTime) || isBefore(parsedStartTime, addHoursFns(new Date(), 1))) {
        return NextResponse.json({ message: 'Neispravno vreme termina ili je termin previše blizu (minimum 1 sat unapred).' }, { status: 400 });
    }

    const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId, status: VendorStatus.ACTIVE },
        select: { operatingHours: true, workers: { select: { id: true, name: true } } }
    });
    if (!vendor) {
        return NextResponse.json({ message: 'Salon nije pronađen ili nije aktivan.' }, { status: 404 });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId, vendorId: vendorId, active: true },
    });

    if (!service) {
      return NextResponse.json({ message: 'Usluga nije pronađena, ne pripada odabranom salonu, ili nije aktivna.' }, { status: 404 });
    }

    const appointmentEndTime = addMinutes(parsedStartTime, service.duration);

    const businessHours = getBusinessHoursForDay(vendor.operatingHours, parsedStartTime);
    if (!businessHours || isBefore(parsedStartTime, businessHours.open) || isBefore(businessHours.close, appointmentEndTime)) {
        return NextResponse.json({ message: 'Termin je van radnog vremena salona.' }, { status: 400 });
    }

    let finalWorkerId: string | null = null;

    if (requestedWorkerId) {
        const workerExists = vendor.workers.find(w => w.id === requestedWorkerId);
        if (!workerExists) {
            return NextResponse.json({ message: 'Traženi radnik nije pronađen u ovom salonu.' }, { status: 400 });
        }
        const available = await isWorkerAvailable(requestedWorkerId, vendorId, parsedStartTime, appointmentEndTime);
        if (!available) {
            return NextResponse.json({ message: 'Izabrani radnik nije dostupan u traženom terminu.' }, { status: 409 });
        }
        finalWorkerId = requestedWorkerId;
    } else {
        if (vendor.workers.length === 0) {
            return NextResponse.json({ message: 'Nema dostupnih radnika u ovom salonu za ovu uslugu.' }, { status: 400 });
        }
        for (const worker of vendor.workers) {
            // Future: Check if worker can perform this service (skill check)
            const available = await isWorkerAvailable(worker.id, vendorId, parsedStartTime, appointmentEndTime);
            if (available) {
                finalWorkerId = worker.id;
                break;
            }
        }
        if (!finalWorkerId) {
            return NextResponse.json({ message: 'Nažalost, nema slobodnih radnika za traženi termin i uslugu.' }, { status: 409 });
        }
    }

    const newAppointment = await prisma.appointment.create({
      data: {
        userId: bookingUser.id,
        serviceId,
        vendorId,
        workerId: finalWorkerId,
        startTime: parsedStartTime,
        endTime: appointmentEndTime,
        status: AppointmentStatus.PENDING,
        notes: notes || null, // Save notes
      },
    });

    return NextResponse.json(newAppointment, { status: 201 });
  } catch (error: unknown) {
    console.error('Greška pri kreiranju termina:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Neispravan unos.', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom kreiranja termina.' }, { status: 500 });
  }
}

export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const POST = POST_handler;
