import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { UserRole, AppointmentStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

const updateDurationSchema = z.object({
  newDuration: z.number().int().positive('New duration must be a positive integer (minutes).'),
});

/**
 * Handles PUT requests to update the duration (and thus endTime) of an appointment.
 * SUPER_ADMIN can modify any appointment.
 * VENDOR_OWNER can only modify appointments for their vendor.
 */
async function PUT_handler(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } // Context with Promise params
) {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    const routeParams = await context.params;
    const { id: appointmentId } = routeParams;

    if (!appointmentId) {
      return NextResponse.json({ message: 'Appointment ID is required' }, { status: 400 });
    }

    let newDuration: number;
    try {
      const body = await req.json();
      const parseResult = updateDurationSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json({ message: 'Invalid input for new duration', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
      }
      newDuration = parseResult.data.newDuration;
    } catch (e) {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { 
        startTime: true, 
        status: true, 
        vendorId: true,
      }
    });

    if (!existingAppointment) {
      return NextResponse.json({ message: 'Appointment not found.' }, { status: 404 });
    }

    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId || existingAppointment.vendorId !== user.ownedVendorId) {
        return NextResponse.json({ message: 'Forbidden: You do not have permission to modify this appointment.' }, { status: 403 });
      }
    }

    if (existingAppointment.status !== AppointmentStatus.PENDING && existingAppointment.status !== AppointmentStatus.CONFIRMED) {
      return NextResponse.json(
        { message: `Appointment duration cannot be modified. Current status: ${existingAppointment.status}` },
        { status: 409 } // Conflict
      );
    }

    const newEndTime = new Date(existingAppointment.startTime.getTime() + newDuration * 60000); // newDuration in minutes

    // TODO: Optional: Add conflict checking here.
    // Ensure the new endTime doesn't overlap with other appointments for the same vendor/worker,
    // or extend beyond operating hours.

    const updatedAppointment = await prisma.appointment.update({
      where: {
        id: appointmentId,
      },
      data: {
        endTime: newEndTime,
      },
    });

    return NextResponse.json(updatedAppointment);

  } catch (error: unknown) {
    const errorParams = await context.params;
    console.error(`Error updating duration for appointment ${errorParams.id}:`, error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      // This error means the `where` condition in `prisma.appointment.update` was not met.
      return NextResponse.json(
        { message: 'Appointment not found or was modified during processing.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: 'Internal server error while updating appointment duration' }, { status: 500 });
  }
}

export const PUT = withRoleProtection(
  PUT_handler,
  [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]
);
