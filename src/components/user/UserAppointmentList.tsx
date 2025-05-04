// src/components/user/UserAppointmentList.tsx
'use client'; // This is a Client Component

import { Appointment, Service } from '@prisma/client'; // Import necessary types from Prisma
import { format } from 'date-fns'; // Import format from date-fns for date/time display
import { useState } from 'react'; // Import useState for local state (e.g., cancellation loading)
import { useRouter } from 'next/navigation'; // Import useRouter for revalidation

// Define the type for appointments including related Service data
type AppointmentWithService = Appointment & {
  service: Service; // Include related Service data
};

// Define the props for the UserAppointmentList component
interface UserAppointmentListProps {
  appointments: AppointmentWithService[]; // Expects an array of user appointments with service details
}

// Define the base URL for your API.
// Use NEXT_PUBLIC_SITE_URL which should be set in your .env file (e.g., http://localhost:3000)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';


// This Client Component displays a list of the user's appointments.
export default function UserAppointmentList({ appointments }: UserAppointmentListProps) {
   const router = useRouter(); // Get the router for revalidation

   // State to manage cancellation loading state per appointment ID
   const [cancellationLoading, setCancellationLoading] = useState<Record<string, boolean>>({});
   const [cancellationError, setCancellationError] = useState<Record<string, string | null>>({});


   // Implement appointment cancellation logic
   const handleCancel = async (appointmentId: string) => {
       // Prevent cancellation if already processing for this appointment
       if (cancellationLoading[appointmentId]) {
           console.log('Cancellation already in progress.');
           return;
       }

       if (!confirm('Are you sure you want to cancel this appointment?')) {
           return; // If the user cancels, do nothing
       }

       setCancellationLoading(prev => ({ ...prev, [appointmentId]: true }));
       setCancellationError(prev => ({ ...prev, [appointmentId]: null }));

       try {
           // Call the backend API to cancel the appointment
           // This will hit your src/app/api/appointments/[id]/cancel/route.ts PUT handler
           const response = await fetch(`${SITE_URL}/api/appointments/${appointmentId}/cancel`, {
               method: 'PUT', // Use PUT to update the status
           });

           if (!response.ok) {
               const errorText = await response.text();
               console.error('Cancellation failed:', response.status, errorText);
               throw new Error(`Cancellation failed with status ${response.status}: ${errorText}`);
           }

           console.log(`Appointment ${appointmentId} cancelled successfully!`);
           router.refresh(); // Revalidate to remove the cancelled appointment from the list


       } catch (err: any) {
           console.error(`Error cancelling appointment ${appointmentId}:`, err);
           setCancellationError(prev => ({ ...prev, [appointmentId]: `Failed to cancel: ${err instanceof Error ? err.message : 'An unknown error occurred.'}` }));
           alert(`Failed to cancel appointment: ${err instanceof Error ? err.message : 'An unknown error occurred.'}`);
       } finally {
           setCancellationLoading(prev => ({ ...prev, [appointmentId]: false }));
       }
   };


  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4">Your Appointments</h2>
      {appointments.length === 0 ? (
        <p className="text-gray-600">You have no upcoming or pending appointments.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
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
                 <th className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
                     {/* Show Cancel button for pending or approved appointments */}
                     {(appointment.status === 'pending' || appointment.status === 'approved') && (
                         <button
                             onClick={() => handleCancel(appointment.id)}
                             className="text-red-600 hover:text-red-900"
                             disabled={cancellationLoading[appointment.id]} // Disable while cancelling
                         >
                             {cancellationLoading[appointment.id] ? 'Cancelling...' : 'Cancel'}
                         </button>
                     )}
                      {/* Display error message for this item if any */}
                      {cancellationError[appointment.id] && (
                          <p className="text-red-600 text-xs mt-1">{cancellationError[appointment.id]}</p>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
