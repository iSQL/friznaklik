'use client';

import { useState } from 'react';
import { AdminAppointment } from './AdminAppointmentsClient';
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums';
import { format, parseISO } from 'date-fns';
import { sr } from 'date-fns/locale';

import { User, Briefcase, CalendarDays, Clock, Info, Hash, Edit, CheckCircle, XCircle, AlertTriangle, Tag } from 'lucide-react';

interface AdminAppointmentCardProps {
  appointment: AdminAppointment;
  userRole: UserRole;
  onApprove: (appointmentId: string) => Promise<void>;
  onReject: (appointmentId: string, rejectionReason?: string) => Promise<void>;
  onUpdateDuration: (appointmentId: string, newDuration: number) => Promise<void>;
}

export default function AdminAppointmentCard({
  appointment,
  userRole,
  onApprove,
  onReject,
  onUpdateDuration,
}: AdminAppointmentCardProps) {
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isDurationModalOpen, setIsDurationModalOpen] = useState(false);
  const [newDuration, setNewDuration] = useState<string>(appointment.service.duration?.toString() || '30');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const cardBgColor = () => {
    switch (appointment.status) {
      case AppointmentStatus.PENDING:
        return 'bg-warning/10 border-warning'; 
      case AppointmentStatus.CONFIRMED:
        return 'bg-success/10 border-success'; 
      case AppointmentStatus.CANCELLED_BY_USER:
      case AppointmentStatus.CANCELLED_BY_VENDOR:
        return 'bg-error/10 border-error';   
      case AppointmentStatus.COMPLETED:
        return 'bg-info/10 border-info';     
      case AppointmentStatus.NO_SHOW:
        return 'bg-neutral-content/10 border-neutral-content';
      default:
        return 'bg-base-100 border-base-300';
    }
  };
  
  const statusTextMap: Record<AppointmentStatus, string> = {
    [AppointmentStatus.PENDING]: 'Na čekanju',
    [AppointmentStatus.CONFIRMED]: 'Potvrđen',
    [AppointmentStatus.CANCELLED_BY_USER]: 'Otkazao korisnik',
    [AppointmentStatus.CANCELLED_BY_VENDOR]: 'Otkazao salon',
    [AppointmentStatus.COMPLETED]: 'Završen',
    [AppointmentStatus.NO_SHOW]: 'Nije se pojavio',
    [AppointmentStatus.REJECTED]: 'Odbijen',
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim() && !confirm("Da li ste sigurni da želite da odbijete termin bez navođenja razloga?")) {
        return;
    }
    setIsProcessing(true);
    setActionError(null);
    try {
      await onReject(appointment.id, rejectionReason);
      setIsRejectModalOpen(false);
      setRejectionReason('');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Došlo je do greške.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDurationSubmit = async () => {
    const durationNum = parseInt(newDuration, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      setActionError('Molimo unesite validno trajanje u minutima.');
      return;
    }
    setIsProcessing(true);
    setActionError(null);
    try {
      await onUpdateDuration(appointment.id, durationNum);
      setIsDurationModalOpen(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Došlo je do greške.");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleApproveClick = async () => {
    setIsProcessing(true);
    setActionError(null);
    try {
      await onApprove(appointment.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Došlo je do greške.");
    } finally {
      setIsProcessing(false);
    }
  };

  const canPerformActions = appointment.status === AppointmentStatus.PENDING || appointment.status === AppointmentStatus.CONFIRMED;


  return (
    <div className={`card shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out border-l-4 ${cardBgColor()}`}>
      <div className="card-body p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-3">
          <h3 className="card-title text-lg font-semibold">
            Termin: {format(parseISO(appointment.startTime), 'dd.MM.yyyy HH:mm', { locale: sr })}
          </h3>
          <span className={`badge ${
            appointment.status === AppointmentStatus.PENDING ? 'badge-warning' :
            appointment.status === AppointmentStatus.CONFIRMED ? 'badge-success' :
            appointment.status === AppointmentStatus.CANCELLED_BY_USER || appointment.status === AppointmentStatus.CANCELLED_BY_VENDOR ? 'badge-error' :
            appointment.status === AppointmentStatus.COMPLETED ? 'badge-info' :
            'badge-ghost' 
          } badge-md font-semibold`}>
            {statusTextMap[appointment.status] || appointment.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div className="flex items-center">
            <User className="w-4 h-4 mr-2 text-primary" />
            <strong>Korisnik:</strong>&nbsp;
            {appointment.user.firstName || 'N/A'} {appointment.user.lastName || ''} ({appointment.user.email || 'N/A'})
          </div>
          <div className="flex items-center">
            <Briefcase className="w-4 h-4 mr-2 text-primary" />
            <strong>Usluga:</strong>&nbsp;
            {appointment.service.name || 'N/A'}
          </div>
          
          {userRole === UserRole.SUPER_ADMIN && (
            <div className="flex items-center md:col-span-2">
              <Tag className="w-4 h-4 mr-2 text-accent" />
              <strong>Salon:</strong>&nbsp;
              {appointment.vendor.name || 'N/A'} (ID: {appointment.vendor.id})
            </div>
          )}

          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-2 text-primary" />
            <strong>Originalno trajanje:</strong>&nbsp;
            {appointment.service.duration || 'N/A'} min
          </div>
          <div className="flex items-center">
            <CalendarDays className="w-4 h-4 mr-2 text-primary" />
            <strong>Kraj termina (izračunat):</strong>&nbsp;
            {format(parseISO(appointment.endTime), 'dd.MM.yyyy HH:mm', { locale: sr })}
          </div>
          {appointment.worker?.name && (
            <div className="flex items-center">
                <User className="w-4 h-4 mr-2 text-secondary" /> {/* Drugačija ikonica ili boja za radnika */}
                <strong>Radnik:</strong>&nbsp;
                {appointment.worker.name}
            </div>
          )}
          {appointment.notes && (
            <div className="flex items-start md:col-span-2 mt-1">
              <Info className="w-4 h-4 mr-2 text-info mt-1 shrink-0" />
              <div>
                <strong>Napomene:</strong>&nbsp;
                <p className="whitespace-pre-wrap break-words inline">{appointment.notes}</p>
              </div>
            </div>
          )}
           <div className="flex items-center text-xs text-gray-500">
            <Hash className="w-3 h-3 mr-1" /> ID: {appointment.id}
          </div>
        </div>

        {actionError && (
          <div role="alert" className="alert alert-error text-xs p-2 mt-3">
            <AlertTriangle className="w-4 h-4" />
            <span>{actionError}</span>
          </div>
        )}

        {canPerformActions && (
          <div className="card-actions justify-end mt-4 pt-4 border-t border-base-300/50 space-x-2">
            {appointment.status === AppointmentStatus.PENDING && (
              <button 
                className="btn btn-success btn-sm" 
                onClick={handleApproveClick}
                disabled={isProcessing}
              >
                {isProcessing ? <span className="loading loading-spinner loading-xs"></span> : <CheckCircle className="w-4 h-4 mr-1" />}
                Odobri
              </button>
            )}
            <button 
              className="btn btn-error btn-sm" 
              onClick={() => setIsRejectModalOpen(true)}
              disabled={isProcessing}
            >
              {isProcessing ? <span className="loading loading-spinner loading-xs"></span> : <XCircle className="w-4 h-4 mr-1" />}
              Odbij / Otkaži
            </button>
            <button 
              className="btn btn-outline btn-info btn-sm" 
              onClick={() => setIsDurationModalOpen(true)}
              disabled={isProcessing}
            >
              {isProcessing ? <span className="loading loading-spinner loading-xs"></span> : <Edit className="w-4 h-4 mr-1" />}
              Promeni Trajanje
            </button>
          </div>
        )}
      </div>

      {/* Modal za odbijanje termina */}
      {isRejectModalOpen && (
        <dialog open className="modal modal-bottom sm:modal-middle">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Odbijanje Termina</h3>
            <p className="py-2">Unesite razlog odbijanja (opciono):</p>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Razlog odbijanja..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              disabled={isProcessing}
            />
            {actionError && <p className="text-error text-xs mt-1">{actionError}</p>}
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setIsRejectModalOpen(false); setActionError(null); }} disabled={isProcessing}>Otkaži</button>
              <button className="btn btn-error" onClick={handleRejectSubmit} disabled={isProcessing}>
                {isProcessing ? <span className="loading loading-spinner loading-xs"></span> : ''}
                Potvrdi Odbijanje
              </button>
            </div>
          </div>
           <form method="dialog" className="modal-backdrop"> 
            <button onClick={() => { setIsRejectModalOpen(false); setActionError(null); }}>close</button>
          </form>
        </dialog>
      )}

      {/* Modal za promenu trajanja */}
      {isDurationModalOpen && (
        <dialog open className="modal modal-bottom sm:modal-middle">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Promena Trajanja Termina</h3>
            <p className="py-2">Unesite novo trajanje u minutima:</p>
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="Novo trajanje (npr. 45)"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              disabled={isProcessing}
            />
            {actionError && <p className="text-error text-xs mt-1">{actionError}</p>}
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setIsDurationModalOpen(false); setActionError(null); }} disabled={isProcessing}>Otkaži</button>
              <button className="btn btn-primary" onClick={handleDurationSubmit} disabled={isProcessing}>
                {isProcessing ? <span className="loading loading-spinner loading-xs"></span> : ''}
                Sačuvaj Trajanje
              </button>
            </div>
          </div>
           <form method="dialog" className="modal-backdrop">
            <button onClick={() => { setIsDurationModalOpen(false); setActionError(null); }}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
