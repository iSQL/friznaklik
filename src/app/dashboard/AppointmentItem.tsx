// src/app/dashboard/AppointmentItem.tsx
"use client";

import { useState, useRef } from 'react'; // Added useRef for modal
import { useRouter } from 'next/navigation';
import { Appointment, Service } from '@prisma/client';
import { format } from 'date-fns';
import { formatErrorMessage } from '@/lib/errorUtils';

interface AppointmentItemProps {
  appointment: Appointment & { // Or your ProcessedAppointment type
    service: Service;
    startTime: Date; // Expect Date object
    endTime: Date;   // Expect Date object
  };
}

// Interface for the structured error data when cancellation fails
interface CancelErrorData {
  message: string;
  status: number;
  details?: string | object; // Details can be a string or a parsed JSON object
}

export default function AppointmentItem({ appointment }: AppointmentItemProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null); // Ref for the modal

  const handleOpenCancelModal = () => {
    setError(null); // Clear previous errors when opening modal
    if (modalRef.current) {
      modalRef.current.showModal();
    }
  };

  const handleCancel = async () => {
    if (isCancelling) return;

    setIsCancelling(true);
    setError(null);

    try {
      const response = await fetch(`/api/appointments/${appointment.id}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Use the new interface for errorData
        const errorData: CancelErrorData = { // Type applied here
          message: `Failed to cancel appointment (Status: ${response.status})`,
          status: response.status
        };
        try {
          // Try to parse JSON error from the backend
          const parsedError = await response.json();
          // parsedError could be { message: string } or { error: string, details?: any }
          errorData.message = parsedError.message || parsedError.error || errorData.message;
          errorData.details = parsedError.details; // Capture details if provided
        } catch (e) {
          // If response is not JSON, use text
          console.error('Failed to parse error response as JSON:', e);
          errorData.details = await response.text();
        }
        throw errorData; // Throw the structured error object
      }

      console.log(`Appointment ${appointment.id} cancelled.`);
      if (modalRef.current) {
        modalRef.current.close(); // Close modal on success
      }
      router.refresh(); // Refresh the page to update the appointment list
    } catch (err: unknown) { // Catch unknown
      // Use the centralized error formatter
      // Ensure formatErrorMessage can handle CancelErrorData or similar structures
      const userFriendlyError = formatErrorMessage(err, `cancelling appointment for ${appointment.service.name}`);
      setError(userFriendlyError);
      // console.error is handled by formatErrorMessage
      // Keep modal open if error to show message
    } finally {
      setIsCancelling(false);
    }
  };

  // Determine if the appointment can be cancelled based on its status
  const canCancel = ['pending', 'approved'].includes(appointment.status.toLowerCase());

  // Helper function to get the badge color based on appointment status
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) { // Normalize status to lower case for robust comparison
      case 'approved':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'cancelled':
      case 'rejected':
        return 'badge-error';
      default:
        return 'badge-ghost'; // Neutral/default badge
    }
  };

  return (
    <>
      {/* DaisyUI Card */}
      <div
        className={`card card-bordered bg-base-100 shadow-lg mb-4 ${isCancelling && !modalRef.current?.open ? 'opacity-70' : ''}`} // Dim card only if modal is not open during cancelling
      >
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            {/* Appointment Details */}
            <div className="mb-3 sm:mb-0">
              <h2 className="card-title text-lg mb-1">
                {appointment.service.name}
              </h2>
              <p className="text-sm text-base-content/80">
                {/* Ensure startTime is a valid Date object before formatting */}
                {format(new Date(appointment.startTime), 'eeee, MMMM d, yyyy')} at {format(new Date(appointment.startTime), 'HH:mm')}
              </p>
              <div className="mt-2">
                <span className="text-sm text-base-content/70">Status: </span>
                <span className={`badge ${getStatusBadgeColor(appointment.status)} badge-md font-medium`}>
                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                </span>
              </div>
            </div>

            {/* Cancel Button */}
            {canCancel && (
              <button
                onClick={handleOpenCancelModal}
                disabled={isCancelling}
                className="btn btn-error btn-sm mt-2 sm:mt-0 sm:ml-4"
              >
                Cancel Appointment
              </button>
            )}
          </div>
          {/* Display Error Message for cancellation if modal is not open (e.g., initial load error if applicable) */}
          {error && !modalRef.current?.open && (
            <div role="alert" className="alert alert-error text-xs p-2 mt-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* DaisyUI Modal for Confirmation */}
      <dialog id={`cancel-modal-${appointment.id}`} className="modal" ref={modalRef}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Confirm Cancellation</h3>
          <p className="py-4">
            Are you sure you want to cancel the appointment for <span className="font-semibold">{appointment.service.name}</span> on <span className="font-semibold">{format(new Date(appointment.startTime), 'MMMM d')}</span>? This action cannot be undone.
          </p>
          {error && ( // Show error within the modal if cancellation fails
            <div role="alert" className="alert alert-error text-xs p-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
            </div>
          )}
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={() => { setError(null); if (modalRef.current) modalRef.current.close(); }}>Close</button>
            <button
              className={`btn btn-error ${isCancelling ? 'btn-disabled' : ''}`}
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel'
              )}
            </button>
          </div>
        </div>
        {/* Optional: close modal when clicking outside */}
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setError(null)}>close</button>
        </form>
      </dialog>
    </>
  );
}
