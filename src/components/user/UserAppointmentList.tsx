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

type ProcessedAppointment = Omit<AppointmentWithServiceDetails, 'status' | 'startTime' | 'endTime'> & {
  id: string; 
  status: AppointmentStatus;
  startTime: Date;
  endTime: Date;
  vendor: Pick<PrismaVendor, 'name'>;
};

export type PrimaryAppointmentStatusFilter = 'all' | 'approved' | 'cancelled' | 'past';

const PRIMARY_FILTER_OPTIONS: Array<{ value: PrimaryAppointmentStatusFilter; label: string }> = [
  { value: 'all', label: 'Svi' },
  { value: 'approved', label: 'Odobreni' },
  { value: 'cancelled', label: 'Otkazani' },
  { value: 'past', label: 'Prošli' },
];

interface UserAppointmentListProps {
  appointments: AppointmentWithServiceDetails[];
}

export default function UserAppointmentList({ appointments: initialAppointments }: UserAppointmentListProps) {
  const [activeFilter, setActiveFilter] = useState<PrimaryAppointmentStatusFilter>('all');

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
        id: app.id, 
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
      filtered = appointments.filter(app => {
        switch (activeFilter) {
          case 'approved':
            return app.status === AppointmentStatus.CONFIRMED && !isPast(app.endTime);
          case 'cancelled':
            return app.status === AppointmentStatus.CANCELLED_BY_USER || app.status === AppointmentStatus.CANCELLED_BY_VENDOR;
          case 'past':
            return app.status === AppointmentStatus.COMPLETED || app.status === AppointmentStatus.NO_SHOW;
          default:
            return true; 
        }
      });
    }

    // Sort primarily by start time, most recent first for all filters
    // You might want to add secondary sorting by status if needed, especially for 'all'
    return filtered.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

  }, [appointments, activeFilter]);

  const getActiveFilterLabel = () => {
    return PRIMARY_FILTER_OPTIONS.find(opt => opt.value === activeFilter)?.label || 'Svi';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-semibold text-base-content flex items-center">
          <ListFilter className="h-6 w-6 md:h-7 md:w-7 mr-2 md:mr-3 text-primary" />
          Vaši Termini
        </h2>
        {/* Filters */}
        <div className="join w-full sm:w-auto">
          {PRIMARY_FILTER_OPTIONS.map(option => (
            <button
              key={option.value}
              className={`btn join-item btn-sm flex-grow sm:flex-grow-0 ${activeFilter === option.value ? 'btn-active btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filteredAndSortedAppointments.length === 0 ? (
        <div className="card bg-base-200 shadow-md border border-base-300/40">
          <div className="card-body items-center text-center py-10 px-4">
            <Inbox className="h-14 w-14 md:h-16 md:w-16 text-base-content opacity-30 mb-4" />
            <h2 className="card-title text-lg md:text-xl text-base-content">
              {activeFilter === 'all' ? 'Nema Zakazanih Termina' : `Nema termina sa statusom "${getActiveFilterLabel()}"`}
            </h2>
            <p className="text-base-content opacity-60 mt-1 text-sm md:text-base">
              {activeFilter === 'all'
                ? 'Trenutno nemate zakazanih termina.'
                : `Nema termina koji odgovaraju filteru "${getActiveFilterLabel()}".`}
            </p>
            {activeFilter === 'all' && (
              <Link href="/book" className="btn btn-primary mt-6">
                <CalendarPlus className="mr-2 h-5 w-5" /> Zakažite Novi Termin
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 md:space-y-4">
          {filteredAndSortedAppointments.map((appointment) => (
            <AppointmentItem key={appointment.id} appointment={appointment} />
          ))}
        </div>
      )}
    </div>
  );
}