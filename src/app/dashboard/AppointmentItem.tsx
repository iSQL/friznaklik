// src/app/dashboard/AppointmentItem.tsx
"use client"; // Mark this as a Client Component

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // For refreshing data
import { Appointment, Service } from '@prisma/client';
import { format } from 'date-fns';

// Define the props for the component
interface AppointmentItemProps {
  appointment: Appointment & { service: Service }; // Expect appointment with service details
}

export default function AppointmentItem({ appointment }: AppointmentItemProps) {
  const router = useRouter(); // Hook to refresh the page data
  const [isCancelling, setIsCancelling] = useState(false); // State for loading indicator
  const [error, setError] = useState<string | null>(null); // State for error messages

  // Function to handle the cancellation request
  const handleCancel = async () => {
    // Prevent multiple clicks while processing
    if (isCancelling) return;

    // Confirm with the user before cancelling
    if (!window.confirm(`Are you sure you want to cancel the appointment for ${appointment.service.name} on ${format(new Date(appointment.startTime), 'MMMM d')}?`)) {
      return;
    }

    setIsCancelling(true);
    setError(null); // Clear previous errors

    try {
      // Make the API call to the cancellation endpoint
      const response = await fetch(`/api/appointments/${appointment.id}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json', // Optional, but good practice
        },
        // No body needed for this specific PUT request based on the API route
      });

      if (!response.ok) {
        // Handle API errors (e.g., appointment not found, not cancellable)
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to cancel appointment (Status: ${response.status})`);
      }

      // Cancellation successful
      console.log(`Appointment ${appointment.id} cancelled.`);

      // Refresh the data on the page to show the updated status
      // This will re-run the server component's data fetching
      router.refresh();

      // Optionally, you could update local state immediately for a faster UI update,
      // but router.refresh() ensures consistency with the server.

    } catch (err: any) {
      console.error('Cancellation error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      // Reset loading state regardless of success or failure
      setIsCancelling(false);
    }
  };

  // Determine if the cancel button should be shown
  const canCancel = ['pending', 'approved'].includes(appointment.status);

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center ${isCancelling ? 'opacity-70' : ''}`}
    >
      {/* Appointment Details */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {appointment.service.name}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {format(new Date(appointment.startTime), 'eeee, MMMM d, yyyy')} at {format(new Date(appointment.startTime), 'HH:mm')}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
          Status: <span className={`font-medium ${
            appointment.status === 'approved' ? 'text-green-600 dark:text-green-400' :
            appointment.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400' :
            appointment.status === 'cancelled' ? 'text-red-600 dark:text-red-400' :
            appointment.status === 'rejected' ? 'text-red-600 dark:text-red-400' :
            'text-gray-500 dark:text-gray-500'
          }`}>
            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
          </span>
        </p>
        {/* Display Error Message */}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>

      {/* Cancel Button */}
      {canCancel && (
        <button
          onClick={handleCancel}
          disabled={isCancelling} // Disable button while processing
          className={`mt-2 sm:mt-0 sm:ml-4 bg-red-500 hover:bg-red-600 text-white text-sm py-1 px-3 rounded transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75 ${isCancelling ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          {isCancelling ? 'Cancelling...' : 'Cancel'}
        </button>
      )}
    </div>
  );
}