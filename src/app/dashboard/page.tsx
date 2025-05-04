// src/app/dashboard/page.tsx

// This is a Server Component Page. It runs on the server and is good for data fetching.
// It's protected by middleware to ensure only logged-in users can access it.

import { currentUser } from "@clerk/nextjs/server"; // Import currentUser helper
import { redirect } from 'next/navigation'; // Import redirect
import UserAppointmentList from '@/components/user/UserAppointmentList'; // We will create this Client Component next
import { Appointment, Service } from '@prisma/client'; // Import necessary types from Prisma
import { headers } from 'next/headers'; // Import headers helper for forwarding cookies

// Define the type for appointments including related Service data for display
type AppointmentWithService = Appointment & {
  service: Service; // Include related Service data
};

// Define the base URL for your API fetch from Server Components.
// Use NEXT_PUBLIC_SITE_URL which should be set in your .env file (e.g., http://localhost:3000)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

// Ensure SITE_URL is set, especially in development
if (!SITE_URL) {
  console.error('DashboardPage: NEXT_PUBLIC_SITE_URL is not set in environment variables.');
  // In a real application, you might want to handle this more gracefully
  // throw new Error('NEXT_PUBLIC_SITE_URL is not set.');
}


export default async function DashboardPage() {
  // Get the signed-in user details on the server
  const user = await currentUser();

  if (!user) {
    // This case should ideally be handled by middleware, but good practice to check
    // If user is not authenticated, redirect to the sign-in page.
    redirect('/sign-in');
  }

  console.log('DashboardPage: User is authenticated, fetching appointments...'); // Debug log

  let userAppointments: AppointmentWithService[] = [];
  let error: string | null = null;

  try {
    // Construct the API URL for fetching user's appointments
    const apiUrl = `${SITE_URL}/api/appointments/my`; // New API route to fetch user's appointments

    console.log('DashboardPage: Fetching user appointments from URL:', apiUrl); // Debug log

    // Get the headers from the incoming request (the one from the browser)
    // Explicitly forward the Cookie header to ensure Clerk session is sent to the API route
    const requestHeaders = new Headers(await headers());
    const fetchHeaders: HeadersInit = {};
     const cookieHeader = requestHeaders.get('Cookie');
     if (cookieHeader) {
         fetchHeaders['Cookie'] = cookieHeader;
     }

    // Fetch the user's appointments from the backend API Route Handler
    const res = await fetch(apiUrl, {
      headers: fetchHeaders, // Include the forwarded headers, including the Cookie header
      cache: 'no-store', // Ensure the data is always fresh
    });

     console.log('DashboardPage: Fetch response status:', res.status); // Debug log

    if (!res.ok) {
      // If the response is not OK, read the error body and throw
      const errorText = await res.text();
      console.error('Failed to fetch user appointments:', res.status, errorText);
      throw new Error(`Failed to fetch appointments: ${res.status} ${errorText}`);
    }

    // Parse the JSON response
    userAppointments = await res.json();
    console.log(`DashboardPage: Found ${userAppointments.length} user appointments.`); // Debug log


  } catch (fetchError: any) {
    console.error('DashboardPage: Error during fetch:', fetchError); // Debug log
    error = `Error loading appointments: ${fetchError.message}`;
  }


  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Welcome to Your Dashboard, {user.firstName}!</h1>

      {error ? (
        // Display error message if fetch failed
        <p className="text-red-600">Error: {error}</p>
      ) : (
        // Render the list of user appointments
        // Pass the fetched appointments data as a prop
        <UserAppointmentList appointments={userAppointments} /> // This component will be created next
      )}
    </div>
  );
}
