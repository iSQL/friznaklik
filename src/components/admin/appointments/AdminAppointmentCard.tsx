// src/components/admin/appointments/AdminAppointmentCard.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import type { AppointmentWithDetails } from '@/app/admin/appointments/page'; // Adjusted import path
import { formatErrorMessage } from '@/lib/errorUtils'; // Import the error utility

interface AdminAppointmentCardProps {
  appointment: AppointmentWithDetails;
}

export default function AdminAppointmentCard({ appointment }: AdminAppointmentCardProps) {
  const router = useRouter();
  const [newDuration, setNewDuration] = useState<string>(''); // Store input as string
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate current duration for display
  const currentStartTime = typeof appointment.startTime === 'string' ? parseISO(appointment.startTime) : appointment.startTime;
  const currentEndTime = typeof appointment.endTime === 'string' ? parseISO(appointment.endTime) : appointment.endTime;
  const currentDuration = differenceInMinutes(currentEndTime, currentStartTime);

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewDuration(e.target.value);
    setError(null); // Clear error when user types
    setSuccessMessage(null); // Clear success message
  };

  const handleSubmitDurationUpdate = async () => {
    if (!newDuration || isNaN(parseInt(newDuration)) || parseInt(newDuration) <= 0) {
      setError('Please enter a valid positive number for the duration.');
      return;
    }

    setIsUpdating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/appointments/${appointment.id}/duration`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newDuration: parseInt(newDuration) }),
      });

      if (!response.ok) {
        let errorData: any = { 
            message: `Failed to update duration (Status: ${response.status})`, 
            status: response.status 
        };
        try {
          const parsedError = await response.json();
          errorData.message = parsedError.message || parsedError.error || errorData.message;
          errorData.details = parsedError.details;
        } catch (e) {
          errorData.details = await response.text();
        }
        throw errorData; // Throw the structured error
      }

      setSuccessMessage('Duration updated successfully!');
      setNewDuration(''); // Clear input
      router.refresh(); // Re-fetch server-side data to reflect changes
    } catch (err: unknown) { // Catch unknown
      // Use the centralized error formatter
      const userFriendlyError = formatErrorMessage(err, `updating duration for appointment ID ${appointment.id}`);
      setError(userFriendlyError);
      // console.error is handled by formatErrorMessage
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Function to handle appointment status updates (approve/reject)
  const handleUpdateStatus = async (newStatus: 'approved' | 'rejected') => {
    setIsUpdating(true); 
    setError(null);
    setSuccessMessage(null);

    const endpoint = newStatus === 'approved' 
      ? `/api/admin/appointments/${appointment.id}/approve`
      : `/api/admin/appointments/${appointment.id}/reject`;

    try {
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            let errorData: any = { 
                message: `Failed to ${newStatus} appointment (Status: ${response.status})`, 
                status: response.status 
            };
            try {
              const parsedError = await response.json();
              errorData.message = parsedError.message || parsedError.error || errorData.message;
              errorData.details = parsedError.details;
            } catch (e) {
              errorData.details = await response.text();
            }
            throw errorData; // Throw the structured error
        }
        
        setSuccessMessage(`Appointment ${newStatus} successfully!`);
        router.refresh(); // Refresh data to reflect the status change
    } catch (err: unknown) { // Catch unknown
        // Use the centralized error formatter
        const userFriendlyError = formatErrorMessage(err, `${newStatus} appointment ID ${appointment.id}`);
        setError(userFriendlyError);
        // console.error is handled by formatErrorMessage
    } finally {
        setIsUpdating(false);
    }
};


  return (
    <div className="card bg-base-100 shadow-xl w-full">
      <div className="card-body">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
            <div>
                <h2 className="card-title text-xl mb-1">
                {appointment.service.name} - <span className="font-normal text-lg">{appointment.user.name || appointment.user.email}</span>
                </h2>
                <p className="text-sm text-base-content/70">
                User Email: {appointment.user.email}
                </p>
            </div>
            <span className={`badge badge-lg mt-2 sm:mt-0 ${
                appointment.status === 'pending' ? 'badge-warning' :
                appointment.status === 'approved' ? 'badge-success' :
                appointment.status === 'rejected' ? 'badge-error' :
                appointment.status === 'cancelled' ? 'badge-neutral' : 
                'badge-ghost'
            }`}>
                {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </span>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
          <p><strong>Date:</strong> {format(currentStartTime, 'EEEE, MMMM d, yyyy')}</p>
          <p><strong>Time:</strong> {format(currentStartTime, 'HH:mm')} - {format(currentEndTime, 'HH:mm')}</p>
          <p><strong>Original Service Duration:</strong> {appointment.service.duration} minutes</p>
          <p><strong>Current Appointment Duration:</strong> {currentDuration} minutes</p>
          <p><strong>Price:</strong> ${appointment.service.price.toFixed(2)}</p>
        </div>

        {/* Duration Update Section */}
        <div className="mt-4 pt-4 border-t border-base-300">
          <h3 className="text-md font-semibold mb-2">Modify Appointment Duration</h3>
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="form-control w-full sm:w-auto flex-grow">
              <label className="label pb-1">
                <span className="label-text">New Duration (minutes)</span>
              </label>
              <input
                type="number"
                placeholder="e.g., 45"
                className={`input input-bordered w-full ${error && newDuration ? 'input-error' : ''}`} // Show error on input if error is related to duration
                value={newDuration}
                onChange={handleDurationChange}
                disabled={isUpdating}
              />
            </div>
            <button
              onClick={handleSubmitDurationUpdate}
              className={`btn btn-secondary btn-sm sm:btn-md ${isUpdating ? 'btn-disabled' : ''}`}
              disabled={isUpdating || !newDuration}
            >
              {isUpdating && successMessage === null && error === null ? <span className="loading loading-spinner loading-xs"></span> : 'Update Duration'}
            </button>
          </div>
          {error && <p className="text-error text-xs mt-2">{error}</p>}
          {successMessage && <p className="text-success text-xs mt-2">{successMessage}</p>}
        </div>
        
        {/* Action Buttons for Pending Appointments */}
        {appointment.status === 'pending' && (
            <div className="card-actions justify-end mt-6 pt-4 border-t border-base-300">
                <button 
                    onClick={() => handleUpdateStatus('approved')} 
                    className={`btn btn-success btn-sm ${isUpdating ? 'btn-disabled' : ''}`}
                    disabled={isUpdating}
                >
                    {isUpdating && successMessage === null && error === null ? <span className="loading loading-spinner loading-xs"></span> : 'Approve'}
                </button>
                <button 
                    onClick={() => handleUpdateStatus('rejected')} 
                    className={`btn btn-error btn-sm ${isUpdating ? 'btn-disabled' : ''}`}
                    disabled={isUpdating}
                >
                    {isUpdating && successMessage === null && error === null ? <span className="loading loading-spinner loading-xs"></span> : 'Reject'}
                </button>
            </div>
        )}

      </div>
    </div>
  );
}
