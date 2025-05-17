// src/app/api/admin/appointments/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { Prisma } from '@prisma/client';
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums';

async function POST_handler(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Niste autorizovani.' }, { status: 401 });
    }

    const { id: appointmentId } = await context.params;
    if (!appointmentId) {
      return NextResponse.json({ message: 'ID termina je obavezan.' }, { status: 400 });
    }

    const appointmentToApprove = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { status: true, vendorId: true, workerId: true }, // Select workerId to check if already assigned
    });

    if (!appointmentToApprove) {
      return NextResponse.json({ message: 'Termin nije pronađen.' }, { status: 404 });
    }

    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId || appointmentToApprove.vendorId !== user.ownedVendorId) {
        return NextResponse.json({ message: 'Zabranjeno: Nemate dozvolu da odobrite ovaj termin.' }, { status: 403 });
      }
    }

    if (appointmentToApprove.status !== AppointmentStatus.PENDING) {
      return NextResponse.json(
        { message: `Termin se ne može odobriti. Trenutni status: ${appointmentToApprove.status}` },
        { status: 409 }
      );
    }

    let dataToUpdate: Prisma.AppointmentUpdateInput = {
      status: AppointmentStatus.CONFIRMED,
    };

    // Automatic assignment logic if no worker is assigned yet
    if (!appointmentToApprove.workerId) {
      const workersOfVendor = await prisma.worker.findMany({
        where: { vendorId: appointmentToApprove.vendorId },
        select: { id: true },
        // Add orderBy if you have a preference for "first"
        // orderBy: { createdAt: 'asc' } // Example: oldest worker first
      });

      if (workersOfVendor.length > 0) {
        // Correct way to update a foreign key via relation
        dataToUpdate.worker = {
          connect: {
            id: workersOfVendor[0].id,
          },
        };
        console.log(`Termin ${appointmentId} automatski dodeljen radniku ${workersOfVendor[0].id} prilikom odobravanja.`);
      } else {
        console.log(`Nema dostupnih radnika u salonu ${appointmentToApprove.vendorId} za automatsku dodelu terminu ${appointmentId}.`);
        // Optionally, you could prevent approval if no worker can be assigned, or leave it as is.
        // If you want to explicitly set workerId to null if no workers are found (though it's already null):
        // dataToUpdate.workerId = null; // Or worker: { disconnect: true } if it was previously connected
      }
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: dataToUpdate,
      include: { // Return worker details
          worker: { select: {id: true, name: true}}
      }
    });

    return NextResponse.json(updatedAppointment);

  } catch (error: unknown) {
    const { id: appointmentId } = await context.params; // Re-access params in catch
    console.error(`Greška pri odobravanju termina ${appointmentId || 'unknown'}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { message: 'Termin nije pronađen ili nije na čekanju.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ message: 'Interna greška servera.' }, { status: 500 });
  }
}

export const POST = withRoleProtection(
  POST_handler,
  [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]
);
