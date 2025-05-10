'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import type { AppointmentWithDetails } from '@/app/admin/appointments/page';
import { formatErrorMessage } from '@/lib/errorUtils';
import { CheckCircle2, XCircle, Edit, AlertTriangle, Info } from 'lucide-react';

interface AdminAppointmentCardProps {
  appointment: AppointmentWithDetails;
}

interface ApiErrorData {
  message: string;
  status: number;
  details?: string | object;
}

export default function AdminAppointmentCard({ appointment }: AdminAppointmentCardProps) {
  const router = useRouter();
  const [newDuration, setNewDuration] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentStartTime = typeof appointment.startTime === 'string' ? parseISO(appointment.startTime) : appointment.startTime;
  const currentEndTime = typeof appointment.endTime === 'string' ? parseISO(appointment.endTime) : appointment.endTime;
  const currentDuration = differenceInMinutes(currentEndTime, currentStartTime);

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewDuration(e.target.value);
    setError(null);
    setSuccessMessage(null);
  };

  const showTemporaryMessage = (setter: React.Dispatch<React.SetStateAction<string | null>>, message: string) => {
    setter(message);
    setTimeout(() => setter(null), 3000);
  };

  const handleSubmitDurationUpdate = async () => {
    if (!newDuration || isNaN(parseInt(newDuration)) || parseInt(newDuration) <= 0) {
      showTemporaryMessage(setError, 'Please enter a valid positive number for the duration.');
      return;
    }
    setIsUpdating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/appointments/${appointment.id}/duration`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDuration: parseInt(newDuration) }),
      });
      if (!response.ok) {
        const errorData: ApiErrorData = { message: `Failed to update duration (Status: ${response.status})`, status: response.status };
        try { const parsedError = await response.json(); errorData.message = parsedError.message || parsedError.error || errorData.message; errorData.details = parsedError.details; }
        catch { errorData.details = await response.text(); }
        throw errorData;
      }
      showTemporaryMessage(setSuccessMessage, 'Duration updated successfully!');
      setNewDuration('');
      router.refresh();
    } catch (err: unknown) {
      const userFriendlyError = formatErrorMessage(err, `updating duration for appointment ID ${appointment.id}`);
      showTemporaryMessage(setError, userFriendlyError);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'approved' | 'rejected') => {
    setIsUpdating(true);
    setError(null);
    setSuccessMessage(null);
    const endpoint = newStatus === 'approved' ? `/api/admin/appointments/${appointment.id}/approve` : `/api/admin/appointments/${appointment.id}/reject`;

    try {
      const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) {
        const errorData: ApiErrorData = { message: `Failed to ${newStatus} appointment (Status: ${response.status})`, status: response.status };
        try { const parsedError = await response.json(); errorData.message = parsedError.message || parsedError.error || errorData.message; errorData.details = parsedError.details; }
        catch { errorData.details = await response.text(); }
        throw errorData;
      }
      showTemporaryMessage(setSuccessMessage, `Appointment ${newStatus} successfully!`);
      router.refresh();
    } catch (err: unknown) {
      const userFriendlyError = formatErrorMessage(err, `${newStatus} appointment ID ${appointment.id}`);
      showTemporaryMessage(setError, userFriendlyError);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'badge-warning';
      case 'approved': return 'badge-success';
      case 'rejected': return 'badge-error';
      case 'cancelled': return 'badge-neutral text-base-content opacity-80';
      default: return 'badge-ghost';
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full transition-all hover:shadow-2xl">
      <div className="card-body p-5 md:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
          <div>
            <h2 className="card-title text-xl text-base-content mb-1">
              {appointment.service.name}
            </h2>
            <p className="text-sm text-base-content opacity-80">
              Client: {appointment.user.name || appointment.user.email}
            </p>
             <p className="text-xs text-base-content opacity-60">
              Email: {appointment.user.email}
            </p>
          </div>
          <span className={`badge badge-lg mt-2 sm:mt-0 ${getStatusBadgeClass(appointment.status)}`}>
            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
          </span>
        </div>

        <div className="divider my-2">Details</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4 text-base-content">
          <p><strong>Date:</strong> {format(currentStartTime, 'EEEE, MMMM d, yyyy')}</p>
          <p><strong>Time:</strong> {format(currentStartTime, 'HH:mm')} - {format(currentEndTime, 'HH:mm')}</p>
          <p><strong>Service Duration:</strong> {appointment.service.duration} min</p>
          <p><strong>Booked Duration:</strong> {currentDuration} min</p>
          <p><strong>Price:</strong> ${appointment.service.price.toFixed(2)}</p>
        </div>

        {appointment.status === 'pending' && (
          <>
            <div className="divider my-2">Actions</div>
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-semibold mb-2 text-base-content">Modify Duration (Optional)</h3>
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <input
                    type="number"
                    placeholder="e.g., 45 (minutes)"
                    className={`input input-bordered w-full sm:flex-grow ${error && newDuration ? 'input-error' : ''}`}
                    value={newDuration}
                    onChange={handleDurationChange}
                    disabled={isUpdating}
                  />
                  <button
                    onClick={handleSubmitDurationUpdate}
                    className="btn btn-secondary btn-sm sm:btn-md"
                    disabled={isUpdating || !newDuration.trim()}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    {isUpdating && !successMessage && !error ? <span className="loading loading-spinner loading-xs"></span> : 'Update Duration'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <button
                  onClick={() => handleUpdateStatus('rejected')}
                  className="btn btn-error btn-outline"
                  disabled={isUpdating}
                >
                  <XCircle className="h-5 w-5 mr-1" />
                  {isUpdating && !successMessage && !error ? <span className="loading loading-spinner loading-xs"></span> : 'Reject'}
                </button>
                <button
                  onClick={() => handleUpdateStatus('approved')}
                  className="btn btn-success"
                  disabled={isUpdating}
                >
                  <CheckCircle2 className="h-5 w-5 mr-1" />
                  {isUpdating && !successMessage && !error ? <span className="loading loading-spinner loading-xs"></span> : 'Approve'}
                </button>
              </div>
            </div>
          </>
        )}

        {successMessage && (
            <div role="alert" className="alert alert-success mt-4 text-xs p-3">
                <Info className="h-5 w-5"/>
                <span>{successMessage}</span>
            </div>
        )}
        {error && (
            <div role="alert" className="alert alert-error mt-4 text-xs p-3">
                <AlertTriangle className="h-5 w-5"/>
                <span>{error}</span>
            </div>
        )}
      </div>
    </div>
  );
}
