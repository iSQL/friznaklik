import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { UserRole, AppointmentStatus, Prisma } from '@prisma/client'; 


/**
 * Handles POST requests to approve a PENDING appointment.
 * Changes the appointment status to CONFIRMED.
 * SUPER_ADMIN can approve any appointment.
 * VENDOR_OWNER can only approve appointments for their vendor.
 */
async function POST_handler(
  _req: NextRequest, 
  context: { params: Promise<{ id: string }> } 
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

    let vendorIdForUpdate: string | undefined = undefined;
    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId) {
        console.error(`POST /api/admin/appointments/${appointmentId}/approve: VENDOR_OWNER user ${user.id} does not own a vendor.`);
        return NextResponse.json({ message: 'Forbidden: Admin not associated with a vendor.' }, { status: 403 });
      }
      vendorIdForUpdate = user.ownedVendorId;
    }

    // This ensures we only update if the appointment exists, is PENDING,
    // and (for VENDOR_OWNER) belongs to their vendor.
    const updateWhereClause: Prisma.AppointmentWhereUniqueInput & { status: AppointmentStatus, vendorId?: string } = {
        id: appointmentId,
        status: AppointmentStatus.PENDING,
    };

    if (vendorIdForUpdate) {
        updateWhereClause.vendorId = vendorIdForUpdate;
    }

    const updatedAppointment = await prisma.appointment.update({
      where: updateWhereClause,
      data: {
        status: AppointmentStatus.CONFIRMED, 
      },
    });

    // TODO: Optional: Send a notification to the user that their appointment is confirmed.

    return NextResponse.json(updatedAppointment);

  } catch (error: unknown) {
    const errorParams = await context.params;
    console.error(`Error approving appointment ${errorParams.id}:`, error);

    // P2025: An operation failed because it depends on one or more records that were required but not found. {cause}
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      // This error means the `where` condition in `prisma.appointment.update` was not met.
      // This could be because:
      // 1. The appointmentId does not exist.
      // 2. The appointment status was not PENDING.
      // 3. For a VENDOR_OWNER, the appointment did not belong to their vendorId.
      return NextResponse.json(
        { message: 'Appointment not found, not pending, or does not belong to your vendor.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: 'Internal server error while approving appointment' }, { status: 500 });
  }
}

// Only SUPER_ADMIN and VENDOR_OWNER can approve appointments.
export const POST = withRoleProtection(
  POST_handler,
  [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]
);
