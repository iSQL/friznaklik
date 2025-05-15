

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

  let appointmentId: string | undefined;
  try {
      const url = new URL(request.url);
      // Example URL: /api/admin/appointments/some-id/reject
      // Split by '/' -> ['', 'api', 'admin', 'appointments', 'some-id', 'reject']
      // The ID should be the second to last element
      appointmentId = url.pathname.split('/').at(-2);
  } catch (urlError) {
       console.error('PUT /api/admin/appointments/reject: Error parsing request URL:', urlError);
       return new NextResponse('Internal Server Error', { status: 500 });
  }



  if (!appointmentId) {
    return new NextResponse('Bad Request: Invalid Appointment ID in URL', { status: 400 });
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
      console.error(`PUT /api/admin/appointments/${appointmentId}/reject: Admin user ${userId} does not own a vendor.`);
      return new NextResponse(
        JSON.stringify({ error: 'Forbidden: Admin not associated with a vendor.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const DEFAULT_VENDOR_ID = ownedVendor.id;

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId, status: 'pending', vendorId: DEFAULT_VENDOR_ID }, 
      data: {
        status: 'rejected', //TODO: check about adding rejected reason
      },
    });
    
    // TODO: Trigger notification (e.g., email) to the user about the rejection
    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (error) {
    console.error(`Error rejecting appointment with ID ${appointmentId}:`, error);
     if (error instanceof Error && error.message.includes('Record to update not found')) {
       return new NextResponse('Appointment not found or not pending', { status: 404 });
     }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
