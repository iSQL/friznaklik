// src/app/services/page.tsx

import Link from 'next/link'; // For linking to booking page or service details
// No longer need to import headers

// Define the expected structure of a Service object
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
// No longer needs to handle headers/cookies as the API route is public
async function getServices(): Promise<Service[]> {
  const siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:3000';
  const apiUrl = `${siteUrl}/api/services`;

  console.log(`Fetching services from: ${apiUrl}`);

  try {
    // Fetch without custom headers
    const res = await fetch(apiUrl, {
      // Consider using Next.js caching strategies if appropriate
      // cache: 'force-cache', // Example: Cache aggressively
      // next: { revalidate: 3600 } // Example: Revalidate every hour
      cache: 'no-store', // Keep fetching fresh data for now, adjust as needed
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Failed to fetch services: ${res.status} ${res.statusText}`, errorText);
      // Throw a generic error as authentication shouldn't be the issue anymore
      throw new Error(`Failed to fetch services. Status: ${res.status}`);
    }

    const services = await res.json();
    console.log(`Fetched ${services.length} services.`);
    return services;
  } catch (error) {
    console.error('Error in getServices:', error);
    // Re-throw the error to be caught by the page component
    throw error;
  }
}

// The ServicesPage component
export default async function ServicesPage() {
  let services: Service[] = [];
  let fetchError: string | null = null;

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
