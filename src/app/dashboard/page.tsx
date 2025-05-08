// src/app/dashboard/page.tsx

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from 'next/navigation';
import UserAppointmentList from '@/components/user/UserAppointmentList'; // Assuming this path is correct
import { Appointment, Service } from '@prisma/client';
import { headers } from 'next/headers';

type AppointmentWithService = Appointment & {
  service: Service;
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL; 

if (!SITE_URL) {
  console.error('DashboardPage: NEXT_PUBLIC_SITE_URL is not set in environment variables.');
  // Consider a more robust error handling or default for development
}

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  console.log('DashboardPage: User is authenticated, fetching appointments...');

  let userAppointments: AppointmentWithService[] = [];
  let error: string | null = null;

  try {
    const apiUrl = `${SITE_URL}/api/appointments/my`;
    console.log('DashboardPage: Fetching user appointments from URL:', apiUrl);

    const requestHeaders = new Headers(await headers());
    const fetchHeaders: HeadersInit = {};
    const cookieHeader = requestHeaders.get('Cookie');
    if (cookieHeader) {
      fetchHeaders['Cookie'] = cookieHeader;
    }

    const res = await fetch(apiUrl, {
      headers: fetchHeaders,
      cache: 'no-store',
    });

    console.log('DashboardPage: Fetch response status:', res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Failed to fetch user appointments:', res.status, errorText);
      throw new Error(`Failed to fetch appointments: ${res.status} ${errorText}`);
    }

    userAppointments = await res.json();
    console.log(`DashboardPage: Found ${userAppointments.length} user appointments.`);

  } catch (fetchError: any) {
    console.error('DashboardPage: Error during fetch:', fetchError);
    error = `Error loading appointments: ${fetchError.message}`;
  }

  return (
    <div className="container mx-auto p-4 md:p-6"> {/* Adjusted padding */}
      <h1 className="text-3xl font-bold mb-6 text-neutral-content"> {/* DaisyUI text color for contrast if needed, or remove text-neutral-content if base styles are enough */}
        Welcome to Your Dashboard, {user.firstName}!
      </h1>

      {error ? (
        <div role="alert" className="alert alert-error shadow-lg"> {/* DaisyUI Alert */}
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-bold">Error!</h3>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      ) : (
        <UserAppointmentList appointments={userAppointments} />
      )}
    </div>
  );
}