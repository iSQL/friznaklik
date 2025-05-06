// src/components/admin/appointments/AppointmentList.tsx
'use client';

import { Appointment, Service, User } from '@prisma/client';
import AdminAppointmentCard from './AdminAppointmentCard'; // We'll create this next

// Define the type for appointments including related Service and User data
export type AppointmentWithDetails = Appointment & {
  service: Service;
  user: User;
};

interface AppointmentListProps {
  appointments: AppointmentWithDetails[];
}

export default function AppointmentList({ appointments }: AppointmentListProps) {
  if (!appointments || appointments.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-lg text-neutral-content/70">
          No pending appointments found.
        </p>
      </div>
    );
  }

  // Function to refresh data (passed to child components if needed, or use router.refresh() directly in child)
  // For simplicity, router.refresh() can be called directly in AdminAppointmentCard after an update.

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
