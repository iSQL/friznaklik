// src/components/admin/services/ServiceItem.tsx
'use client'; // This directive marks this as a Client Component

import { Service } from '@prisma/client'; // Import the Service type from Prisma
import { useRouter } from 'next/navigation'; // Import Next.js router for revalidation
import { useState, useEffect } from 'react'; // Import useState and useEffect for local state (e.g., loading state)

// Define the props for the ServiceItem component
interface ServiceItemProps {
  service: Service; // Expects a single Service object
  // Added prop: Callback function to trigger edit action (e.g., open a modal with the form)
  onEditClick: (service: Service) => void;
}

// This Client Component renders a single row in the services table
// and includes buttons for editing and deleting the service.
export default function ServiceItem({ service, onEditClick }: ServiceItemProps) {
  const router = useRouter(); // Get the Next.js router instance
  const [isDeleting, setIsDeleting] = useState(false); // State to track delete loading state

  // Debug log to see the onEditClick prop received
  useEffect(() => {
      console.log(`ServiceItem for ${service.name}: Received onEditClick prop:`, onEditClick);
  }, [onEditClick, service.name]);


  // Handle the Delete button click
  const handleDelete = async () => {
    // Add a check to prevent multiple deletions if already deleting
    if (isDeleting) {
      console.log('Deletion already in progress.');
      return; // Exit the function if already deleting
    }

    // Add a confirmation dialog before deleting
    // Similar to a confirmation dialog box in a .NET UI.
    if (!confirm(`Are you sure you want to delete the service "${service.name}"?`)) {
      return; // If the user cancels, do nothing
    }

    setIsDeleting(true); // Set deleting state

    try {
      // Call the backend API to delete the service
      // This will hit your src/app/api/admin/services/[id]/route.ts DELETE handler.
      const response = await fetch(`/api/admin/services/${service.id}`, {
        method: 'DELETE',
        // No body needed for a DELETE request by ID
      });

      // Handle the API response
      if (!response.ok) {
        // If the response is not OK, read the response body as text
        // This handles cases where the server returns non-JSON error responses (like "Unauthorized")
        const errorText = await response.text();
        console.error('Delete failed:', response.status, errorText); // Log the status and text response
        // Throw an error with a more informative message
        throw new Error(`Delete failed with status ${response.status}: ${errorText}`);
      }

      // If deletion was successful
      console.log(`Service "${service.name}" deleted successfully!`);
      // Revalidate the current page to refresh the service list
      // This tells Next.js to refetch the data for the AdminServicesPage.
      router.refresh();

    } catch (err) {
      // Handle errors during the fetch call or from the API response
      console.error('Error deleting service:', err);
      alert(`Failed to delete service: ${err instanceof Error ? err.message : 'An unknown error occurred.'}`); // Show an alert for now
    } finally {
      // Always set deleting state back to false
      setIsDeleting(false);
    }
  };

  // Handle the Edit button click
  const handleEditClick = () => {
    console.log(`ServiceItem for ${service.name}: Edit button clicked, calling onEditClick.`); // Debug log
    // Call the onEditClick callback provided by the parent, passing the service data
    onEditClick(service);
  };


  return (
    // Render a table row for the service - Removed extra whitespace between tags
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {service.name}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {service.duration}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {/* Basic currency formatting - you might want a more robust solution */}
        {`$${service.price.toFixed(2)}`}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        {/* Edit Button */}
        <button
           onClick={handleEditClick} // Attach the edit click handler
           className="text-indigo-600 hover:text-indigo-900 mr-4"
           disabled={isDeleting} // Disable edit while deleting
        >
          Edit
        </button>
        {/* Delete Button */}
        <button
          onClick={handleDelete} // Attach the delete click handler
          className="text-red-600 hover:text-red-900"
          disabled={isDeleting} // Disable button while deleting
        >
          {isDeleting ? 'Deleting...' : 'Delete'} {/* Change button text while deleting */}
        </button>
      </td>
    </tr>
  );
}
