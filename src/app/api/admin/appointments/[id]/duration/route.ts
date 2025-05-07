// Refactored PUT handler for updating appointment duration
// src/app/api/admin/appointments/[id]/duration/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { addMinutes } from 'date-fns';
import { isAdminUser } from '@/lib/authUtils';

export async function PUT(request: Request) {
  const url = new URL(request.url);
  const appointmentId = url.pathname.split('/').pop();

  const { userId } = await auth();
  if (!userId) {
    return new NextResponse('Authentication required', { status: 401 });
  }

  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    return new NextResponse('Forbidden: Admin access required', { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new NextResponse('Invalid JSON body', { status: 400 });
  }

  const { newDuration } = body;
  if (typeof newDuration !== 'number' || newDuration <= 0) {
    return new NextResponse('Invalid newDuration. Must be a positive number.', { status: 400 });
  }

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId! } });
  if (!appointment) {
    return new NextResponse('Appointment not found', { status: 404 });
  }

  const newEndTime = addMinutes(appointment.startTime, newDuration);

  try {
    const updated = await prisma.appointment.update({
      where: { id: appointmentId! },
      data: { endTime: newEndTime },
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    if (e.code === 'P2025') {
      return new NextResponse('Appointment not found for update', { status: 404 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
