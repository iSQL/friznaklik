'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Appointment, Service } from '@prisma/client';
import { format } from 'date-fns';
import { formatErrorMessage } from '@/lib/errorUtils';
import { CalendarOff, AlertTriangle } from 'lucide-react';

interface AppointmentItemProps {
  appointment: Appointment & {
    service: Service;
    startTime: Date;
    endTime: Date;
  };
}

interface CancelErrorData {
  message: string;
  status: number;
  details?: string | object;
}

export default function AppointmentItem({ appointment }: AppointmentItemProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null);

  const handleOpenCancelModal = () => {
    setError(null);
    modalRef.current?.showModal();
  };

  const handleCloseCancelModal = () => {
    setError(null);
    modalRef.current?.close();
  };

  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    setError(null);

    try {
      const response = await fetch(`/api/appointments/${appointment.id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData: CancelErrorData = {
          message: `Failed to cancel appointment (Status: ${response.status})`,
          status: response.status
        };
        try {
          const parsedError = await response.json();
          errorData.message = parsedError.message || parsedError.error || errorData.message;
          errorData.details = parsedError.details;
        } catch (e) {
          console.error('Error parsing error response:', e);
          errorData.details = await response.text();
        }
        throw errorData;
      }
      handleCloseCancelModal();
      router.refresh();
    } catch (err: unknown) {
      const userFriendlyError = formatErrorMessage(err, `cancelling appointment for ${appointment.service.name}`);
      setError(userFriendlyError);
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancel = ['pending', 'approved'].includes(appointment.status.toLowerCase());

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'badge-success';
      case 'pending': return 'badge-warning';
      case 'cancelled': return 'badge-error';
      case 'rejected': return 'badge-error';
      default: return 'badge-ghost';
    }
  };

  return (
    <>
      <div className="card card-bordered bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex-grow">
              <h2 className="card-title text-lg text-base-content mb-1">
                {appointment.service.name}
              </h2>
              <p className="text-sm text-base-content opacity-80">
                {format(new Date(appointment.startTime), 'eeee, MMMM d, yyyy')}
              </p>
              <p className="text-sm text-base-content opacity-80">
                Time: {format(new Date(appointment.startTime), 'HH:mm')} - {format(new Date(appointment.endTime), 'HH:mm')}
              </p>
              <div className="mt-2">
                <span className={`badge ${getStatusBadgeClass(appointment.status)} badge-md font-medium`}>
                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                </span>
              </div>
            </div>

            {canCancel && (
              <button
                onClick={handleOpenCancelModal}
                disabled={isCancelling}
                className="btn btn-outline btn-error btn-sm mt-2 sm:mt-0 self-start sm:self-center"
              >
                <CalendarOff className="h-4 w-4 mr-1" />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <dialog ref={modalRef} className="modal">
        <div className="modal-box bg-base-200">
          <form method="dialog">
            <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={handleCloseCancelModal}>✕</button>
          </form>
          <div className="flex items-start mb-3">
            <AlertTriangle className="h-8 w-8 text-warning mr-3 shrink-0 mt-1" />
            <h3 className="font-bold text-xl text-base-content">Confirm Cancellation</h3>
          </div>
          <p className="py-2 text-base-content opacity-90">
            Are you sure you want to cancel your appointment for <span className="font-semibold">{appointment.service.name}</span> on <span className="font-semibold">{format(new Date(appointment.startTime), 'MMMM d, yyyy')}</span> at <span className="font-semibold">{format(new Date(appointment.startTime), 'HH:mm')}</span>?
          </p>
          <p className="text-sm text-base-content opacity-70 mt-1">This action cannot be undone.</p>

          {error && (
            <div role="alert" className="alert alert-error mt-4 text-xs p-2">
              <AlertTriangle className="h-4 w-4"/>
              <span>{error}</span>
            </div>
          )}
          <div className="modal-action mt-6">
            <button type="button" className="btn btn-ghost" onClick={handleCloseCancelModal} disabled={isCancelling}>
              Keep Appointment
            </button>
            <button
              type="button"
              className="btn btn-error"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel It'
              )}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={handleCloseCancelModal}>close</button>
        </form>
      </dialog>
    </>
  );
}
