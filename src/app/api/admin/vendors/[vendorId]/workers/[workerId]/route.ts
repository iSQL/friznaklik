import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { UserRole } from '@/lib/types/prisma-enums'; 
import { Prisma, Worker, WorkerAvailability, WorkerScheduleOverride, Service as PrismaService, User as PrismaUser } from '@prisma/client'; 
import { z } from 'zod';

const updateWorkerDetailsSchema = z.object({
  name: z.string().min(1, 'Ime radnika je obavezno.').optional(),
  bio: z.string().optional().nullable(),
  photoUrl: z.string().url('URL fotografije nije validan.').optional().nullable(),
  userEmail: z.string().email("Neispravan format email adrese.").optional().nullable(), 
});

interface RouteContext {
  params: Promise<{
    vendorId: string;
    workerId: string;
  }>;
}

// Define more specific types for the included relations
type WorkerService = Pick<PrismaService, 'id' | 'name'>;
type WorkerUser = Pick<PrismaUser, 'clerkId' | 'email' | 'firstName' | 'lastName'> | null;

// Define a more specific return type for getWorkerForAdmin
type WorkerForAdmin = Worker & {
  availabilities: WorkerAvailability[];
  scheduleOverrides: WorkerScheduleOverride[];
  services: WorkerService[];
  user: WorkerUser;
};


// Helper to verify ownership and fetch worker with full details for GET
async function getWorkerForAdmin(
  user: AuthenticatedUser,
  vendorIdFromParams: string,
  workerIdFromParams: string
): Promise<WorkerForAdmin | 'FORBIDDEN' | 'NOT_FOUND'> {
  const worker = await prisma.worker.findUnique({
    where: { id: workerIdFromParams },
    include: {
        user: { select: { clerkId:true, email: true, firstName: true, lastName: true } },
        services: { select: { id: true, name: true }, orderBy: {name: 'asc'} },
        availabilities: { orderBy: { dayOfWeek: 'asc'} },
        scheduleOverrides: { orderBy: { date: 'asc'} },
    }
  });

  if (!worker) {
    return 'NOT_FOUND';
  }

  if (worker.vendorId !== vendorIdFromParams) {
    console.warn(`Worker ${workerIdFromParams} does not belong to vendor ${vendorIdFromParams}. Actual vendor: ${worker.vendorId}`);
    return 'NOT_FOUND';
  }

  if (user.role === UserRole.VENDOR_OWNER) {
    if (!user.ownedVendorId || user.ownedVendorId !== vendorIdFromParams) {
      return 'FORBIDDEN';
    }
  }
  return worker as WorkerForAdmin;
}


// GET handler to fetch a specific worker with their schedule
async function GET_handler(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Korisnik nije pronađen ili nije autentifikovan.' }, { status: 401 });
  }

  const { vendorId, workerId } = await context.params;
  const workerCheckResult = await getWorkerForAdmin(user, vendorId, workerId);

  if (workerCheckResult === 'NOT_FOUND') {
    return NextResponse.json({ message: `Radnik sa ID ${workerId} nije pronađen za salon ${vendorId}.` }, { status: 404 });
  }
  if (workerCheckResult === 'FORBIDDEN') {
    return NextResponse.json({ message: 'Zabranjeno: Nemate pristup ovom radniku.' }, { status: 403 });
  }
  return NextResponse.json(workerCheckResult);
}

