// src/app/services/page.tsx

import Link from 'next/link';
import prisma from '@/lib/prisma'; // Assuming your prisma client is at src/lib/prisma.ts
import type { Service } from '@prisma/client'; // Import the Service type from Prisma

// Fetch services directly from the database
async function getServicesDirectly(): Promise<Service[]> {
  try {
    // This console.log will appear in your server/build logs, not the browser.
    console.log("Fetching services directly from DB for /services page...");
    const services = await prisma.service.findMany({
      orderBy: { // Optional: Add ordering if desired
        name: 'asc',
      },
    });
    console.log(`Fetched ${services.length} services directly from DB.`);
    return services;
  } catch (error) {
    console.error("Error fetching services directly from DB:", error);
    // In a real app, you might want to throw the error or return an empty array
    // depending on how you want to handle DB errors at the page level.
    // For build purposes, returning empty or throwing might be acceptable.
    // If the DB isn't available at build time (it shouldn't be for this pattern),
    // this won't be an issue as this code runs at request time or during pre-rendering
    // if the page is static and data is fetched then.
    // For fully static pages, DATABASE_URL would need to be available at build time.
    // For dynamically rendered server components, it's fetched at request time.
    return []; // Or throw the error to be handled by an error.tsx boundary
  }
}

// This page will be dynamically rendered by default if it uses dynamic functions
// like cookies(), headers(), or searchParams. If it's just fetching data,
// Next.js will try to prerender it if possible.
// Using `cache: 'no-store'` in a fetch implies dynamic behavior.
// For direct DB access, if you want it to be always dynamic (like revalidate: 0):
export const dynamic = 'force-dynamic';
// Or, for time-based revalidation (e.g., every hour):
// export const revalidate = 3600;

export default async function ServicesPage() {
  let services: Service[] = [];
  let fetchError: string | null = null;

  try {
    services = await getServicesDirectly();
  } catch (error: any) {
    // This catch block might be less relevant if getServicesDirectly handles its own errors
    // or if you use an error.tsx boundary for the page.
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

      {/* Error display remains the same */}
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
                <p className="text-base-content/80 mb-4 h-20 overflow-y-auto">
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