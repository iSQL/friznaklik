import AppointmentList from '@/components/admin/appointments/AppointmentList';
import { Appointment, Service, User } from '@prisma/client';
import prisma from '@/lib/prisma';
import { parseISO } from 'date-fns';
import { formatErrorMessage } from '@/lib/errorUtils';
import { ServerCrash, CalendarX2 } from 'lucide-react';

export type AppointmentWithDetails = Appointment & {
  service: Service;
  user: User;
  startTime: Date;
  endTime: Date;
};

export const dynamic = 'force-dynamic';

export default async function AdminAppointmentsPage() {
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

  } catch (fetchError: unknown) {
    error = formatErrorMessage(fetchError, "loading pending appointments");
  }

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-base-300">
        <h1 className="text-3xl font-bold text-base-content">Manage Pending Appointments</h1>
        <p className="text-base-content opacity-70 mt-1">
          Review, update duration, approve, or reject pending client appointments.
        </p>
      </div>

      {error && (
        <div role="alert" className="alert alert-error shadow-lg">
          <ServerCrash className="h-6 w-6"/>
          <div>
            <h3 className="font-bold">Error Loading Appointments!</h3>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      )}

      {!error && pendingAppointments.length === 0 && (
        <div className="text-center py-10 bg-base-200 rounded-box mt-6">
            <CalendarX2 className="h-12 w-12 mx-auto text-base-content opacity-50 mb-4" />
            <p className="text-xl font-semibold text-base-content">No Pending Appointments</p>
            <p className="text-base-content opacity-70">There are currently no appointments awaiting review.</p>
        </div>
      )}

      {!error && pendingAppointments.length > 0 && (
        <AppointmentList appointments={pendingAppointments} />
      )}
    </div>
  );
}
