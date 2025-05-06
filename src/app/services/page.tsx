// src/app/services/page.tsx

import Link from 'next/link'; // For linking to booking page or service details
import { headers } from 'next/headers'; // Import headers to forward cookies

// Define the expected structure of a Service object
// This should match the structure returned by your API and your Prisma model
interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number; // Duration in minutes
  price: number;
  createdAt: string; // Assuming ISO date string
  updatedAt: string; // Assuming ISO date string
}

// Function to fetch services from the API
async function getServices(): Promise<Service[]> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const apiUrl = `${siteUrl}/api/services`;

  console.log(`Fetching services from: ${apiUrl}`);

  // Prepare headers for the fetch request
  const requestHeaders = new Headers(await headers()); // Get headers from the incoming request
  const fetchHeaders: HeadersInit = {};
  const cookieHeader = requestHeaders.get('Cookie');
  if (cookieHeader) {
    fetchHeaders['Cookie'] = cookieHeader; // Forward the cookie
    console.log('Forwarding cookie to /api/services');
  } else {
    console.log('No cookie found in incoming request to forward.');
  }


  try {
    const res = await fetch(apiUrl, {
      headers: fetchHeaders, // Include the forwarded headers
      cache: 'no-store', // Fetch fresh data on each request
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Failed to fetch services: ${res.status} ${res.statusText}`, errorText);
      // Provide a more specific error message if it's a 401 or 403
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Authentication failed when fetching services. Status: ${res.status}. Ensure you are logged in or the API route has correct permissions.`);
      }
      throw new Error(`Failed to fetch services. Status: ${res.status}`);
    }

    const services = await res.json();
    console.log(`Fetched ${services.length} services.`);
    return services;
  } catch (error) {
    console.error('Error in getServices:', error);
    throw error;
  }
}

// The ServicesPage component
export default async function ServicesPage() {
  let services: Service[] = [];
  let fetchError: string | null = null;

  // Note: If services are public, authentication might not be needed.
  // However, if the API route /api/services is protected by Clerk middleware
  // (e.g. in middleware.ts), then forwarding the cookie is necessary even for Server Components.
  // If services are truly public and the API route shouldn't be protected,
  // adjust your middleware.ts to exclude /api/services from auth checks.

  try {
    services = await getServices();
  } catch (error: any) {
    console.error("Error fetching services for page:", error.message);
    fetchError = error.message || "Could not load services at this time. Please try again later.";
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-neutral-content mb-2">Our Services</h1>
        <p className="text-lg text-neutral-content/80">
          Discover the range of professional haircut and styling services we offer.
        </p>
      </header>

      {fetchError && (
        <div role="alert" className="alert alert-error shadow-lg max-w-2xl mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div>
            <h3 className="font-bold">Oops! Something went wrong.</h3>
            <div className="text-xs">{fetchError}</div>
          </div>
        </div>
      )}

      {!fetchError && services.length === 0 && (
        <div className="text-center py-10">
          <p className="text-xl text-neutral-content/70">
            No services are currently available. Please check back later.
          </p>
        </div>
      )}

      {!fetchError && services.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div key={service.id} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 ease-in-out">
              <div className="card-body">
                <h2 className="card-title text-2xl mb-2">{service.name}</h2>
                <p className="text-base-content/80 mb-4 h-20 overflow-y-auto"> {/* Fixed height for description */}
                  {service.description || "No description available."}
                </p>
                <div className="mb-4 space-y-1">
                  <p className="text-sm">
                    <span className="font-semibold">Duration:</span> {service.duration} minutes
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Price:</span> ${service.price.toFixed(2)}
                  </p>
                </div>
                <div className="card-actions justify-end">
                  <Link href={`/book?serviceId=${service.id}&serviceName=${encodeURIComponent(service.name)}`} className="btn btn-primary">
                    Book Now
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
