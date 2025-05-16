import AdminAppointmentCard from './AdminAppointmentCard';
import { AdminAppointment } from './AdminAppointmentsClient';
import { UserRole } from '@/lib/types/prisma-enums';

interface AppointmentListProps {
  appointments: AdminAppointment[];
  userRole: UserRole;
  onApprove: (appointmentId: string) => Promise<void>;
  onReject: (appointmentId: string, rejectionReason?: string) => Promise<void>;
  onUpdateDuration: (appointmentId: string, newDuration: number) => Promise<void>;
}

export default function AppointmentList({
  appointments,
  userRole,
  onApprove,
  onReject,
  onUpdateDuration,
}: AppointmentListProps) {
  if (!appointments || appointments.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500 dark:text-gray-400 text-lg">Nema zakazanih termina.</p>
        {/* Može se dodatni tekst ili poziv na akciju ako je potrebno */}
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
        />
      ))}
    </div>
  );
}
