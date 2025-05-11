'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { srLatn } from 'date-fns/locale'; 
import type { AppointmentWithDetails } from '@/app/admin/appointments/page';
import { formatErrorMessage } from '@/lib/errorUtils';
import { CheckCircle2, XCircle, Edit, AlertTriangle, Info, CalendarClock, Users, Mail, Tag, Clock, CalendarDays, DollarSign } from 'lucide-react'; 

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
    setTimeout(() => setter(null), 4000); 
  };

  const handleSubmitDurationUpdate = async () => {
    if (!newDuration || isNaN(parseInt(newDuration)) || parseInt(newDuration) <= 0) {
      showTemporaryMessage(setError, 'Molimo unesite validan pozitivan broj za trajanje.');
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
        const errorData: ApiErrorData = { message: `Neuspešno ažuriranje trajanja (Status: ${response.status})`, status: response.status };
        try { const parsedError = await response.json(); errorData.message = parsedError.message || parsedError.error || errorData.message; errorData.details = parsedError.details; }
        catch { errorData.details = await response.text(); }
        throw errorData;
      }
      showTemporaryMessage(setSuccessMessage, 'Trajanje je uspešno ažurirano!');
      setNewDuration('');
      router.refresh();
    } catch (err: unknown) {
      const userFriendlyError = formatErrorMessage(err, `ažuriranja trajanja za termin ID ${appointment.id}`);
      showTemporaryMessage(setError, userFriendlyError);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'approved' | 'rejected') => {
    setIsUpdating(true);
    setError(null);
    setSuccessMessage(null);
    const translatedStatus = newStatus === 'approved' ? 'odobravanje' : 'odbijanje'; // Za poruke o grešci
    const endpoint = newStatus === 'approved' ? `/api/admin/appointments/${appointment.id}/approve` : `/api/admin/appointments/${appointment.id}/reject`;

    try {
      const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) {
        const errorData: ApiErrorData = { message: `Neuspešno ${translatedStatus} termina (Status: ${response.status})`, status: response.status };
        try { const parsedError = await response.json(); errorData.message = parsedError.message || parsedError.error || errorData.message; errorData.details = parsedError.details; }
        catch { errorData.details = await response.text(); }
        throw errorData;
      }
      showTemporaryMessage(setSuccessMessage, `Termin je uspešno ${newStatus === 'approved' ? 'odobren' : 'odbijen'}!`);
      router.refresh();
    } catch (err: unknown) {
      const userFriendlyError = formatErrorMessage(err, `${translatedStatus} termina ID ${appointment.id}`);
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
      case 'confirmed': return 'badge-info'; 
      case 'rescheduled_requested': return 'badge-accent'; 
      default: return 'badge-ghost';
    }
  };

  const translateStatus = (status: string) => {
    const lowerStatus = status.toLowerCase();
    switch (lowerStatus) {
      case 'pending': return 'Na čekanju';
      case 'approved': return 'Odobren';
      case 'rejected': return 'Odbijen';
      case 'cancelled': return 'Otkazan';
      case 'confirmed': return 'Potvrđen';
      case 'rescheduled_requested': return 'Zahtev za promenu';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  return (
    <div className="card bg-base-100 shadow-xl w-full transition-all hover:shadow-2xl">
      <div className="card-body p-4 sm:p-5 md:p-6"> 
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
          <div>
            <h2 className="card-title text-lg sm:text-xl text-base-content mb-1">
              <Tag className="h-5 w-5 mr-1 opacity-70 inline-block" /> {appointment.service.name}
            </h2>
            <p className="text-sm text-base-content opacity-80 flex items-center">
              <Users className="h-4 w-4 mr-2 opacity-70" /> Klijent: {appointment.user.name || appointment.user.email}
            </p>
            <p className="text-xs text-base-content opacity-60 flex items-center mt-1">
              <Mail className="h-4 w-4 mr-2 opacity-70" /> Email: {appointment.user.email}
            </p>
          </div>
          <span className={`badge badge-lg mt-2 sm:mt-0 ${getStatusBadgeClass(appointment.status)}`}>
            {translateStatus(appointment.status)}
          </span>
        </div>

        <div className="divider my-2 text-sm">Detalji termina</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 text-sm mb-4 text-base-content">
          <p className="flex items-center"><CalendarDays className="h-4 w-4 mr-2 opacity-70" /><strong>Datum:</strong> {format(currentStartTime, 'EEEE, d. MMMM yyyy.', { locale: srLatn })}</p>
          <p className="flex items-center"><CalendarClock className="h-4 w-4 mr-2 opacity-70" /><strong>Vreme:</strong> {format(currentStartTime, 'HH:mm', { locale: srLatn })} - {format(currentEndTime, 'HH:mm', { locale: srLatn })}</p>
          <p className="flex items-center"><Clock className="h-4 w-4 mr-2 opacity-70" /><strong>Trajanje usluge:</strong> {appointment.service.duration} min</p>
          <p className="flex items-center"><Clock className="h-4 w-4 mr-2 opacity-70" /><strong>Zakazano trajanje:</strong> {currentDuration} min</p>
          <p className="flex items-center"><DollarSign className="h-4 w-4 mr-2 opacity-70" /><strong>Cena:</strong> {appointment.service.price.toFixed(2)} RSD</p>
        </div>

        {(appointment.status.toLowerCase() === 'pending' || appointment.status.toLowerCase() === 'confirmed' || appointment.status.toLowerCase() === 'rescheduled_requested') && (
          <>
            <div className="divider my-2 text-sm">Akcije</div>
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-semibold mb-2 text-base-content">Izmeni trajanje (Opciono)</h3>
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <input
                    type="number"
                    placeholder="npr. 45 (minuta)"
                    className={`input input-bordered w-full sm:flex-grow ${error && newDuration ? 'input-error' : 'focus:input-primary'}`}
                    value={newDuration}
                    onChange={handleDurationChange}
                    disabled={isUpdating}
                  />
                  <button
                    onClick={handleSubmitDurationUpdate}
                    className="btn btn-secondary btn-sm sm:btn-md" // btn-sm za mobilne, btn-md za veće
                    disabled={isUpdating || !newDuration.trim()}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    {isUpdating && !successMessage && !error && newDuration ? <span className="loading loading-spinner loading-xs"></span> : 'Ažuriraj trajanje'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                {appointment.status.toLowerCase() !== 'rejected' && (
                     <button
                        onClick={() => handleUpdateStatus('rejected')}
                        className="btn btn-error btn-outline btn-sm sm:btn-md"
                        disabled={isUpdating}
                    >
                        <XCircle className="h-5 w-5 mr-1" />
                        {isUpdating && !successMessage && !error ? <span className="loading loading-spinner loading-xs"></span> : 'Odbij'}
                    </button>
                )}
                {appointment.status.toLowerCase() !== 'approved' && appointment.status.toLowerCase() !== 'confirmed' && (
                     <button
                        onClick={() => handleUpdateStatus('approved')}
                        className="btn btn-success btn-sm sm:btn-md"
                        disabled={isUpdating}
                    >
                        <CheckCircle2 className="h-5 w-5 mr-1" />
                        {isUpdating && !successMessage && !error ? <span className="loading loading-spinner loading-xs"></span> : 'Odobri'}
                    </button>
                )}
              </div>
            </div>
          </>
        )}

        {successMessage && (
            <div role="alert" className="alert alert-success mt-4 text-xs p-3 rounded-md"> 
                <Info className="h-5 w-5"/>
                <span>{successMessage}</span>
            </div>
        )}
        {error && (
            <div role="alert" className="alert alert-error mt-4 text-xs p-3 rounded-md"> 
                <AlertTriangle className="h-5 w-5"/>
                <span>{error}</span>
            </div>
        )}
      </div>
    </div>
  );
}