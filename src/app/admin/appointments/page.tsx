// src/app/admin/appointments/page.tsx

// This is a Server Component Page. It runs on the server and is good for data fetching.
// It lives inside the /admin route segment, so it will use the AdminLayout for protection.
// Its purpose is to fetch pending appointments and render the Client Component list.

// No 'use client' directive here - this is a Server Component

import AppointmentList from '@/components/admin/appointments/AppointmentList'; // We will create this Client Component next
import { Appointment, Service, User } from '@prisma/client'; // Import necessary types from Prisma
import prisma from '@/lib/prisma'; // Import your Prisma client utility for direct database access
// Note: Authentication and authorization checks are handled by the AdminLayout parent.
// No need for auth() or isAdminUser checks directly in this page component.

// Define the type for appointments including related Service and User data
// Prisma allows including related models in queries
type AppointmentWithDetails = Appointment & {
  service: Service; // Include related Service data
  user: User;     // Include related User data
};


export default async function AdminAppointmentsPage() {
  console.log('AdminAppointmentsPage: Fetching pending appointments directly with Prisma...'); // Debug log

  let pendingAppointments: AppointmentWithDetails[] = [];
  let error: string | null = null;

  try {
    // Fetch pending appointments directly from the database using Prisma
    // Include related service and user data for display
    pendingAppointments = await prisma.appointment.findMany({
      where: {
        status: 'pending', // Fetch only appointments with status 'pending'
      },
      include: {
        service: true, // Include the related Service model data
        user: true,     // Include the related User model data
      },
      orderBy: {
        startTime: 'asc', // Order appointments by start time
      },
    });
    console.log(`AdminAppointmentsPage: Found ${pendingAppointments.length} pending appointments.`); // Debug log

  } catch (fetchError) {
    console.error('AdminAppointmentsPage: Error fetching pending appointments directly with Prisma:', fetchError); // Debug log
    error = 'Error loading pending appointments.';
  }

  // If there was an error fetching data, display an error message.
  if (error) {
     return (
        <div className="container mx-auto p-6 bg-white rounded-lg shadow-md">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Manage Appointments</h1>
            <p className="text-red-600">{error}</p>
        </div>
     );
  }


  // Render the Client Component that will display the list of appointments
  // Pass the fetched pending appointments data as a prop
  return (
    <div className="container mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Manage Appointments</h1>

      {/* Render the list of appointments using the AppointmentList Client Component */}
      {/* Pass the fetched pending appointments data as a prop */}
      <AppointmentList appointments={pendingAppointments} /> {/* This component will be created next */}

    </div>
  );
}
