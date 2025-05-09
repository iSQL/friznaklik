// src/app/admin/appointments/page.tsx

import AppointmentList from '@/components/admin/appointments/AppointmentList';
import { Appointment, Service, User } from '@prisma/client';
import prisma from '@/lib/prisma';
import { parseISO } from 'date-fns';
import { formatErrorMessage } from '@/lib/errorUtils'; // Import the new utility

export type AppointmentWithDetails = Appointment & {
  service: Service;
  user: User;
  startTime: Date;
  endTime: Date;
};

export const dynamic = 'force-dynamic';

export default async function AdminAppointmentsPage() {
  console.log('AdminAppointmentsPage: Fetching pending appointments directly with Prisma (dynamic rendering)...');

  let pendingAppointments: AppointmentWithDetails[] = [];
  let error: string | null = null;

  try {
    const rawAppointments = await prisma.appointment.findMany({
      where: {
        status: 'pending',
      },
      include: {
        service: true,
        user: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    pendingAppointments = rawAppointments.map(app => ({
      ...app,
      startTime: app.startTime instanceof Date ? app.startTime : parseISO(app.startTime as unknown as string),
      endTime: app.endTime instanceof Date ? app.endTime : parseISO(app.endTime as unknown as string),
    }));

    console.log(`AdminAppointmentsPage: Found ${pendingAppointments.length} pending appointments.`);

  } catch (fetchError: unknown) {
    // Use the centralized error formatting function
    error = formatErrorMessage(fetchError, "loading pending appointments");
    // The detailed console.error is now handled within formatErrorMessage
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-content">Manage Pending Appointments</h1>
        <p className="text-neutral-content/80">
          Review, update duration, approve, or reject pending client appointments.
        </p>
      </div>

      {error && (
        <div role="alert" className="alert alert-error shadow-lg max-w-2xl mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-bold">Error Loading Appointments!</h3>
            <div className="text-xs">{error}</div> {/* Display the formatted error message */}
          </div>
        </div>
      )}

      {!error && (
        <AppointmentList appointments={pendingAppointments} />
      )}
    </div>
  );
}
