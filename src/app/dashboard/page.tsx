// src/app/dashboard/page.tsx

// Import necessary modules
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { Appointment, Service } from '@prisma/client';
// Removed date-fns format import as formatting is now in AppointmentItem

// Import the new Client Component
import AppointmentItem from './AppointmentItem'; // Adjust path if needed

// Define a type for appointments that include the related service
type AppointmentWithService = Appointment & {
  service: Service;
};

/**
 * Server-side function to fetch appointments directly from the database
 * for the currently authenticated user.
 * @returns {Promise<AppointmentWithService[]>} A promise that resolves to an array of appointments with service details.
 */
async function getUserAppointments(): Promise<AppointmentWithService[]> {
  console.log('getUserAppointments: Fetching appointments directly from DB...');
  try {
    const { userId } = await auth();
    if (!userId) {
      console.log('getUserAppointments: User not authenticated.');
      return [];
    }
    console.log('getUserAppointments: Clerk userId:', userId);

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });

    if (!dbUser) {
      console.error('getUserAppointments: Database user not found for clerkId:', userId);
      return [];
    }
    console.log(`getUserAppointments: Database userId: ${dbUser.id}`);

    const userAppointments = await prisma.appointment.findMany({
      where: {
        userId: dbUser.id,
      },
      include: {
        service: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    console.log(`getUserAppointments: Found ${userAppointments.length} appointments.`);
    return userAppointments;

  } catch (error) {
    console.error('Error fetching user appointments directly:', error);
    return [];
  }
}


// --- Your Dashboard Page Component ---
export default async function DashboardPage() {

  // Fetch appointments directly when the page renders on the server
  const appointments = await getUserAppointments();

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">
        My Appointments
      </h1>

      {appointments.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">You have no upcoming appointments.</p>
      ) : (
        <div className="space-y-4">
          {/* Map over appointments and render the AppointmentItem client component for each */}
          {appointments.map((appointment) => (
            <AppointmentItem key={appointment.id} appointment={appointment} />
          ))}
        </div>
      )}
    </div>
  );
}
