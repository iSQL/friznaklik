// src/app/dashboard/page.tsx (Refactored for Direct Prisma Fetch)

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from 'next/navigation';
import UserAppointmentList from '@/components/user/UserAppointmentList'; // Assuming this path is correct
import prisma from '@/lib/prisma'; // Import your Prisma client
import { Appointment, Service, User as PrismaUser } from '@prisma/client'; // Renamed User to PrismaUser to avoid conflict with Clerk's User
import { parseISO } from "date-fns"; // For date parsing if needed

// Define the type for appointments including related Service data
// Ensure startTime and endTime are Date objects for client components
export type AppointmentWithServiceDetails = Appointment & {
  service: Service;
  startTime: Date; // Already a Date object from Prisma
  endTime: Date;   // Already a Date object from Prisma
};

// --- This line ensures the page is dynamically rendered for each user request ---
export const dynamic = 'force-dynamic';

// Function to fetch user-specific appointments directly from the database
async function getUserAppointments(clerkUserId: string): Promise<AppointmentWithServiceDetails[]> {
  console.log(`DashboardPage: Fetching appointments directly for Clerk User ID: ${clerkUserId}`);
  try {
    // 1. Find the internal database user ID based on the Clerk user ID
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true }, // Only fetch the database user ID
    });

    if (!dbUser) {
      console.error(`DashboardPage: Database user not found for Clerk ID: ${clerkUserId}`);
      // This could happen if the webhook for user creation hasn't processed yet or failed.
      // Depending on requirements, you might throw an error or return an empty array.
      return [];
    }

    console.log(`DashboardPage: Database User ID found: ${dbUser.id}. Fetching appointments...`);

    // 2. Fetch appointments for the found database user
    const rawAppointments = await prisma.appointment.findMany({
      where: {
        userId: dbUser.id, // Filter appointments by the internal database user ID
      },
      include: {
        service: true, // Include related Service data for display
      },
      orderBy: {
        startTime: 'asc', // Order appointments by start time
      },
    });

    // Prisma returns Date objects for DateTime fields, so parseISO might be redundant here
    // unless there's a specific reason to re-parse (e.g., if data was stringified elsewhere).
    // For direct Prisma fetches, app.startTime and app.endTime should already be Date objects.
    const appointmentsWithDateObjects = rawAppointments.map(app => ({
      ...app,
      startTime: app.startTime instanceof Date ? app.startTime : parseISO(app.startTime as unknown as string),
      endTime: app.endTime instanceof Date ? app.endTime : parseISO(app.endTime as unknown as string),
    }));


    console.log(`DashboardPage: Found ${appointmentsWithDateObjects.length} user appointments directly from DB.`);
    return appointmentsWithDateObjects;

  } catch (error: any) {
    console.error('DashboardPage: Error fetching user appointments directly with Prisma:', error);
    // Re-throw the error to be caught by the page component or an error boundary
    throw new Error(`Failed to load appointments. Details: ${error.message}`);
  }
}


export default async function DashboardPage() {
  const user = await currentUser(); // Get the authenticated Clerk user

  if (!user || !user.id) {
    // If no user or user.id is not available (it should be), redirect to sign-in
    redirect('/sign-in');
  }

  console.log(`DashboardPage: User ${user.firstName} (ID: ${user.id}) is authenticated.`);

  let userAppointments: AppointmentWithServiceDetails[] = [];
  let error: string | null = null;

  try {
    // Fetch appointments directly using the authenticated user's Clerk ID
    userAppointments = await getUserAppointments(user.id);
  } catch (fetchError: any) {
    console.error('DashboardPage: Error in page trying to get appointments:', fetchError);
    error = fetchError.message || "Could not load your appointments at this time.";
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-6 text-neutral-content">
        Welcome to Your Dashboard, {user.firstName || user.username || 'User'}!
      </h1>

      {error ? (
        <div role="alert" className="alert alert-error shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-bold">Error Loading Appointments!</h3>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      ) : (
        <UserAppointmentList appointments={userAppointments} />
      )}
    </div>
  );
}
