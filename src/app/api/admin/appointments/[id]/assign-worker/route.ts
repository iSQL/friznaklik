// src/app/api/admin/appointments/[id]/assign-worker/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { Prisma } from '@prisma/client';
import { UserRole } from '@/lib/types/prisma-enums';

import { z } from 'zod';

const assignWorkerSchema = z.object({
  workerId: z.string().cuid('ID radnika mora biti validan CUID.').nullable(), // Allow unassigning by passing null
});

interface RouteContext {
  params: Promise<{ id: string }>; // Appointment ID
}

async function PUT_handler(req: NextRequest, context: RouteContext) {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Niste autorizovani.' }, { status: 401 });
    }

    const { id: appointmentId } = await context.params;
    if (!appointmentId) {
      return NextResponse.json({ message: 'ID termina je obavezan.' }, { status: 400 });
    }

    const body = await req.json();
    const parseResult = assignWorkerSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { workerId } = parseResult.data;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { vendorId: true, status: true },
    });

    if (!appointment) {
      return NextResponse.json({ message: 'Termin nije pronađen.' }, { status: 404 });
    }

    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId || appointment.vendorId !== user.ownedVendorId) {
        return NextResponse.json({ message: 'Zabranjeno: Nemate dozvolu da menjate ovaj termin.' }, { status: 403 });
      }
    }
    // SUPER_ADMIN can assign worker to any appointment

    if (workerId) {
      const worker = await prisma.worker.findUnique({
        where: { id: workerId },
      });
      if (!worker || worker.vendorId !== appointment.vendorId) {
        return NextResponse.json({ message: 'Izabrani radnik ne postoji ili ne pripada salonu ovog termina.' }, { status: 400 });
      }
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        workerId: workerId, // workerId can be null to unassign
      },
      include: {
          worker: { select: { id: true, name: true }}
      }
    });

    return NextResponse.json(updatedAppointment);

  } catch (error: unknown) {
    const { id: appointmentId } = await context.params; // Re-access params in catch if needed
    console.error(`Greška pri dodeli radnika terminu ${appointmentId || 'unknown'}:`, error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ message: 'Termin nije pronađen.' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Interna greška servera.' }, { status: 500 });
  }
}

export const PUT = withRoleProtection(PUT_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
