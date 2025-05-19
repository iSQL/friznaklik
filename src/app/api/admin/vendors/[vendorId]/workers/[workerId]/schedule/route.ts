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

// Zod schema for a single availability rule
const workerAvailabilitySchema = z.object({
  dayOfWeek: z.number().min(0).max(6), // 0 (Sunday) - 6 (Saturday)
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "HH:mm format required for startTime"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "HH:mm format required for endTime"),
  isAvailable: z.boolean().default(true),
});

// Zod schema for a single schedule override
const workerScheduleOverrideSchema = z.object({
  date: z.string().datetime({ message: "Invalid date format, should be ISO 8601" }).transform((dateStr) => new Date(dateStr)), // Validate as ISO string, then transform
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "HH:mm format required for startTime").optional().nullable(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "HH:mm format required for endTime").optional().nullable(),
  isDayOff: z.boolean().default(false),
  notes: z.string().optional().nullable(),
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

  // Verify worker belongs to the vendor and user has permission
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
  // SUPER_ADMIN has access if worker.vendorId matches vendorId from params

  try {
    const body = await req.json();
    const parseResult = updateWorkerScheduleSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { availabilities, overrides } = parseResult.data;

    await prisma.$transaction(async (tx) => {
      // Update weekly availabilities
      if (availabilities) {
        // Delete existing weekly availabilities for this worker
        await tx.workerAvailability.deleteMany({
          where: { workerId: workerId },
        });
        // Create new ones
        if (availabilities.length > 0) {
          await tx.workerAvailability.createMany({
            data: availabilities.map(avail => ({
              ...avail,
              workerId: workerId,
            })),
          });
        }
      }

      // Update schedule overrides
      if (overrides) {
        // Simple approach: delete all existing for the worker and recreate.
        // More sophisticated: find by date and update or create.
        // For simplicity now, delete and recreate if overrides are provided.
        await tx.workerScheduleOverride.deleteMany({
            where: { workerId: workerId }
        });
        if (overrides.length > 0) {
            await tx.workerScheduleOverride.createMany({
                data: overrides.map(override => ({
                    ...override,
                    date: new Date(override.date), 
                    workerId: workerId,
                }))
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
      // Handle specific Prisma errors if necessary
      if (error.code === 'P2025') { // Record to update/delete not found
        return NextResponse.json({ message: 'Radnik nije pronađen za ažuriranje rasporeda.' }, { status: 404 });
      }
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom ažuriranja rasporeda radnika.' }, { status: 500 });
  }
}

export const PUT = withRoleProtection(PUT_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);