import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/emailService';

import prisma from '@/lib/prisma';
import {
    ensureAuthenticated,
    getCurrentUser,
    withRoleProtection,
    AuthenticatedUser,
} from '@/lib/authUtils';
import { AppointmentStatus, VendorStatus, UserRole } from '@/lib/types/prisma-enums';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
    parseISO,
    addMinutes,
    isBefore,
    startOfDay,
    isValid,
    setHours,
    setMinutes,
    setSeconds,
    setMilliseconds,
    format,
    addHours as addHoursFns,
    getDay,
} from 'date-fns';
import { srLatn } from 'date-fns/locale';

const createAppointmentSchema = z.object({
  serviceId: z.string().cuid('Neispravan ID usluge.'),
  vendorId: z.string().cuid('Neispravan ID salona.'),
  workerId: z.string().cuid('Neispravan ID radnika.').nullable().optional(), // Optional: customer might not select a specific worker
  startTime: z.string().datetime({ message: 'Neispravan format početnog vremena (očekivano YYYY-MM-DDTHH:mm:ss.sssZ).' }),
  notes: z.string().max(500, "Napomena ne može biti duža od 500 karaktera.").optional().nullable(),
});

// --- Start Helper Functions (Ideally move to a shared utility) ---
interface EffectiveSchedule {
  openTime: Date;
  closeTime: Date;
}

// Define a more specific type for the operatingHours JSON structure
interface DailyOperatingHour {
  open: string | null;
  close: string | null;
  isClosed?: boolean;
}
type OperatingHoursMap = {
  [key: string]: DailyOperatingHour | null;
};


function getVendorOperatingHoursForDay(
    operatingHoursJson: Prisma.JsonValue | OperatingHoursMap | null, // Updated type
    date: Date
): EffectiveSchedule | null {
    // Corrected condition: Prisma.JsonNull is an input type; on read, it's typically just `null`.
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
        console.error('Error parsing vendor operating hours in create appointment:', e);
        return null;
    }
}

async function getWorkerEffectiveSchedule(
  workerId: string,
  forDate: Date,
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
      const [oH, oM] = override.startTime.split(':').map(Number);
      const [cH, cM] = override.endTime.split(':').map(Number);
      return {
        openTime: setMilliseconds(setSeconds(setMinutes(setHours(forDate, oH), oM), 0), 0),
        closeTime: setMilliseconds(setSeconds(setMinutes(setHours(forDate, cH), cM), 0), 0),
      };
    } catch (e) {
        console.error(`Error parsing override times for worker ${workerId} on ${format(forDate, 'yyyy-MM-dd')}:`, e);
        return null;
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
      const [wOH, wOM] = weeklyAvail.startTime.split(':').map(Number);
      const [wCH, wCM] = weeklyAvail.endTime.split(':').map(Number);
      return {
        openTime: setMilliseconds(setSeconds(setMinutes(setHours(forDate, wOH), wOM), 0), 0),
        closeTime: setMilliseconds(setSeconds(setMinutes(setHours(forDate, wCH), wCM), 0), 0),
      };
    } catch (e) {
      console.error(`Error parsing weekly availability times for worker ${workerId} on day ${dayOfWeek}:`, e);
      // Fall through to vendor hours if weekly is misconfigured or error occurs
    }
  }

  // 3. Fallback to vendor's general operating hours for that day of the week
  return getVendorOperatingHoursForDay(vendorOperatingHoursJson, forDate);
}

