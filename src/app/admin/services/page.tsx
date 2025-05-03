// src/app/admin/services/page.tsx

// This is a Server Component Page. It runs on the server and is good for data fetching.
// It lives inside the /admin route segment, so it will use the AdminLayout.
// Its purpose is to render the ServiceList component after fetching data.

import ServiceList from '@/components/admin/services/ServiceList'; // Import the ServiceList Client Component
import { Service } from '@prisma/client'; // Import the Service type from Prisma
import { headers } from 'next/headers'; // Import headers helper
import Link from 'next/link'; // Import Link for navigation

// Define the base URL for your API fetch from Server Components.
// Use NEXT_PUBLIC_SITE_URL which should be set in your .env file (e.g., http://localhost:3000)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

console.log('AdminServicesPage: Value of SITE_URL:', SITE_URL); // Debug log - Check the value of the env variable

// Ensure SITE_URL is set, especially in development
if (!SITE_URL) {
  console.error('AdminServicesPage: NEXT_PUBLIC_SITE_URL is not set in environment variables.');
  // In a real application, you might want to handle this more gracefully
  // throw new Error('NEXT_PUBLIC_SITE_URL is not set.');
   // Return an error message or redirect if the essential env var is missing
   return <div>Configuration Error: Site URL is not set.</div>;
}


export default async function AdminServicesPage() {
  // Construct the full API URL using the SITE_URL environment variable
  const apiUrl = `${SITE_URL}/api/admin/services`;

  console.log('AdminServicesPage: Fetching services from URL:', apiUrl); // Debug log - Shows the URL being fetched

  // Get the headers from the incoming request (the one from the browser)
  // Await the headers() call as recommended by Next.js
  const requestHeaders = new Headers(await headers()); // Added await here

  // Explicitly forward the Cookie header from the incoming request
  // This ensures Clerk session cookies are sent to the internal API route
  const fetchHeaders: HeadersInit = {};
   const cookieHeader = requestHeaders.get('Cookie');
   if (cookieHeader) {
       fetchHeaders['Cookie'] = cookieHeader;
   }


  // Fetch the list of services from your backend API Route Handler.
  // This fetch call happens on the server because this is a Server Component.
  // This is similar to making an HttpClient request in your .NET backend.
  const res = await fetch(apiUrl, { // Use the full apiUrl
    headers: fetchHeaders, // Include the forwarded headers, including the Cookie header
    cache: 'no-store', // Ensure the data is always fresh on each request
  });

  console.log('AdminServicesPage: Fetch response status:', res.status); // Debug log - Shows the fetch response status

  if (!res.ok) {
    // Handle errors if the API call fails
    console.error('Failed to fetch services:', res.status, res.statusText);
    // In a real app, you might want to display an error message to the admin user.
    return <div>Error loading services. Status: {res.status}</div>; // Display status for debugging
  }

  // Parse the JSON response into an array of Service objects.
  // Prisma's generated types are helpful here.
  const services: Service[] = await res.json();

  console.log('AdminServicesPage: Services data fetched successfully.'); // Debug log

  // Render the page. We pass the fetched data down to a Client Component
  // because the list and its interactions (edit/delete buttons) will be interactive.
  return (
    <div className="container mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Manage Services</h1>

      {/* TODO: Add a button or link to add a new service */}
      {/* We will add the ServiceForm component and logic later */}
       <div className="mb-4">
          <Link href="/admin/services/new" className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
            Add New Service
          </Link>
       </div>


      {/* Render the list of services using a Client Component */}
      {/* Pass the fetched services data as a prop */}
      <ServiceList services={services} /> {/* This component will be created next */}

    </div>
  );
}
