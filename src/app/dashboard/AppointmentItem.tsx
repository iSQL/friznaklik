// src/app/dashboard/AppointmentItem.tsx
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Appointment, Service } from '@prisma/client';
import { format, isPast } from 'date-fns';
import { sr } from 'date-fns/locale'; // Srpska lokalizacija za date-fns
import { formatErrorMessage } from '@/lib/errorUtils';
import { CalendarOff, AlertTriangle, CheckCircle2, Clock, HelpCircle, XCircle } from 'lucide-react'; // Dodate ikone

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
          message: `Otkazivanje termina nije uspelo (Status: ${response.status})`,
          status: response.status
        };
        try {
          const parsedError = await response.json();
          errorData.message = parsedError.message || parsedError.error || errorData.message;
          errorData.details = parsedError.details;
        } catch (e) {
          console.error('Greška pri parsiranju odgovora o grešci:', e);
          errorData.details = await response.text(); 
        }
        throw errorData; 
      }
      handleCloseCancelModal(); 
      router.refresh();
    } catch (err: unknown) {
      const userFriendlyError = formatErrorMessage(err, `otkazivanja termina za ${appointment.service.name}`);
      setError(userFriendlyError);
    } finally {
      setIsCancelling(false);
    }
  };

  
  const canCancel = ['pending', 'approved'].includes(appointment.status.toLowerCase()) && !isPast(new Date(appointment.startTime));

 
  const getStatusBadgeClass = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'approved': return 'badge-success';   
      case 'pending': return 'badge-warning';     
      case 'cancelled': return 'badge-error';    
      case 'rejected': return 'badge-neutral text-base-content opacity-80'; 
      case 'completed': return 'badge-info';     
      default: return 'badge-ghost';          
    }
  };

  const getTranslatedStatus = (status: string): string => {
    const lowerStatus = status.toLowerCase();
    switch (lowerStatus) {
      case 'approved': return 'Odobren';
      case 'pending': return 'Na čekanju';
      case 'cancelled': return 'Otkazan';
      case 'rejected': return 'Odbijen';
      case 'completed': return 'Završen';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };
  
  const StatusIcon = ({ status }: { status: string }) => {
    const lowerStatus = status.toLowerCase();
    switch (lowerStatus) {
      case 'approved': return <CheckCircle2 className="h-4 w-4 mr-1.5" />;
      case 'pending': return <Clock className="h-4 w-4 mr-1.5" />;
      case 'cancelled':
      case 'rejected': return <XCircle className="h-4 w-4 mr-1.5" />;
      default: return <HelpCircle className="h-4 w-4 mr-1.5" />;
    }
  };


  return (
    <>
      <div className="card card-bordered bg-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex-grow">
              <h2 className="card-title text-xl text-primary mb-1">
                {appointment.service.name}
              </h2>
              <p className="text-sm text-base-content opacity-80">
                {format(new Date(appointment.startTime), 'eeee, dd. MMMM yyyy.', { locale: sr })}
              </p>
              <p className="text-sm text-base-content opacity-80">
                Vreme: {format(new Date(appointment.startTime), 'HH:mm')} - {format(new Date(appointment.endTime), 'HH:mm')}
                {isPast(new Date(appointment.endTime)) && appointment.status.toLowerCase() !== 'completed' && appointment.status.toLowerCase() !== 'cancelled' && (
                  <span className="text-xs text-warning ml-2">(Prošao)</span>
                )}
              </p>
              <div className="mt-2">
                <span className={`badge ${getStatusBadgeClass(appointment.status)} badge-md font-medium items-center`}>
                  <StatusIcon status={appointment.status} />
                  {getTranslatedStatus(appointment.status)}
                </span>
              </div>
            </div>

            {canCancel && (
              <button
                onClick={handleOpenCancelModal}
                disabled={isCancelling}
                className="btn btn-outline btn-error btn-sm mt-3 sm:mt-0 self-start sm:self-center"
                aria-label="Otkaži termin"
              >
                <CalendarOff className="h-4 w-4 mr-1" />
                Otkaži
              </button>
            )}
          </div>
           {appointment.adminNotes && (
            <div className="mt-3 pt-3 border-t border-base-300/50">
                <p className="text-xs font-semibold text-base-content/70">Napomena administratora:</p>
                <p className="text-sm text-base-content/90 italic">{appointment.adminNotes}</p>
            </div>
           )}
        </div>
      </div>

      <dialog ref={modalRef} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box bg-base-200 text-base-content">
          <form method="dialog">
            <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={handleCloseCancelModal}>✕</button>
          </form>
          <div className="flex items-start mb-3">
            <AlertTriangle className="h-8 w-8 text-warning mr-3 shrink-0 mt-1" />
            <h3 className="font-bold text-xl">Potvrda Otkazivanja</h3>
          </div>
          <p className="py-2 opacity-90">
            Da li ste sigurni da želite da otkažete Vaš termin za <span className="font-semibold text-primary">{appointment.service.name}</span>
            dana <span className="font-semibold">{format(new Date(appointment.startTime), 'dd. MMMM yyyy.', { locale: sr })}</span>
            u <span className="font-semibold">{format(new Date(appointment.startTime), 'HH:mm')}</span>?
          </p>
          <p className="text-sm opacity-70 mt-1">Ova radnja se ne može opozvati.</p>

          {error && (
            <div role="alert" className="alert alert-error mt-4 text-xs p-3">
              <AlertTriangle className="h-4 w-4"/>
              <span>{error}</span>
            </div>
          )}
          <div className="modal-action mt-6">
            <button type="button" className="btn btn-ghost" onClick={handleCloseCancelModal} disabled={isCancelling}>
              Zadrži Termin
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
                  Otkazivanje...
                </>
              ) : (
                'Da, Otkaži'
              )}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={handleCloseCancelModal}>zatvori</button>
        </form>
      </dialog>
    </>
  );
}