// Re-verification of availability for a specific worker and slot
async function isWorkerSlotStillAvailable(
    workerId: string,
    vendorId: string,
    serviceId: string,
    slotStartTime: Date,
    vendorOperatingHoursJson: Prisma.JsonValue | OperatingHoursMap | null // Updated type
): Promise<boolean> {
    const service = await prisma.service.findUnique({ where: {id: serviceId}, select: { duration: true}});
    if (!service) {
        console.error(`Service with ID ${serviceId} not found during slot availability check.`);
        return false;
    }
    const slotEndTime = addMinutes(slotStartTime, service.duration);

    const workerSchedule = await getWorkerEffectiveSchedule(workerId, startOfDay(slotStartTime), vendorOperatingHoursJson);
    if (!workerSchedule) {
        // console.log(`Worker ${workerId} is not scheduled for ${format(slotStartTime, 'yyyy-MM-dd')}.`);
        return false;
    }

    // Check if slot is within worker's effective working hours
    if (isBefore(slotStartTime, workerSchedule.openTime) || isBefore(workerSchedule.closeTime, slotEndTime) || slotEndTime > workerSchedule.closeTime) {
        // console.log(`Slot ${format(slotStartTime, 'HH:mm')}-${format(slotEndTime, 'HH:mm')} is outside worker ${workerId}'s hours (${format(workerSchedule.openTime, 'HH:mm')}-${format(workerSchedule.closeTime, 'HH:mm')}).`);
        return false;
    }

    // Check for conflicting appointments for this specific worker
    const conflictingAppointments = await prisma.appointment.count({
        where: {
            workerId: workerId,
            vendorId: vendorId,
            status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
            OR: [
                { startTime: { lt: slotEndTime }, endTime: { gt: slotStartTime } },
            ],
        },
    });
    return conflictingAppointments === 0;
}
// --- End Helper Functions ---


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
        return NextResponse.json({ message: 'Neispravno vreme termina. Termin mora biti najmanje 1 sat unapred i validan datum/vreme.' }, { status: 400 });
    }

    const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId, status: VendorStatus.ACTIVE },
        select: { operatingHours: true, name: true, ownerId: true } // Include ownerId
    });
    if (!vendor) {
        return NextResponse.json({ message: 'Salon nije pronađen ili nije aktivan.' }, { status: 404 });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId, vendorId: vendorId, active: true },
      select: { duration: true, name: true }
    });
    if (!service) {
      return NextResponse.json({ message: `Usluga "${serviceId}" nije pronađena, nije aktivna, ili ne pripada salonu "${vendor.name}".` }, { status: 404 });
    }

    const appointmentEndTime = addMinutes(parsedStartTime, service.duration);

    const vendorBusinessHours = getVendorOperatingHoursForDay(vendor.operatingHours, parsedStartTime);
    if (vendorBusinessHours) {
        if (isBefore(parsedStartTime, vendorBusinessHours.openTime) || isBefore(vendorBusinessHours.closeTime, appointmentEndTime) || appointmentEndTime > vendorBusinessHours.closeTime) {
            return NextResponse.json({ message: `Traženi termin je van radnog vremena salona "${vendor.name}".` }, { status: 400 });
        }
    } else {
         console.warn(`Vendor ${vendorId} nema definisano opšte radno vreme za ${format(parsedStartTime, 'eeee')}. Oslanjamo se na raspored radnika.`);
    }

    let finalWorkerId: string | null = null;

    if (requestedWorkerId) {
        const worker = await prisma.worker.findUnique({
            where: { id: requestedWorkerId, vendorId: vendorId },
            include: { services: { select: { id: true } } }
        });

        if (!worker) {
            return NextResponse.json({ message: `Traženi radnik (ID: ${requestedWorkerId}) nije pronađen u salonu "${vendor.name}".` }, { status: 404 });
        }
        if (!worker.services.some(s => s.id === serviceId)) {
            return NextResponse.json({ message: `Radnik ${worker.name} ne pruža uslugu "${service.name}".` }, { status: 400 });
        }

        const stillAvailable = await isWorkerSlotStillAvailable(requestedWorkerId, vendorId, serviceId, parsedStartTime, vendor.operatingHours);
        if (!stillAvailable) {
            return NextResponse.json({ message: `Traženi termin kod radnika ${worker.name} više nije dostupan. Molimo osvežite i pokušajte ponovo.` }, { status: 409 });
        }
        finalWorkerId = requestedWorkerId;
    } else {
        const qualifiedWorkers = await prisma.worker.findMany({
            where: {
                vendorId: vendorId,
                services: {
                    some: { id: serviceId, active: true }
                }
            },
            select: { id: true, name: true }
        });

        if (qualifiedWorkers.length === 0) {
            return NextResponse.json({ message: `Nema radnika u salonu "${vendor.name}" koji mogu da izvrše uslugu "${service.name}".` }, { status: 404 });
        }

        for (const worker of qualifiedWorkers) {
            const stillAvailable = await isWorkerSlotStillAvailable(worker.id, vendorId, serviceId, parsedStartTime, vendor.operatingHours);
            if (stillAvailable) {
                finalWorkerId = worker.id;
                console.log(`Automatski dodeljen radnik ${worker.name || worker.id} za termin.`);
                break;
            }
        }

        if (!finalWorkerId) {
            return NextResponse.json({ message: `Nažalost, trenutno nema slobodnih radnika za traženi termin za uslugu "${service.name}" u salonu "${vendor.name}". Molimo pokušajte drugi termin.` }, { status: 409 });
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
        notes: notes || null,
      },
      include: {
          service: {select: {name: true}},
          vendor: {select: {name: true, owner: { select: { email: true, firstName: true}}}}, // Include owner email and name
          worker: {select: {name: true}},
          user: {select: {firstName: true, lastName: true, email: true}} // Include booking user's details
      }
    });

    // --- Send Notification Email to Vendor Owner ---
    if (newAppointment.vendor?.owner?.email) {
      const vendorOwner = newAppointment.vendor.owner;
      const customer = newAppointment.user;
      const formattedStartTime = format(new Date(newAppointment.startTime), "eeee, dd. MMMM yyyy 'u' HH:mm", { locale: srLatn });
      const adminAppointmentsLink = `${process.env.NEXT_PUBLIC_SITE_URL}/admin/appointments`;

      const emailSubject = `Novi zahtev za termin: ${newAppointment.service.name} u ${newAppointment.vendor.name}`;
      const emailHtmlContent = `
        <p>Poštovani ${vendorOwner.firstName || 'vlasniče salona'},</p>
        <p>Primili ste novi zahtev za termin:</p>
        <ul>
          <li><strong>Korisnik:</strong> ${customer.firstName || ''} ${customer.lastName || ''} (${customer.email})</li>
          <li><strong>Salon:</strong> ${newAppointment.vendor.name}</li>
          <li><strong>Usluga:</strong> ${newAppointment.service.name}</li>
          <li><strong>Zatraženo vreme:</strong> ${formattedStartTime}</li>
          ${newAppointment.worker?.name ? `<li><strong>Radnik:</strong> ${newAppointment.worker.name}</li>` : ''}
          ${newAppointment.notes ? `<li><strong>Napomena korisnika:</strong> ${newAppointment.notes}</li>` : ''}
        </ul>
        <p>Molimo Vas da pregledate i obradite ovaj zahtev u Vašem administratorskom panelu.</p>
        <p><a href="${adminAppointmentsLink}">Idi na Admin Panel - Termini</a></p>
        <p>S poštovanjem,<br>FrizNaKlik Tim</p>
      `;

      try {
        await sendEmail({
          to: vendorOwner.email,
          subject: emailSubject,
          html: emailHtmlContent,
        });
      } catch (emailError) {
        // Log email sending failure but don't let it fail the appointment creation
        console.error("Greška pri slanju email notifikacije vlasniku salona:", emailError);
      }
    } else {
      console.warn(`Email vlasnika salona nije pronađen za salon ID: ${newAppointment.vendorId}. Notifikacija nije poslata.`);
    }
    // --- End Send Notification Email ---

    // Prepare response by removing sensitive owner data from the newAppointment object if necessary
    const { vendor: vendorDataForResponse, ...restOfAppointment } = newAppointment;
    const responseAppointment = {
        ...restOfAppointment,
        vendor: { name: vendorDataForResponse.name } // Only include vendor name in response to client
    };


    return NextResponse.json(responseAppointment, { status: 201 });

  } catch (error: unknown) {
    // ... (your existing error handling)
    console.error('Greška pri kreiranju termina:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Neispravan unos.', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle specific Prisma errors if needed
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom kreiranja termina.' }, { status: 500 });
  }
}

// GET handler for fetching appointments (admin/vendor view)
async function GET_handler(req: NextRequest) {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user || (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.VENDOR_OWNER)) {
      return NextResponse.json({ message: 'Niste autorizovani.' }, { status: 401 });
    }

    const queryParams = req.nextUrl.searchParams;
    const statusFilter = queryParams.get('status') as AppointmentStatus | null;
    const page = parseInt(queryParams.get('page') || '1', 10);
    const limit = parseInt(queryParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const whereClause: Prisma.AppointmentWhereInput = {}; // Use Prisma.AppointmentWhereInput

    if (statusFilter) {
        whereClause.status = statusFilter;
    }

    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId) {
        return NextResponse.json({ message: 'Vlasnik salona nema povezan salon.' }, { status: 403 });
      }
      whereClause.vendorId = user.ownedVendorId;
    }
    // SUPER_ADMIN can see all appointments if no specific vendorId filter is applied from client

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        service: { select: { name: true, duration: true } },
        vendor: { select: { name: true, id: true } },
        worker: { select: { id: true, name: true } }
      },
      orderBy: { startTime: 'desc' },
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

export const POST = POST_handler;
export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
