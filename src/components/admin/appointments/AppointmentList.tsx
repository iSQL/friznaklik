// src/components/admin/appointments/AppointmentList.tsx
import AdminAppointmentCard from './AdminAppointmentCard';
import { AdminAppointment } from './AdminAppointmentsClient';
import { UserRole } from '@/lib/types/prisma-enums';
import { Worker as PrismaWorker } from '@prisma/client'; // Import Worker

interface AppointmentListProps {
  appointments: AdminAppointment[];
  userRole: UserRole;
  onApprove: (appointmentId: string) => Promise<void>;
  onReject: (appointmentId: string, rejectionReason?: string) => Promise<void>;
  onUpdateDuration: (appointmentId: string, newDuration: number) => Promise<void>;
  onAssignWorker: (appointmentId: string, workerId: string | null) => Promise<void>; // New prop
  vendorWorkers: PrismaWorker[]; // New prop: List of workers for the current vendor (if VENDOR_OWNER)
}

export default function AppointmentList({
  appointments,
  userRole,
  onApprove,
  onReject,
  onUpdateDuration,
  onAssignWorker,
  vendorWorkers,
}: AppointmentListProps) {
  if (!appointments || appointments.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500 dark:text-gray-400 text-lg">Nema zakazanih termina.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {appointments.map((appointment) => (
        <AdminAppointmentCard
          key={appointment.id}
          appointment={appointment}
          userRole={userRole}
          onApprove={onApprove}
          onReject={onReject}
          onUpdateDuration={onUpdateDuration}
          onAssignWorker={onAssignWorker} // Pass down
          // Pass only workers that belong to the appointment's vendor
          // This is mainly for VENDOR_OWNER. SUPER_ADMIN might need a different way to get relevant workers if they assign.
          vendorWorkers={vendorWorkers.filter(vw => vw.vendorId === appointment.vendorId)}
        />
      ))}
    </div>
  );
}
