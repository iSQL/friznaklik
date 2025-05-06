// src/app/dashboard/AppointmentItem.tsx
"use client";

import { useState, useRef } from 'react'; // Added useRef for modal
import { useRouter } from 'next/navigation';
import { Appointment, Service } from '@prisma/client';
import { format } from 'date-fns';

interface AppointmentItemProps {
  appointment: Appointment & { // Or your ProcessedAppointment type
    service: Service;
    startTime: Date; // Expect Date object
    endTime: Date;   // Expect Date object
  };
}

export default function AppointmentItem({ appointment }: AppointmentItemProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null); // Ref for the modal

  const handleOpenCancelModal = () => {
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
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to cancel appointment (Status: ${response.status})`);
      }

      console.log(`Appointment ${appointment.id} cancelled.`);
      if (modalRef.current) {
        modalRef.current.close(); // Close modal on success
      }
      router.refresh();
    } catch (err: any) {
      console.error('Cancellation error:', err);
      setError(err.message || 'An unexpected error occurred.');
      // Keep modal open if error to show message, or close and show elsewhere
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancel = ['pending', 'approved'].includes(appointment.status);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
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
        className={`card card-bordered bg-base-100 shadow-lg mb-4 ${isCancelling ? 'opacity-70' : ''}`}
      >
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            {/* Appointment Details */}
            <div className="mb-3 sm:mb-0">
              <h2 className="card-title text-lg mb-1"> {/* card-title for heading */}
                {appointment.service.name}
              </h2>
              <p className="text-sm text-base-content/80"> {/* text-base-content with opacity */}
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
                onClick={handleOpenCancelModal} // Open modal instead of direct cancel
                disabled={isCancelling}
                className="btn btn-error btn-sm mt-2 sm:mt-0 sm:ml-4" // DaisyUI button
              >
                Cancel Appointment
              </button>
            )}
          </div>
          {/* Display Error Message for cancellation */}
          {error && !isCancelling && ( // Show error if not currently cancelling (error displayed in modal during cancel)
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
            <button className="btn btn-ghost" onClick={() => { setError(null); if (modalRef.current) modalRef.current.close();}}>Close</button>
            <button
              className={`btn btn-error ${isCancelling ? 'btn-disabled' : ''}`} // DaisyUI button classes
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span> {/* DaisyUI spinner */}
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