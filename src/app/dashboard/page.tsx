// src/app/dashboard/page.tsx (Refactored for Direct Prisma Fetch & Error Utility)

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from 'next/navigation';
import UserAppointmentList from '@/components/user/UserAppointmentList'; 
import prisma from '@/lib/prisma'; 
import { Appointment, Service } from '@prisma/client'; // Import Prisma for specific error types
import { parseISO } from "date-fns"; 
import { formatErrorMessage } from '@/lib/errorUtils'; // Import the error utility

// Define the type for appointments including related Service data
export type AppointmentWithServiceDetails = Appointment & {
  service: Service;
  startTime: Date; 
  endTime: Date;   
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
      select: { id: true }, 
    });

    if (!dbUser) {
      // This specific case might not need formatErrorMessage, as it's a known "not found" scenario.
      // However, for consistency, we could use it or throw a specific error type.
      console.warn(`DashboardPage: Database user not found for Clerk ID: ${clerkUserId}. Returning empty array.`);
      // If you want to treat this as an error to be displayed, throw one:
      // throw new Error(`User profile not found in our system. Please contact support if this persists.`);
      return []; // Or throw an error to be caught by the page
    }

    console.log(`DashboardPage: Database User ID found: ${dbUser.id}. Fetching appointments...`);

    // 2. Fetch appointments for the found database user
    const rawAppointments = await prisma.appointment.findMany({
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

    const appointmentsWithDateObjects = rawAppointments.map(app => ({
      ...app,
      startTime: app.startTime instanceof Date ? app.startTime : parseISO(app.startTime as unknown as string),
      endTime: app.endTime instanceof Date ? app.endTime : parseISO(app.endTime as unknown as string),
    }));

    console.log(`DashboardPage: Found ${appointmentsWithDateObjects.length} user appointments directly from DB.`);
    return appointmentsWithDateObjects;

  } catch (error: unknown) { // Catch unknown
    // Use the centralized error formatter.
    // The error will be logged in detail by formatErrorMessage on the server.
    // Re-throw a new error with the user-friendly message to be caught by the page component.
    const userFriendlyMessage = formatErrorMessage(error, `fetching appointments for user ${clerkUserId}`);
    throw new Error(userFriendlyMessage); 
  }
}


export default async function DashboardPage() {
  const user = await currentUser(); 

  if (!user || !user.id) {
    redirect('/sign-in');
  }

  console.log(`DashboardPage: User ${user.firstName} (ID: ${user.id}) is authenticated.`);

  let userAppointments: AppointmentWithServiceDetails[] = [];
  let error: string | null = null;

  try {
    // Fetch appointments directly using the authenticated user's Clerk ID
    userAppointments = await getUserAppointments(user.id);
  } catch (fetchError: unknown) { // Catch unknown
    // If getUserAppointments throws, it will already be a user-friendly message from formatErrorMessage.
    // If it's another type of error caught here, format it.
    if (fetchError instanceof Error) {
        error = fetchError.message; // Assumes message is already formatted by getUserAppointments
    } else {
        error = formatErrorMessage(fetchError, "displaying dashboard appointments");
    }
    // The detailed console.error is handled within formatErrorMessage or by getUserAppointments's catch block.
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
            <div className="text-xs">{error}</div> {/* Display the formatted error */}
          </div>
        </div>
      ) : (
        <UserAppointmentList appointments={userAppointments} />
      )}
    </div>
  );
}
