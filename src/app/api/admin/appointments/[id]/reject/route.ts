// src/app/api/admin/appointments/[id]/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { Prisma } from '@prisma/client';
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums';
import { z } from 'zod';

const rejectCancelAppointmentSchema = z.object({
  rejectionReason: z.string().min(1, "Razlog ne može biti prazan ako je naveden.").optional(),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

async function POST_handler(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Neautorizovan pristup ili korisnik nije pronađen.' }, { status: 401 });
    }

    const { id: appointmentId } = await context.params;

    if (!appointmentId) {
      return NextResponse.json({ message: 'ID termina je obavezan.' }, { status: 400 });
    }

    let reason: string | undefined;
    try {
      const body = await req.json();
      const parseResult = rejectCancelAppointmentSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json({ message: 'Nevalidan unos za razlog.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
      }
      reason = parseResult.data.rejectionReason;
    } catch (e) {
      // Body might be empty if no reason is provided, which is fine
      console.log('Telo zahteva za odbijanje/otkazivanje je prazno ili nije validan JSON.');
    }

    const existingAppointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { notes: true, status: true, vendorId: true }
    });

    if (!existingAppointment) {
        return NextResponse.json({ message: 'Termin nije pronađen.' }, { status: 404 });
    }

    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId || existingAppointment.vendorId !== user.ownedVendorId) {
        return NextResponse.json({ message: 'Zabranjeno: Nemate dozvolu da menjate ovaj termin.' }, { status: 403 });
      }
    }

    let newStatus: AppointmentStatus;
    let actionText: string;

    if (existingAppointment.status === AppointmentStatus.PENDING) {
      newStatus = AppointmentStatus.REJECTED;
      actionText = reason ? `Odbijen od strane salona: ${reason}` : "Termin odbijen od strane salona.";
    } else if (existingAppointment.status === AppointmentStatus.CONFIRMED) {
      newStatus = AppointmentStatus.CANCELLED_BY_VENDOR;
      actionText = reason ? `Otkazan od strane salona: ${reason}` : "Termin otkazan od strane salona.";
    } else {
      return NextResponse.json(
        { message: `Termin se ne može otkazati/odbiti. Trenutni status: ${existingAppointment.status}` },
        { status: 409 } // Conflict
      );
    }

    const currentNotes = existingAppointment.notes || "";
    const newNotes = `${actionText} Originalne napomene: ${currentNotes}`.trim();

    const updatedAppointment = await prisma.appointment.update({
      where: {
        id: appointmentId,
      },
      data: {
        status: newStatus,
        notes: newNotes,
      },
    });

    return NextResponse.json(updatedAppointment);

  } catch (error: unknown) {
    const { id: appointmentId } = await context.params;
    console.error(`Greška prilikom odbijanja/otkazivanja termina ${appointmentId || 'unknown'}:`, error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { message: 'Termin nije pronađen ili je izmenjen tokom obrade.' },
        { status: 404 }
      );
    }
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Nevalidan unos za razlog.', errors: error.flatten().fieldErrors }, { status: 400 });
    }

    return NextResponse.json({ message: 'Interna greška servera prilikom odbijanja/otkazivanja termina.' }, { status: 500 });
  }
}

export const POST = withRoleProtection(
  POST_handler,
  [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]
);