// PUT handler to update a worker's basic details AND user link
async function PUT_handler(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Korisnik nije pronađen ili nije autentifikovan.' }, { status: 401 });
  }

  const { vendorId, workerId } = await context.params;

  const workerToUpdate = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { vendorId: true, userId: true }
  });

  if (!workerToUpdate) {
    return NextResponse.json({ message: `Radnik sa ID ${workerId} nije pronađen za ažuriranje.` }, { status: 404 });
  }
  if (workerToUpdate.vendorId !== vendorId) {
    return NextResponse.json({ message: `Konflikt: Radnik ${workerId} ne pripada salonu ${vendorId}.` }, { status: 400 });
  }
  if (user.role === UserRole.VENDOR_OWNER && user.ownedVendorId !== vendorId) {
    return NextResponse.json({ message: 'Zabranjeno: Ne možete ažurirati ovog radnika.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parseResult = updateWorkerDetailsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { name, bio, photoUrl, userEmail } = parseResult.data;
    const dataToUpdate: Prisma.WorkerUpdateInput = {};

    if (name !== undefined) dataToUpdate.name = name;
    if (bio !== undefined) dataToUpdate.bio = bio;
    if (photoUrl !== undefined) dataToUpdate.photoUrl = photoUrl;

    if (userEmail !== undefined) {
        if (userEmail === null || userEmail === '') {
            if (workerToUpdate.userId) {
                 dataToUpdate.user = { disconnect: true };
                 console.log(`Worker ${workerId}: Unlinking user.`);
            } else {
                console.log(`Worker ${workerId}: No user was linked, no action to disconnect.`);
            }
        } else {
            const targetUser = await prisma.user.findUnique({
                where: { email: userEmail },
                select: { id: true, email: true }
            });

            if (!targetUser) {
                return NextResponse.json({ message: `Korisnik sa email adresom ${userEmail} nije pronađen.` }, { status: 404 });
            }

            const existingWorkerLink = await prisma.worker.findFirst({
                where: {
                    vendorId: vendorId,
                    userId: targetUser.id,
                    NOT: { id: workerId }
                }
            });

            if (existingWorkerLink) {
                return NextResponse.json({ message: `Korisnik sa emailom ${userEmail} je već povezan sa drugim radnikom (ID: ${existingWorkerLink.id}) u ovom salonu.` }, { status: 409 });
            }

            dataToUpdate.user = { connect: { id: targetUser.id } };
            console.log(`Worker ${workerId}: Linking to user ${targetUser.id} (Email: ${userEmail}).`);
        }
    }

    if (Object.keys(dataToUpdate).length === 0) {
        const currentWorkerData = await getWorkerForAdmin(user, vendorId, workerId);
         if (currentWorkerData === 'NOT_FOUND' || currentWorkerData === 'FORBIDDEN') {
            return NextResponse.json({ message: 'Radnik nije pronađen ili nemate pristup nakon provere za ažuriranje.' }, { status: 404 });
        }
        return NextResponse.json(currentWorkerData);
    }

    const updatedWorker = await prisma.worker.update({
      where: { id: workerId },
      data: dataToUpdate,
      include: {
        user: { select: { clerkId: true, email: true, firstName: true, lastName: true } },
        services: { select: { id: true, name: true } },
      }
    });

    return NextResponse.json(updatedWorker);
  } catch (error: unknown) {
    console.error(`Greška pri ažuriranju detalja radnika ${workerId} za salon ${vendorId}:`, error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
            return NextResponse.json({ message: 'Radnik ili korisnik za povezivanje nije pronađen tokom ažuriranja.' }, { status: 404 });
        }
        if (error.code === 'P2002' && (error.meta?.target as string[])?.includes('unique_vendor_user_worker')) {
            return NextResponse.json({ message: 'Ovaj korisnik je već povezan sa radnikom u ovom salonu.' }, { status: 409 });
        }
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom ažuriranja detalja radnika.' }, { status: 500 });
  }
}

// DELETE handler to delete a worker
async function DELETE_handler(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Korisnik nije pronađen ili nije autentifikovan.' }, { status: 401 });
  }

  const { vendorId, workerId } = await context.params;

  const workerToDelete = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { vendorId: true }
  });

  if (!workerToDelete) {
    return NextResponse.json({ message: `Radnik sa ID ${workerId} nije pronađen za brisanje.` }, { status: 404 });
  }
  if (workerToDelete.vendorId !== vendorId) {
     return NextResponse.json({ message: `Konflikt: Radnik ${workerId} ne pripada salonu ${vendorId}.` }, { status: 400 });
  }
  if (user.role === UserRole.VENDOR_OWNER && user.ownedVendorId !== vendorId) {
    return NextResponse.json({ message: 'Zabranjeno: Ne možete obrisati ovog radnika.' }, { status: 403 });
  }

  try {
    const assignedAppointmentsCount = await prisma.appointment.count({
        where: {
            workerId: workerId,
            status: { in: ['PENDING', 'CONFIRMED'] }
        }
    });

    if (assignedAppointmentsCount > 0) {
        return NextResponse.json({
            message: `Ne možete obrisati radnika jer ima ${assignedAppointmentsCount} aktivnih ili termina na čekanju. Molimo prvo otkažite ili prerasporedite te termine.`
        }, { status: 409 });
    }

    // Perform deletion in a transaction to also remove related schedule data
    await prisma.$transaction([
        prisma.workerAvailability.deleteMany({ where: { workerId: workerId } }),
        prisma.workerScheduleOverride.deleteMany({ where: { workerId: workerId } }),
        prisma.worker.delete({ where: { id: workerId } })
    ]);

    return NextResponse.json({ message: 'Radnik i njegov raspored uspešno obrisani.' }, { status: 200 });
  } catch (error: unknown) {
    console.error(`Greška pri brisanju radnika ${workerId} za salon ${vendorId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Radnik nije pronađen tokom pokušaja brisanja.' }, { status: 404 });
      }
      if (error.code === 'P2003' || error.code === 'P2014') {
        return NextResponse.json({ message: 'Ne možete obrisati radnika jer je povezan sa drugim zapisima (npr. istorija termina). Razmislite o deaktivaciji radnika umesto brisanja.' }, { status: 409 });
      }
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom brisanja radnika.' }, { status: 500 });
  }
}

export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const PUT = withRoleProtection(PUT_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const DELETE = withRoleProtection(DELETE_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
