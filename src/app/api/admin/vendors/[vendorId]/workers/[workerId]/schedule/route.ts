// src/app/api/admin/vendors/[vendorId]/workers/[workerId]/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { UserRole } from '@/lib/types/prisma-enums';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { parseISO, isValid as isValidDateFn } from 'date-fns'; // Renamed isValid to avoid conflict

// Zod schema for a single availability rule
const workerAvailabilitySchema = z.object({
  dayOfWeek: z.number().min(0).max(6), 
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "HH:mm format required for startTime"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "HH:mm format required for endTime"),
  isAvailable: z.boolean().default(true),
});

// Zod schema for a single schedule override
const workerScheduleOverrideSchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .transform((dateStr, ctx) => {
        const d = parseISO(dateStr); // parseISO can handle YYYY-MM-DD
        if (!isValidDateFn(d)) { // Use aliased isValidDateFn
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Invalid date value provided for override.",
            });
            return z.NEVER; 
        }
        // Ensure it's set to the start of the day in UTC for database consistency with @db.Date
        return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "HH:mm format required for startTime").optional().nullable(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "HH:mm format required for endTime").optional().nullable(),
  isDayOff: z.boolean().default(false),
  notes: z.string().max(255, "Napomena za izuzetak ne može biti duža od 255 karaktera.").optional().nullable(),
});

const updateWorkerScheduleSchema = z.object({
  availabilities: z.array(workerAvailabilitySchema).optional(),
  overrides: z.array(workerScheduleOverrideSchema).optional(),
});

interface RouteContext {
  params: Promise<{
    vendorId: string;
    workerId: string;
  }>;
}

async function PUT_handler(req: NextRequest, context: RouteContext) {
  const user: AuthenticatedUser | null = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Korisnik nije pronađen nakon autentifikacije.' }, { status: 401 });
  }

  const { vendorId, workerId } = await context.params;

  if (!vendorId || !workerId) {
    return NextResponse.json({ message: 'ID salona i ID radnika su obavezni.' }, { status: 400 });
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { vendorId: true }
  });

  if (!worker) {
    return NextResponse.json({ message: `Radnik sa ID ${workerId} nije pronađen.` }, { status: 404 });
  }

  if (worker.vendorId !== vendorId) {
    return NextResponse.json({ message: `Radnik ${workerId} ne pripada salonu ${vendorId}.` }, { status: 403 });
  }

  if (user.role === UserRole.VENDOR_OWNER && user.ownedVendorId !== vendorId) {
    return NextResponse.json({ message: 'Zabranjeno: Nemate pristup ovom salonu.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parseResult = updateWorkerScheduleSchema.safeParse(body);

    if (!parseResult.success) {
      console.error("Zod validation errors for schedule update:", JSON.stringify(parseResult.error.flatten().fieldErrors, null, 2));
      return NextResponse.json({ message: 'Nevalidan unos.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { availabilities, overrides } = parseResult.data;

    await prisma.$transaction(async (tx) => {
      if (availabilities) {
        await tx.workerAvailability.deleteMany({
          where: { workerId: workerId },
        });
        if (availabilities.length > 0) {
          await tx.workerAvailability.createMany({
            data: availabilities.map(avail => ({
              ...avail,
              workerId: workerId,
            })),
          });
        }
      }

      if (overrides) {
        await tx.workerScheduleOverride.deleteMany({
            where: { workerId: workerId }
        });
        if (overrides.length > 0) {
            // Explicitly construct data for createMany to match Prisma's expected input type
            const overrideDataForDb: Prisma.WorkerScheduleOverrideCreateManyInput[] = overrides.map(o => {
                const record: Prisma.WorkerScheduleOverrideCreateManyInput = {
                    workerId: workerId,
                    date: o.date, // This is a Date object from Zod transform
                    isDayOff: o.isDayOff,
                };
                // Only include optional fields if they have a value (not undefined)
                if (o.startTime !== undefined) record.startTime = o.startTime;
                if (o.endTime !== undefined) record.endTime = o.endTime;
                if (o.notes !== undefined) record.notes = o.notes;
                return record;
            });
            await tx.workerScheduleOverride.createMany({
                data: overrideDataForDb,
            });
        }
      }
    });

    const updatedWorkerWithSchedule = await prisma.worker.findUnique({
        where: {id: workerId},
        include: {
            availabilities: true,
            scheduleOverrides: true,
        }
    });

    return NextResponse.json(updatedWorkerWithSchedule);

  } catch (error: unknown) {
    console.error(`Greška pri ažuriranju rasporeda za radnika ${workerId} salona ${vendorId}:`, error);
    if (error instanceof z.ZodError) { 
      return NextResponse.json({ message: 'Nevalidan unos.', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { 
        return NextResponse.json({ message: 'Radnik nije pronađen za ažuriranje rasporeda.' }, { status: 404 });
      }
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom ažuriranja rasporeda radnika.' }, { status: 500 });
  }
}

export const PUT = withRoleProtection(PUT_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
