'use client';

import { Appointment, Service, User } from '@prisma/client'; // Types only
import AdminAppointmentCard from './AdminAppointmentCard';
import { CalendarX2 } from 'lucide-react';

export type AppointmentWithDetails = Appointment & {
  service: Service;
  user: User;
  startTime: Date;
  endTime: Date;
};

interface AppointmentListProps {
  appointments: AppointmentWithDetails[];
}

export default function AppointmentList({ appointments }: AppointmentListProps) {
  if (!appointments || appointments.length === 0) {
    return (
      <div className="text-center py-16 bg-base-200 rounded-box">
        <CalendarX2 className="h-16 w-16 mx-auto text-base-content opacity-40 mb-4" />
        <p className="text-xl font-semibold text-base-content">
          No appointments to display.
        </p>
        <p className="text-base-content opacity-60 mt-1">
          All pending appointments have been processed or there are none.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {appointments.map((appointment) => (
        <AdminAppointmentCard
          key={appointment.id}
          appointment={appointment}
        />
      ))}
    </div>
  );
}
