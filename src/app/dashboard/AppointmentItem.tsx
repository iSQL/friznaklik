// src/app/dashboard/AppointmentItem.tsx
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Appointment, Service, Worker as PrismaWorker, Vendor } from '@prisma/client';
import { AppointmentStatus } from '@/lib/types/prisma-enums';
import { format, isPast } from 'date-fns';
import { sr } from 'date-fns/locale';
import { formatErrorMessage } from '@/lib/errorUtils';
import {
  CalendarOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  XCircle,
  MessageSquareText,
  UserCog,
  Building,
  Briefcase, // Icon for service
  Info // Icon for notes if MessageSquareText is too large
} from 'lucide-react';

interface AppointmentItemProps {
  appointment: Appointment & {
    service: Service;
    vendor: Pick<Vendor, 'name'>; // Only pick the name, or more if needed
    worker?: PrismaWorker | null;
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

  const canCancel =
    (appointment.status === AppointmentStatus.PENDING || appointment.status === AppointmentStatus.CONFIRMED) &&
    !isPast(new Date(appointment.startTime));


  const getStatusBadgeClass = (status: AppointmentStatus): string => {
    switch (status) {
      case AppointmentStatus.CONFIRMED: return 'badge-success';
      case AppointmentStatus.PENDING: return 'badge-warning';
      case AppointmentStatus.CANCELLED_BY_USER:
      case AppointmentStatus.CANCELLED_BY_VENDOR: return 'badge-error';
      case AppointmentStatus.REJECTED: return 'badge-neutral text-base-content opacity-80';
      case AppointmentStatus.COMPLETED: return 'badge-info';
      case AppointmentStatus.NO_SHOW: return 'badge-ghost';
      default: return 'badge-ghost';
    }
  };

  const getTranslatedStatus = (status: AppointmentStatus): string => {
    switch (status) {
      case AppointmentStatus.CONFIRMED: return 'Odobren';
      case AppointmentStatus.PENDING: return 'Na čekanju';
      case AppointmentStatus.CANCELLED_BY_USER: return 'Otkazao korisnik';
      case AppointmentStatus.CANCELLED_BY_VENDOR: return 'Otkazao salon';
      case AppointmentStatus.REJECTED: return 'Odbijen';
      case AppointmentStatus.COMPLETED: return 'Završen';
      case AppointmentStatus.NO_SHOW: return 'Nije se pojavio';
      default:
        const s = status as string;
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ');
    }
  };

  const StatusIcon = ({ status }: { status: AppointmentStatus }) => {
    const iconProps = { className: "h-3.5 w-3.5 mr-1" }; // Slightly smaller icons
    switch (status) {
      case AppointmentStatus.CONFIRMED: return <CheckCircle2 {...iconProps} />;
      case AppointmentStatus.PENDING: return <Clock {...iconProps} />;
      case AppointmentStatus.CANCELLED_BY_USER:
      case AppointmentStatus.CANCELLED_BY_VENDOR:
      case AppointmentStatus.REJECTED: return <XCircle {...iconProps} />;
      default: return <HelpCircle {...iconProps} />;
    }
  };

  return (
    <>
      <div className="card card-compact bg-base-100 shadow-md hover:shadow-lg transition-shadow duration-200 ease-in-out border-l-4 border-primary/50">
        <div className="card-body p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
            {/* Left side - Appointment Info */}
            <div className="flex-grow">
              <h2 className="card-title text-md sm:text-lg font-semibold text-primary mb-0.5 line-clamp-1">
                {appointment.service.name}
              </h2>
              <div className="text-xs text-base-content/80 space-y-0.5">
                <p className="flex items-center">
                  <Building size={12} className="mr-1.5 opacity-60 shrink-0" />
                  {appointment.vendor?.name || 'Nepoznat salon'}
                </p>
                <p className="flex items-center">
                  <Clock size={12} className="mr-1.5 opacity-60 shrink-0" />
                  {format(new Date(appointment.startTime), 'dd.MM.yy HH:mm', { locale: sr })} - {format(new Date(appointment.endTime), 'HH:mm')}
                  {isPast(new Date(appointment.endTime)) &&
                   appointment.status !== AppointmentStatus.COMPLETED &&
                   appointment.status !== AppointmentStatus.CANCELLED_BY_USER &&
                   appointment.status !== AppointmentStatus.CANCELLED_BY_VENDOR && (
                    <span className="text-warning ml-1">(Prošao)</span>
                  )}
                </p>
                {appointment.worker && (
                  <p className="flex items-center">
                    <UserCog size={12} className="mr-1.5 opacity-60 shrink-0" />
                    Radnik: {appointment.worker.name}
                  </p>
                )}
              </div>
            </div>

            {/* Right side - Status and Actions */}
            <div className="flex flex-col items-start sm:items-end gap-1 sm:gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
              <div className={`badge ${getStatusBadgeClass(appointment.status as AppointmentStatus)} badge-sm font-medium flex items-center self-start sm:self-end`}>
                <StatusIcon status={appointment.status as AppointmentStatus} />
                {getTranslatedStatus(appointment.status as AppointmentStatus)}
              </div>
              {canCancel && (
                <button
                  onClick={handleOpenCancelModal}
                  disabled={isCancelling}
                  className="btn btn-outline btn-error btn-xs w-full sm:w-auto" // btn-xs for more compactness
                  aria-label="Otkaži termin"
                >
                  <CalendarOff className="h-3.5 w-3.5 mr-1" />
                  Otkaži
                </button>
              )}
            </div>
          </div>

          {appointment.notes && (
            <div className="mt-2 pt-2 border-t border-base-300/30">
              <div className="flex items-center text-xs font-semibold text-base-content/70 mb-0.5">
                <Info size={12} className="mr-1.5" />
                Napomene:
              </div>
              <p className="text-xs text-base-content/90 italic whitespace-pre-wrap break-words line-clamp-2">
                {appointment.notes}
              </p>
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
            dana <span className="font-semibold">{format(new Date(appointment.startTime), 'dd. MMMM yy.', { locale: sr })}</span>
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
