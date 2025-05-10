'use client';

import { useState, useMemo } from 'react';
import { Appointment, Service } from '@prisma/client';
import { parseISO, isPast } from 'date-fns';
import Link from 'next/link';
import AppointmentItem from '@/app/dashboard/AppointmentItem';
import { CalendarPlus, ListFilter, Inbox } from 'lucide-react';

type AppointmentWithService = Appointment & {
  service: Service;
  startTime: string | Date;
  endTime: string | Date;
};

type ProcessedAppointment = Omit<AppointmentWithService, 'startTime' | 'endTime'> & {
  service: Service;
  startTime: Date;
  endTime: Date;
};

const APPOINTMENT_STATUS_OPTIONS = ['all', 'pending', 'approved', 'completed', 'cancelled', 'rejected'] as const;
export type AppointmentStatusFilter = typeof APPOINTMENT_STATUS_OPTIONS[number];

interface UserAppointmentListProps {
  appointments: AppointmentWithServiceDetails[];
}

type AppointmentWithServiceDetails = Appointment & {
  service: Service;
  startTime: Date;
  endTime: Date;
};


export default function UserAppointmentList({ appointments: initialAppointments }: UserAppointmentListProps) {
  const [activeFilter, setActiveFilter] = useState<AppointmentStatusFilter>('all');

  const appointments = useMemo((): ProcessedAppointment[] => {
    return initialAppointments.map(app => {
      const startTime = typeof app.startTime === 'string' ? parseISO(app.startTime) : app.startTime;
      const endTime = typeof app.endTime === 'string' ? parseISO(app.endTime) : app.endTime;
      
      let status = app.status;
      if (app.status.toLowerCase() === 'approved' && isPast(endTime)) {
        status = 'completed';
      }

      return {
        ...app,
        service: app.service,
        startTime,
        endTime,
        status, 
      };
    });
  }, [initialAppointments]);

  const filteredAndSortedAppointments = useMemo(() => {
    let filtered = appointments;

    if (activeFilter !== 'all') {
      filtered = appointments.filter(app => app.status.toLowerCase() === activeFilter);
    }

    return filtered.sort((a, b) => {
      const statusOrder = (status: string): number => {
        const lowerStatus = status.toLowerCase();
        if (lowerStatus === 'pending') return 0;
        if (lowerStatus === 'approved') return 1; 
        if (lowerStatus === 'completed') return 2; 
        if (lowerStatus === 'cancelled') return 3; 
        if (lowerStatus === 'rejected') return 4; 
        return 5;
      };

      if (activeFilter === 'all') {
        const statusComparison = statusOrder(a.status) - statusOrder(b.status);
        if (statusComparison !== 0) {
          return statusComparison;
        }
      }
      return b.startTime.getTime() - a.startTime.getTime(); // Najnoviji prvo
    });
  }, [appointments, activeFilter]);
  
  const getTranslatedFilterLabel = (statusValue: AppointmentStatusFilter): string => {
    switch (statusValue) {
      case 'all': return 'Svi';
      case 'pending': return 'Na čekanju';
      case 'approved': return 'Predstojeći';
      case 'completed': return 'Završeni';
      case 'cancelled': return 'Otkazani';
      case 'rejected': return 'Odbijeni';
      default: return (statusValue as string).charAt(0).toUpperCase() + (statusValue as string).slice(1);
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