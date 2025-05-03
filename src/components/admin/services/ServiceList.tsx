'use client'; // This directive marks this as a Client Component

import { Service } from '@prisma/client'; // Import the Service type from Prisma
// We will create the ServiceItem component next
import ServiceItem from './ServiceItem'; // Import the component for a single service item

// Define the props for the ServiceList component
interface ServiceListProps {
  services: Service[]; // Expects an array of Service objects
}

// This Client Component receives the list of services and renders them.
// It's a Client Component because it will contain interactive elements
// like buttons for editing and deleting services (handled by ServiceItem).
export default function ServiceList({ services }: ServiceListProps) {
  return (
    <div className="overflow-x-auto"> {/* Added overflow-x-auto for responsiveness on small screens */}
      {/* Check if there are any services to display */}
      {services.length === 0 ? (
        // Display a message if no services are found
        <p className="text-gray-600 text-center">No services found.</p>
      ) : (
        // Render a table to display the services
        <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
          <thead className="bg-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration (min)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {/* Map over the services array and render a ServiceItem for each */}
            {services.map((service) => (
              // The key prop is important for React to efficiently update lists
              <ServiceItem key={service.id} service={service} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
