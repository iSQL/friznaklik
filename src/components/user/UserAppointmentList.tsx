// src/components/user/UserAppointmentList.tsx
'use client';

import { useState, useMemo } from 'react';
import { Appointment, Service } from '@prisma/client'; // Assuming Prisma types
import { parseISO } from 'date-fns'; // For parsing date strings
import AppointmentItem from '@/app/dashboard/AppointmentItem'; // Adjust path if necessary

// Define the type for appointments including related Service data
// Ensuring startTime and endTime are handled as Date objects internally after parsing
type AppointmentWithService = Appointment & {
  service: Service;
  startTime: string | Date; // From props, could be string or Date
  endTime: string | Date;   // From props, could be string or Date
};

// This is the type of appointment object AppointmentItem expects (with Date objects)
type ProcessedAppointment = Omit<AppointmentWithService, 'startTime' | 'endTime'> & {
  service: Service;
  startTime: Date;
  endTime: Date;
};

// Define the props for the UserAppointmentList component
interface UserAppointmentListProps {
  appointments: AppointmentWithService[]; // Expects an array of user appointments
}

// Define available appointment statuses for filtering
// Renamed from _appointmentStatuses and will be used to generate filter options
const APPOINTMENT_STATUS_OPTIONS = ['all', 'pending', 'approved', 'cancelled', 'rejected'] as const;
export type AppointmentStatusFilter = typeof APPOINTMENT_STATUS_OPTIONS[number];


export default function UserAppointmentList({ appointments: initialAppointments }: UserAppointmentListProps) {
  const [activeFilter, setActiveFilter] = useState<AppointmentStatusFilter>('all');

  // Memoize the appointments list with parsed dates for performance and consistency
  // Prisma might return Date objects, but JSON serialization turns them to strings.
  const appointments = useMemo((): ProcessedAppointment[] => {
    return initialAppointments.map(app => ({
      ...app,
      // Ensure service object is correctly passed
      service: app.service,
      // Parse startTime and endTime if they are strings
      startTime: typeof app.startTime === 'string' ? parseISO(app.startTime) : app.startTime,
      endTime: typeof app.endTime === 'string' ? parseISO(app.endTime) : app.endTime,
    }));
  }, [initialAppointments]);

  const filteredAndSortedAppointments = useMemo(() => {
    let filtered = appointments;

    // 1. Filter based on activeFilter
    if (activeFilter !== 'all') {
      filtered = appointments.filter(app => app.status === activeFilter);
    }

    // 2. Sort the filtered appointments
    return filtered.sort((a, b) => {
      // Helper to define a sort order for statuses
      const statusOrder = (status: string): number => {
        switch (status.toLowerCase()) { // Use toLowerCase for robustness
          case 'pending': return 0;
          case 'approved': return 1;
          // You can add more statuses here if needed, e.g., 'rescheduled', 'confirmed'
          case 'cancelled': return 2;
          case 'rejected': return 3;
          case 'completed': return 4; // Example if you have a 'completed' status
          default: return 5; // Other statuses appear last
        }
      };

      // If 'all' filter is active, sort by status first
      if (activeFilter === 'all') {
        const statusComparison = statusOrder(a.status) - statusOrder(b.status);
        if (statusComparison !== 0) {
          return statusComparison;
        }
      }

      // Secondary sort: by startTime, most recent/upcoming first (descending)
      // getTime() returns milliseconds, ensuring correct numerical comparison
      return b.startTime.getTime() - a.startTime.getTime();
    });
  }, [appointments, activeFilter]);

  // Define options for the filter buttons by mapping over APPOINTMENT_STATUS_OPTIONS
  const filterOptions = useMemo(() => {
    return APPOINTMENT_STATUS_OPTIONS.map(statusValue => {
      let label = statusValue.charAt(0).toUpperCase() + statusValue.slice(1); // Default label (e.g., "Pending")
      
      // Customize labels for specific statuses if needed
      if (statusValue === 'approved') {
        label = 'Upcoming'; // "Approved" often means upcoming
      } else if (statusValue === 'all') {
        label = 'All';
      }
      // Add more custom labels here if necessary
      // else if (statusValue === 'someOtherStatus') {
      //   label = 'Custom Label';
      // }

      return { value: statusValue, label: label };
    });
  }, []); // APPOINTMENT_STATUS_OPTIONS is a constant, so dependency array is empty or can include it if it were dynamic.


  return (
    <div className="mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-neutral-content">
          Your Appointments
        </h2>
        <div className="btn-group">
          {filterOptions.map(option => (
            <button
              key={option.value}
              className={`btn btn-sm sm:btn-md ${activeFilter === option.value ? 'btn-active btn-primary' : 'btn-ghost'}`}
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
            <h2 className="card-title text-xl">
              {activeFilter === 'all' ? 'No Appointments Found' : `No ${activeFilter} appointments`}
            </h2>
            <p className="text-base-content/70 mt-2">
              {activeFilter === 'all'
                ? 'There are no appointments matching your criteria.'
                : `You currently have no appointments with the status "${activeFilter}".`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredAndSortedAppointments.map((appointment) => (
            // The appointment object passed here now has startTime and endTime as Date objects
            <AppointmentItem key={appointment.id} appointment={appointment} />
          ))}
        </div>
      )}
    </div>
  );
}
