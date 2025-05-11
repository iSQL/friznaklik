'use client';

import { Appointment, Service, User } from '@prisma/client';
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
      <div className="text-center py-16 bg-base-200 rounded-box shadow"> 
        <CalendarX2 className="h-16 w-16 mx-auto text-base-content opacity-40 mb-4" />
        <p className="text-xl font-semibold text-base-content">
          Nema termina za prikaz.
        </p>
        <p className="text-base-content opacity-60 mt-1 px-4"> 
          Svi termini su obrađeni ili trenutno nema novih termina na čekanju.
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