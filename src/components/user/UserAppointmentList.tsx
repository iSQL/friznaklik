'use client';

import { useState, useMemo } from 'react';
import type { Appointment as PrismaAppointment, Service as PrismaService, Vendor as PrismaVendor, Worker as PrismaWorker } from '@prisma/client';
import { AppointmentStatus } from '@/lib/types/prisma-enums';
import { parseISO, isPast } from 'date-fns';
import Link from 'next/link';
import AppointmentItem from '@/app/dashboard/AppointmentItem';
import { CalendarPlus, ListFilter, Inbox } from 'lucide-react';


export interface AppointmentWithServiceDetails extends PrismaAppointment {
  service: PrismaService;
  vendor: Pick<PrismaVendor, 'name'>;
  worker?: PrismaWorker | null; 
  startTime: Date;
  endTime: Date;
}


type ProcessedAppointment = Omit<AppointmentWithServiceDetails, 'status'> & {
  status: AppointmentStatus;
  vendor: Pick<PrismaVendor, 'name'>;
};

const APPOINTMENT_STATUS_OPTIONS = [
  'all', 
  ...Object.values(AppointmentStatus), 
] as const;

export type AppointmentStatusFilter = typeof APPOINTMENT_STATUS_OPTIONS[number];

interface UserAppointmentListProps {
  appointments: AppointmentWithServiceDetails[]; // Lista termina koja dolazi sa servera
}

export default function UserAppointmentList({ appointments: initialAppointments }: UserAppointmentListProps) {
  const [activeFilter, setActiveFilter] = useState<AppointmentStatusFilter>('all');

  const appointments = useMemo((): ProcessedAppointment[] => {
    return initialAppointments.map(app => {
      const startTime = app.startTime instanceof Date ? app.startTime : parseISO(app.startTime as unknown as string);
      const endTime = app.endTime instanceof Date ? app.endTime : parseISO(app.endTime as unknown as string);

      let currentStatus: AppointmentStatus = app.status as AppointmentStatus;

      if (currentStatus === AppointmentStatus.CONFIRMED && isPast(endTime)) {
        currentStatus = AppointmentStatus.COMPLETED;
      }

      return {
        ...app, 
        startTime,
        endTime,
        status: currentStatus,
        vendor: app.vendor, 
      };
    });
  }, [initialAppointments]);

  const filteredAndSortedAppointments = useMemo(() => {
    let filtered = appointments;

    if (activeFilter !== 'all') {
      filtered = appointments.filter(app => app.status === activeFilter);
    }

    return filtered.sort((a, b) => {
      const statusOrder = (status: AppointmentStatus): number => {
        if (status === AppointmentStatus.PENDING) return 0;
        if (status === AppointmentStatus.CONFIRMED) return 1;
        if (status === AppointmentStatus.COMPLETED) return 2;
        if (status === AppointmentStatus.CANCELLED_BY_USER) return 3;
        if (status === AppointmentStatus.CANCELLED_BY_VENDOR) return 3;
        if (status === AppointmentStatus.REJECTED) return 4;
        if (status === AppointmentStatus.NO_SHOW) return 5;
        return 6;
      };

      if (activeFilter === 'all') {
        const statusComparison = statusOrder(a.status) - statusOrder(b.status);
        if (statusComparison !== 0) {
          return statusComparison;
        }
      }
      return b.startTime.getTime() - a.startTime.getTime();
    });
  }, [appointments, activeFilter]);

  const getTranslatedFilterLabel = (statusValue: AppointmentStatusFilter): string => {
    if (statusValue === 'all') return 'Svi';
    switch (statusValue as AppointmentStatus) {
      case AppointmentStatus.PENDING: return 'Na čekanju';
      case AppointmentStatus.CONFIRMED: return 'Predstojeći / Odobreni';
      case AppointmentStatus.COMPLETED: return 'Završeni';
      case AppointmentStatus.CANCELLED_BY_USER: return 'Otkazao korisnik';
      case AppointmentStatus.CANCELLED_BY_VENDOR: return 'Otkazao salon';
      case AppointmentStatus.REJECTED: return 'Odbijeni';
      case AppointmentStatus.NO_SHOW: return 'Nije se pojavio';
      default:
        const s = statusValue as string;
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ');
    }
  };

  const filterOptions = useMemo(() => {
    return APPOINTMENT_STATUS_OPTIONS.map(statusValue => ({
        value: statusValue,
        label: getTranslatedFilterLabel(statusValue)
    }));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-base-content flex items-center">
          <ListFilter className="h-7 w-7 mr-3 text-primary" />
          Vaši Termini
        </h2>
        <div className="join">
          {filterOptions.map(option => (
            <button
              key={option.value}
              className={`btn join-item btn-sm sm:btn-md ${activeFilter === option.value ? 'btn-active btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filteredAndSortedAppointments.length === 0 ? (
        <div className="card bg-base-200 shadow-xl border border-base-300">
          <div className="card-body items-center text-center py-10">
              <Inbox className="h-16 w-16 text-base-content opacity-40 mb-4" />
            <h2 className="card-title text-xl text-base-content">
              {activeFilter === 'all' ? 'Nema Zakazanih Termina' : `Nema termina sa statusom "${getTranslatedFilterLabel(activeFilter)}"`}
            </h2>
            <p className="text-base-content opacity-70 mt-2">
              {activeFilter === 'all'
                ? 'Trenutno nemate zakazanih termina.'
                : `Trenutno nemate termina sa statusom "${getTranslatedFilterLabel(activeFilter)}".`}
            </p>
            {activeFilter === 'all' && (
                <Link href="/book" className="btn btn-primary mt-6">
                    <CalendarPlus className="mr-2 h-5 w-5" /> Zakažite Novi Termin
                </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedAppointments.map((appointment) => (
            <AppointmentItem key={appointment.id} appointment={appointment} />
          ))}
        </div>
      )}
    </div>
  );
}