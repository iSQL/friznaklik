'use client';

import { useState, useMemo } from 'react';
import { Appointment, Service } from '@prisma/client'; 
import { parseISO } from 'date-fns';
import AppointmentItem from '@/app/dashboard/AppointmentItem';

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

const APPOINTMENT_STATUS_OPTIONS = ['all', 'pending', 'approved', 'cancelled', 'rejected'] as const;
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
    return initialAppointments.map(app => ({
      ...app,
      service: app.service,
      startTime: typeof app.startTime === 'string' ? parseISO(app.startTime) : app.startTime,
      endTime: typeof app.endTime === 'string' ? parseISO(app.endTime) : app.endTime,
    }));
  }, [initialAppointments]);

  const filteredAndSortedAppointments = useMemo(() => {
    let filtered = appointments;

    if (activeFilter !== 'all') {
      filtered = appointments.filter(app => app.status.toLowerCase() === activeFilter);
    }

    return filtered.sort((a, b) => {
      const statusOrder = (status: string): number => {
        switch (status.toLowerCase()) {
          case 'pending': return 0;
          case 'approved': return 1;
          case 'cancelled': return 2;
          case 'rejected': return 3;
          case 'completed': return 4; 
          default: return 5; 
        }
      };

      if (activeFilter === 'all') {
        const statusComparison = statusOrder(a.status) - statusOrder(b.status);
        if (statusComparison !== 0) {
          return statusComparison;
        }
      }
      // Corrected: Sort by startTime, earliest first (ascending)
      return a.startTime.getTime() - b.startTime.getTime();
    });
  }, [appointments, activeFilter]);

  const filterOptions = useMemo(() => {
    return APPOINTMENT_STATUS_OPTIONS.map(statusValue => {
      let label = statusValue.charAt(0).toUpperCase() + statusValue.slice(1);
      if (statusValue === 'approved') {
        label = 'Upcoming';
      } else if (statusValue === 'all') {
        label = 'All';
      }
      return { value: statusValue, label: label };
    });
  }, []);


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-base-content">
          Your Appointments
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
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body items-center text-center py-10">
            <h2 className="card-title text-xl text-base-content">
              {activeFilter === 'all' ? 'No Appointments Found' : `No ${activeFilter} appointments`}
            </h2>
            <p className="text-base-content opacity-70 mt-2">
              {activeFilter === 'all'
                ? 'You currently have no appointments.'
                : `You currently have no appointments with the status "${activeFilter}".`}
            </p>
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
