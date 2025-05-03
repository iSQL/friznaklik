// src/app/admin/services/page.tsx

// This is a Server Component Page. It runs on the server and is good for data fetching.
// It lives inside the /admin route segment, so it will use the AdminLayout.
// Its purpose is to fetch data and render the Client Component that handles interactivity.

// No 'use client' directive here - this is a Server Component

import AdminServicesClient from '@/components/admin/services/AdminServicesClient'; // Import the Client Component wrapper
import { Service } from '@prisma/client'; // Import the Service type from Prisma
import prisma from '@/lib/prisma'; // Import your Prisma client utility for direct database access
import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication (for admin check)
import { redirect } from 'next/navigation'; // Import redirect
import Link from 'next/link'; // Import Link (needed if rendering unauthorized message)


// Helper function to check if the authenticated user is an admin
// (Copied from src/app/api/admin/services/route.ts - could be moved to a shared utility)
// We need this check here because this page is protected and needs to ensure
// the fetching admin is authorized.
async function isAdminUser(userId: string): Promise<boolean> {
  console.log('isAdminUser (Page): Checking role for userId:', userId); // Debug log

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  });

  console.log('isAdminUser (Page): Database user found:', dbUser); // Debug log

  return dbUser?.role === 'admin';
}


export default async function AdminServicesPage() {
  // Perform authentication and authorization check directly in the Server Component
  // This is necessary because we are fetching data directly here.
  const { userId } = await auth(); // Check authentication status

  if (!userId) {
    // If not authenticated, redirect to sign-in.
    redirect('/sign-in');
  }

  const isAdmin = await isAdminUser(userId); // Check if the user is an admin

  if (!isAdmin) {
    // If not an admin, show unauthorized message or redirect.
     return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-6 bg-white rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Unauthorized Access</h1>
          <p className="text-gray-700 mb-4">You do not have permission to view this page.</p>
          <Link href="/" className="text-blue-500 hover:underline">
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  console.log('AdminServicesPage: User is admin, fetching services directly with Prisma...'); // Debug log

  let services: Service[] = [];
  let error: string | null = null;

  try {
    // Fetch all services directly from the database using Prisma
    services = await prisma.service.findMany();
    console.log('AdminServicesPage: Services fetched directly with Prisma successfully.'); // Debug log

  } catch (fetchError) {
    console.error('AdminServicesPage: Error fetching services directly with Prisma:', fetchError); // Debug log
    error = 'Error loading services.';
  }


  // If there was an error fetching data, display an error message.
  if (error) {
     return (
        <div className="container mx-auto p-6 bg-white rounded-lg shadow-md">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Manage Services</h1>
            <p className="text-red-600">{error}</p>
        </div>
     );
  }


  // Render the Client Component and pass the fetched services data as a prop
  return (
     <AdminServicesClient services={services} />
  );
}
