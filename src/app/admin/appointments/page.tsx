// src/app/admin/appointments/page.tsx

// This is a Server Component Page. It runs on the server and is good for data fetching.
// It lives inside the /admin route segment, so it will use the AdminLayout for protection.
// Its purpose is to fetch pending appointments and render the Client Component list.

import AppointmentList from '@/components/admin/appointments/AppointmentList'; // Client Component to display the list
import { Appointment, Service, User } from '@prisma/client'; // Import necessary types from Prisma
import prisma from '@/lib/prisma'; // Import your Prisma client utility
import { parseISO } from 'date-fns'; // To ensure date fields are Date objects

// Define the type for appointments including related Service and User data
// This type is used by AppointmentList and AdminAppointmentCard as well
export type AppointmentWithDetails = Appointment & {
  service: Service;
  user: User;
  // Ensure startTime and endTime are Date objects for client components
  startTime: Date;
  endTime: Date;
};

export default async function AdminAppointmentsPage() {
  console.log('AdminAppointmentsPage: Fetching pending appointments directly with Prisma...');

  let pendingAppointments: AppointmentWithDetails[] = [];
  let error: string | null = null;

  try {
    // Fetch pending appointments directly from the database using Prisma
    // Include related service and user data for display
    const rawAppointments = await prisma.appointment.findMany({
      where: {
        status: 'pending', // Fetch only appointments with status 'pending'
      },
      include: {
        service: true, // Include the related Service model data
        user: true,    // Include the related User model data
      },
      orderBy: {
        startTime: 'asc', // Order pending appointments by start time
      },
    });

    // Ensure startTime and endTime are Date objects before passing to client components
    pendingAppointments = rawAppointments.map(app => ({
      ...app,
      startTime: typeof app.startTime === 'string' ? parseISO(app.startTime) : app.startTime,
      endTime: typeof app.endTime === 'string' ? parseISO(app.endTime) : app.endTime,
    }));

    console.log(`AdminAppointmentsPage: Found ${pendingAppointments.length} pending appointments.`);

  } catch (fetchError: any) {
    console.error('AdminAppointmentsPage: Error fetching pending appointments directly with Prisma:', fetchError);
    let errorMessage = 'Error loading pending appointments.';
    if (fetchError.message) {
        errorMessage += ` Details: ${fetchError.message}`;
    }
    if (fetchError.code) {
        console.error(`Prisma error code: ${fetchError.code}`);
    }
    error = errorMessage;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-content">Manage Pending Appointments</h1>
        <p className="text-neutral-content/80">
          Review, update duration, approve, or reject pending client appointments.
        </p>
      </div>

      {error && (
        <div role="alert" className="alert alert-error shadow-lg max-w-2xl mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-bold">Error Loading Appointments!</h3>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      )}

      {!error && (
        // Render the list of appointments using the AppointmentList Client Component
        // Pass the fetched pending appointments data as a prop
        <AppointmentList appointments={pendingAppointments} />
      )}
    </div>
  );
}
