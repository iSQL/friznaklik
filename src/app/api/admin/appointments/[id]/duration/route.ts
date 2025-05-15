import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { addMinutes } from 'date-fns';
import { isAdminUser } from '@/lib/authUtils';
import { formatErrorMessage } from '@/lib/errorUtils';
import { Prisma } from '@prisma/client';

interface UpdateDurationRequestBody {
  newDuration: number; 
}
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(
  request: Request,
  context: RouteContext 
) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const routeParams = await context.params;
  const appointmentId = routeParams.id;

  if (!appointmentId) {
    return new NextResponse(
      JSON.stringify({ error: 'Bad Request: Appointment ID is missing from URL parameters.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    return new NextResponse(
      JSON.stringify({ error: 'Forbidden: Admin access required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: UpdateDurationRequestBody;
  try {
    body = await request.json();
  } catch (parseError: unknown) {
    const friendlyMessage = formatErrorMessage(parseError, `parsing JSON body for appointment ${appointmentId} duration update`);
    return new NextResponse(
      JSON.stringify({ error: 'Invalid JSON body', details: friendlyMessage }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { newDuration } = body;
  if (typeof newDuration !== 'number' || newDuration <= 0) {
    const message = 'Invalid newDuration. Must be a positive number.';
    return new NextResponse(
      JSON.stringify({ error: message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const ownedVendor = await prisma.vendor.findUnique({
      where: { ownerId: userId },
      select: { id: true }
    });
        if (!ownedVendor) {
      console.error(`PUT /api/admin/appointments/${appointmentId}/duration: Admin user ${userId} does not own a vendor.`);
      return new NextResponse(
        JSON.stringify({ error: 'Forbidden: Admin not associated with a vendor.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const DEFAULT_VENDOR_ID = ownedVendor.id;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      console.warn(`PUT /api/admin/appointments/${appointmentId}/duration: Appointment not found.`);
      return new NextResponse(
        JSON.stringify({ error: 'Appointment not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

      if (appointment.vendorId !== DEFAULT_VENDOR_ID) {
      console.warn(`PUT /api/admin/appointments/${appointmentId}/duration: Admin ${userId} attempting to modify appointment not belonging to their vendor ${DEFAULT_VENDOR_ID}.`);
      return new NextResponse(
        JSON.stringify({ error: "Appointment not found for this vendor's scope" }),
        { status: 404, headers: { 'Content-Type': 'application/json' } } // Treat as not found for this admin
      );
    }

    const startTime = appointment.startTime instanceof Date ? appointment.startTime : new Date(appointment.startTime);
    const newEndTime = addMinutes(startTime, newDuration);

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { endTime: newEndTime },
    });

    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (e: unknown) {
    const userMessage = formatErrorMessage(e, `updating duration for appointment ${appointmentId}`);
    let statusCode = 500;
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        statusCode = 404;
      }
    }
    return new NextResponse(
      JSON.stringify({ error: "Failed to update duration", details: userMessage }),
      { status: statusCode, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
