// src/components/admin/appointments/AppointmentList.tsx
'use client'; // This directive marks this as a Client Component

import { Appointment, Service, User } from '@prisma/client'; // Import necessary types from Prisma
import { useState } from 'react'; // Import useState for local state (e.g., loading state per item)
import { useRouter } from 'next/navigation'; // Import useRouter for revalidation
import { format } from 'date-fns'; // Import format from date-fns for date/time display

// Define the type for appointments including related Service and User data
// This type needs to be defined here again as it's used in the props interface
type AppointmentWithDetails = Appointment & {
  service: Service; // Include related Service data
  user: User;     // Include related User data
};

// Define the props for the AppointmentList component
interface AppointmentListProps {
  appointments: AppointmentWithDetails[]; // Expects an array of pending appointments with details
}

// This Client Component displays a list of appointments, primarily pending ones for admin actions.
export default function AppointmentList({ appointments }: AppointmentListProps) {
  const router = useRouter(); // Get the router for revalidation

  // State to manage loading status for each appointment action (approve/reject)
  // Using a map allows tracking state per appointment ID
  const [actionLoading, setActionLoading] = useState<Record<string, 'approving' | 'rejecting' | null>>({});
  const [actionError, setActionError] = useState<Record<string, string | null>>({});


  // Handle admin action (Approve or Reject)
  const handleAction = async (appointmentId: string, action: 'approve' | 'reject') => {
    // Prevent action if already processing for this appointment
    if (actionLoading[appointmentId]) {
      console.log(`Action already in progress for appointment ${appointmentId}.`);
      return;
    }

    // Optional: Add a confirmation dialog for rejection
    if (action === 'reject') {
        if (!confirm(`Are you sure you want to reject this appointment?`)) {
            return; // If the user cancels, do nothing
        }
    }


    setActionLoading(prev => ({ ...prev, [appointmentId]: action === 'approve' ? 'approving' : 'rejecting' }));
    setActionError(prev => ({ ...prev, [appointmentId]: null }));

    try {
      // Determine the API endpoint based on the action
      const apiEndpoint = `/api/admin/appointments/${appointmentId}/${action}`; // e.g., /api/admin/appointments/appt_id/approve

      // Call the backend API to update the appointment status
      // This will hit your src/app/api/admin/appointments/[id]/[action]/route.ts handler (to be created)
      const response = await fetch(apiEndpoint, {
        method: 'PUT', // Using PUT to update the status
        headers: {
           'Content-Type': 'application/json',
        },
        // Optionally send a body with notes if needed for rejection
        // body: JSON.stringify({ adminNotes: 'Reason for rejection' }),
      });

      // Handle the API response
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${action} failed:`, response.status, errorText);
        throw new Error(`${action} failed with status ${response.status}: ${errorText}`);
      }

      // If action was successful
      console.log(`Appointment ${appointmentId} ${action}d successfully!`);
      // Revalidate the current page to refresh the appointment list
      // This will remove the approved/rejected appointment from the 'pending' list.
      router.refresh();

    } catch (err) {
      console.error(`Error performing ${action} on appointment ${appointmentId}:`, err);
      setActionError(prev => ({ ...prev, [appointmentId]: `Failed to ${action}: ${err instanceof Error ? err.message : 'An unknown error occurred.'}` }));
      alert(`Failed to ${action} appointment: ${err instanceof Error ? err.message : 'An unknown error occurred.'}`); // Show an alert for now
    } finally {
      // Always set loading state back to null for this appointment
      setActionLoading(prev => ({ ...prev, [appointmentId]: null }));
    }
  };


  return (
    <div className="overflow-x-auto">
      {appointments.length === 0 ? (
        <p className="text-gray-600 text-center">No pending appointments found.</p>
      ) : (
        <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
          <thead className="bg-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
               <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {appointments.map((appointment) => (
              <tr key={appointment.id} className="hover:bg-gray-50">
                {/* Service Name */}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {appointment.service.name}
                </td>
                {/* Client Name/Email */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                   {appointment.user.name || appointment.user.email} {/* Display name or email */}
                </td>
                {/* Appointment Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(appointment.startTime, 'yyyy/MM/dd')} {/* Format date */}
                </td>
                {/* Appointment Time */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(appointment.startTime, 'HH:mm')} - {format(appointment.endTime, 'HH:mm')} {/* Format time range */}
                </td>
                 {/* Appointment Status */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                  {appointment.status} {/* Display status */}
                </td>
                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {/* Only show action buttons for pending appointments */}
                  {appointment.status === 'pending' && (
                    <>
                      {/* Approve Button */}
                      <button
                        onClick={() => handleAction(appointment.id, 'approve')}
                        className="text-green-600 hover:text-green-900 mr-4"
                        disabled={!!actionLoading[appointment.id]} // Disable if any action is loading for this item
                      >
                        {actionLoading[appointment.id] === 'approving' ? 'Approving...' : 'Approve'}
                      </button>
                      {/* Reject Button */}
                      <button
                        onClick={() => handleAction(appointment.id, 'reject')}
                        className="text-red-600 hover:text-red-900"
                         disabled={!!actionLoading[appointment.id]} // Disable if any action is loading for this item
                      >
                        {actionLoading[appointment.id] === 'rejecting' ? 'Rejecting...' : 'Reject'}
                      </button>
                    </>
                  )}
                   {/* Display error message for this item if any */}
                   {actionError[appointment.id] && (
                       <p className="text-red-600 text-xs mt-1">{actionError[appointment.id]}</p>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
