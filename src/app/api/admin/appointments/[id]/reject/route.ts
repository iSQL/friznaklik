import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { UserRole, AppointmentStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

const rejectAppointmentSchema = z.object({
  rejectionReason: z.string().min(1, "Razlog odbijanja ne može biti prazan ako je naveden.").optional(),
});

interface RouteContext {
  params: Promise<{
    id: string; 
  }>;
}

/**
 * Handles POST requests to reject a PENDING appointment.
 * Changes the appointment status to REJECTED.
 * SUPER_ADMIN can reject any appointment.
 * VENDOR_OWNER can only reject appointments for their vendor.
 * Optionally includes a rejectionReason in the appointment notes.
 */
async function POST_handler(
  req: NextRequest, 
  context: RouteContext
) {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Neautorizovan pristup ili korisnik nije pronađen.' }, { status: 401 });
    }

    const routeParams = await context.params; 
    const { id: appointmentId } = routeParams;

    if (!appointmentId) {
      return NextResponse.json({ message: 'ID termina je obavezan.' }, { status: 400 });
    }

    let rejectionReason: string | undefined;
    try {
      const body = await req.json();
      const parseResult = rejectAppointmentSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json({ message: 'Nevalidan unos za razlog odbijanja.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
      }
      rejectionReason = parseResult.data.rejectionReason;
    } catch (e) {
      
      console.log('Telo zahteva za odbijanje je prazno ili nije validan JSON.');
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
        return NextResponse.json({ message: 'Zabranjeno: Nemate dozvolu da odbijete ovaj termin.' }, { status: 403 });
      }
    }

    if (existingAppointment.status !== AppointmentStatus.PENDING) {
      return NextResponse.json(
        { message: `Termin se ne može odbiti. Trenutni status: ${existingAppointment.status}` },
        { status: 409 } // Conflict
      );
    }

    const currentNotes = existingAppointment.notes || "";
    const newNotes = rejectionReason 
      ? `Odbijen od strane salona: ${rejectionReason}. Originalne napomene: ${currentNotes}`.trim() 
      : `Termin odbijen od strane salona. Originalne napomene: ${currentNotes}`.trim();

    const updatedAppointment = await prisma.appointment.update({
      where: { 
        id: appointmentId,
      },
      data: {
        status: AppointmentStatus.REJECTED,
        notes: newNotes,
      },
    });

    // TODO: Opciono: Poslati notifikaciju korisniku da je njegov termin odbijen.

    return NextResponse.json(updatedAppointment);

  } catch (error: unknown) {
    const errorParams = await context.params; 
    console.error(`Greška prilikom odbijanja termina ${errorParams?.id || 'unknown'}:`, error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { message: 'Termin nije pronađen, nije na čekanju, ili ne pripada Vašem salonu (ili je izmenjen tokom obrade).' },
        { status: 404 }
      );
    }
    if (error instanceof z.ZodError) { 
        return NextResponse.json({ message: 'Nevalidan unos za razlog odbijanja.', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    
    return NextResponse.json({ message: 'Interna greška servera prilikom odbijanja termina.' }, { status: 500 });
  }
}

export const POST = withRoleProtection(
  POST_handler,
  [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]
);
