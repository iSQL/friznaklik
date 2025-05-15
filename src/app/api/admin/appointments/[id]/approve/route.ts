
import { auth } from '@clerk/nextjs/server'; 
import { NextResponse } from 'next/server'; 
import prisma from '@/lib/prisma';
import { isAdminUser } from '@/lib/authUtils';

export async function PUT(
  request: Request 
) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const appointmentId = url.pathname.split('/').at(-2); 

  if (!appointmentId) {
    return new NextResponse('Bad Request', { status: 400 });
  }
  const isAdmin = await isAdminUser(userId);

  if (!isAdmin) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  try {
    const ownedVendor = await prisma.vendor.findUnique({
      where: { ownerId: userId },
      select: { id: true }
    });

    if (!ownedVendor) {
      console.error(`PUT /api/admin/appointments/${appointmentId}/approve: Admin user ${userId} does not own a vendor. Cannot determine default vendor.`);
      return new NextResponse('Forbidden: Admin not associated with a vendor.', { status: 403 });
    }
    const DEFAULT_VENDOR_ID = ownedVendor.id;
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId, status: 'pending', vendorId: DEFAULT_VENDOR_ID }, 
      data: {
        status: 'approved',
      },
    });

    // TODO: Trigger notification to the user about the approval.

    return NextResponse.json(updatedAppointment, { status: 200 });
  } catch (error) {
    console.error(`Error approving appointment with ID ${appointmentId}:`, error);
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return new NextResponse('Appointment not found, not pending, or does not belong to your vendor.', { status: 404 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
