// src/app/api/admin/vendors/[vendorId]/workers/[workerId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { UserRole, Prisma, Worker } from '@prisma/client';
import { z } from 'zod';

// Zod schema for updating a worker
const updateWorkerSchema = z.object({
  name: z.string().min(1, 'Ime radnika je obavezno.').optional(),
  bio: z.string().optional().nullable(),
  photoUrl: z.string().url('URL fotografije nije validan.').optional().nullable(),
  // Linking/unlinking userClerkId is more complex and might be a separate endpoint or require more logic
  // For now, we'll focus on basic details. userClerkId is set at creation.
});

interface RouteContext {
  params: Promise<{
    vendorId: string;
    workerId: string;
  }>;
}

// Helper function to check worker ownership
async function verifyWorkerOwnership(
  user: AuthenticatedUser,
  vendorIdFromParams: string,
  workerIdFromParams: string
): Promise<Worker | null | 'FORBIDDEN' | 'NOT_FOUND'> {
  const worker = await prisma.worker.findUnique({
    where: { id: workerIdFromParams },
  });

  if (!worker) {
    return 'NOT_FOUND';
  }

  if (worker.vendorId !== vendorIdFromParams) {
    // This case should ideally not happen if routes are structured well,
    // but good for an extra layer of security.
    return 'NOT_FOUND'; // Or FORBIDDEN, as it's a mismatch
  }

  if (user.role === UserRole.VENDOR_OWNER) {
    if (!user.ownedVendorId || user.ownedVendorId !== vendorIdFromParams) {
      return 'FORBIDDEN';
    }
  }
  // SUPER_ADMIN has access if worker and vendorId match
  return worker;
}


// GET handler to fetch a specific worker
async function GET_handler(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Korisnik nije pronađen nakon autentifikacije.' }, { status: 404 });
  }

  const { vendorId, workerId } = await context.params;

  const workerCheckResult = await verifyWorkerOwnership(user, vendorId, workerId);

  if (workerCheckResult === 'NOT_FOUND') {
    return NextResponse.json({ message: `Radnik sa ID ${workerId} nije pronađen za salon ${vendorId}.` }, { status: 404 });
  }
  if (workerCheckResult === 'FORBIDDEN') {
    return NextResponse.json({ message: 'Zabranjeno: Nemate pristup ovom radniku.' }, { status: 403 });
  }

  // workerCheckResult is the worker object here
  return NextResponse.json(workerCheckResult);
}

// PUT handler to update a worker
async function PUT_handler(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Korisnik nije pronađen nakon autentifikacije.' }, { status: 404 });
  }

  const { vendorId, workerId } = await context.params;

  const workerCheckResult = await verifyWorkerOwnership(user, vendorId, workerId);

  if (workerCheckResult === 'NOT_FOUND') {
    return NextResponse.json({ message: `Radnik sa ID ${workerId} nije pronađen za salon ${vendorId} za ažuriranje.` }, { status: 404 });
  }
  if (workerCheckResult === 'FORBIDDEN') {
    return NextResponse.json({ message: 'Zabranjeno: Ne možete ažurirati ovog radnika.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parseResult = updateWorkerSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    if (Object.keys(parseResult.data).length === 0) {
        return NextResponse.json({ message: 'Nema podataka za ažuriranje.' }, { status: 400 });
    }

    const updatedWorker = await prisma.worker.update({
      where: { id: workerId },
      data: parseResult.data,
    });

    return NextResponse.json(updatedWorker);
  } catch (error: unknown) {
    console.error(`Greška pri ažuriranju radnika ${workerId} za salon ${vendorId}:`, error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom ažuriranja radnika.' }, { status: 500 });
  }
}

// DELETE handler to delete a worker
async function DELETE_handler(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Korisnik nije pronađen nakon autentifikacije.' }, { status: 404 });
  }

  const { vendorId, workerId } = await context.params;

  const workerCheckResult = await verifyWorkerOwnership(user, vendorId, workerId);

  if (workerCheckResult === 'NOT_FOUND') {
    return NextResponse.json({ message: `Radnik sa ID ${workerId} nije pronađen za salon ${vendorId} za brisanje.` }, { status: 404 });
  }
  if (workerCheckResult === 'FORBIDDEN') {
    return NextResponse.json({ message: 'Zabranjeno: Ne možete obrisati ovog radnika.' }, { status: 403 });
  }

  try {
    // Phase 2: Simple delete.
    // Future consideration: Check for active appointments and prevent deletion or reassign.
    const assignedAppointmentsCount = await prisma.appointment.count({
        where: {
            workerId: workerId,
            status: { in: ['PENDING', 'CONFIRMED'] } // Consider only active/future appointments
        }
    });

    if (assignedAppointmentsCount > 0) {
        return NextResponse.json({
            message: `Ne možete obrisati radnika jer ima ${assignedAppointmentsCount} aktivnih ili termina na čekanju. Molimo prvo otkažite ili prerasporedite te termine.`
        }, { status: 409 }); // 409 Conflict
    }

    await prisma.worker.delete({
      where: { id: workerId },
    });

    return NextResponse.json({ message: 'Radnik uspešno obrisan.' }, { status: 200 });
  } catch (error: unknown) {
    console.error(`Greška pri brisanju radnika ${workerId} za salon ${vendorId}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return NextResponse.json({ message: 'Radnik nije pronađen za brisanje.' }, { status: 404 });
      }
      // P2003: Foreign key constraint failed on the field: `Appointment_workerId_fkey (index)`
      // This might occur if appointments are not properly handled before deletion,
      // though the check above should prevent it for PENDING/CONFIRMED.
      if (error.code === 'P2003') {
        return NextResponse.json({ message: 'Ne možete obrisati radnika jer je povezan sa postojećim terminima.' }, { status: 409 });
      }
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom brisanja radnika.' }, { status: 500 });
  }
}

// Apply role protection
export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const PUT = withRoleProtection(PUT_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const DELETE = withRoleProtection(DELETE_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
