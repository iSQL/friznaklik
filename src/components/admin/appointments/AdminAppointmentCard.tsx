// src/components/admin/appointments/AdminAppointmentCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { AdminAppointment } from './AdminAppointmentsClient';
import { Worker as PrismaWorker } from '@prisma/client'; 
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums';

import { format, parseISO } from 'date-fns';
import { sr } from 'date-fns/locale';
import { User as UserIcon, Briefcase, CalendarDays, Clock, Info, Hash, Edit, CheckCircle, XCircle, AlertTriangle, Tag, UserCog, Loader2, UsersRound } from 'lucide-react';

// Interface for the props expected by AdminAppointmentCard
interface AdminAppointmentCardProps {
  appointment: AdminAppointment;
  userRole: UserRole;
  onApprove: (appointmentId: string) => Promise<void>;
  onReject: (appointmentId: string, rejectionReason?: string) => Promise<void>;
  onUpdateDuration: (appointmentId: string, newDuration: number) => Promise<void>;
  onAssignWorker: (appointmentId: string, workerId: string | null) => Promise<void>; // Ensure this prop is defined
  vendorWorkers: PrismaWorker[];
}

export default function AdminAppointmentCard({
  appointment,
  userRole,
  onApprove,
  onReject,
  onUpdateDuration,
  onAssignWorker, // Prop is now declared
  vendorWorkers,
}: AdminAppointmentCardProps) {
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isDurationModalOpen, setIsDurationModalOpen] = useState(false);
  const [newDuration, setNewDuration] = useState<string>(appointment.service.duration?.toString() || '30');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState<string | null>(null);

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(appointment.workerId || null);
  const [isAssignWorkerModalOpen, setIsAssignWorkerModalOpen] = useState(false);


  useEffect(() => {
    setSelectedWorkerId(appointment.workerId || null);
  }, [appointment.workerId]);

  const cardBgColor = () => {
    switch (appointment.status) {
      case AppointmentStatus.PENDING: return 'bg-warning/10 border-warning';
      case AppointmentStatus.CONFIRMED: return 'bg-success/10 border-success';
      case AppointmentStatus.CANCELLED_BY_USER:
      case AppointmentStatus.CANCELLED_BY_VENDOR:
      case AppointmentStatus.REJECTED: return 'bg-error/10 border-error';
      case AppointmentStatus.COMPLETED: return 'bg-info/10 border-info';
      case AppointmentStatus.NO_SHOW: return 'bg-neutral-content/10 border-neutral-content';
      default: return 'bg-base-100 border-base-300';
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
    setIsProcessingAction('reject');
    setActionError(null);
    try {
      await onReject(appointment.id, rejectionReason);
      setIsRejectModalOpen(false);
      setRejectionReason('');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Došlo je do greške pri odbijanju.");
    } finally {
      setIsProcessingAction(null);
    }
  };

  const handleDurationSubmit = async () => {
    const durationNum = parseInt(newDuration, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      setActionError('Molimo unesite validno trajanje u minutima.');
      return;
    }
    setIsProcessingAction('duration');
    setActionError(null);
    try {
      await onUpdateDuration(appointment.id, durationNum);
      setIsDurationModalOpen(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Došlo je do greške pri izmeni trajanja.");
    } finally {
      setIsProcessingAction(null);
    }
  };

  const handleApproveClick = async () => {
    setIsProcessingAction('approve');
    setActionError(null);
    try {
      await onApprove(appointment.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Došlo je do greške pri odobravanju.");
    } finally {
      setIsProcessingAction(null);
    }
  };

  const handleAssignWorkerSubmit = async () => {
    setIsProcessingAction('assignWorker');
    setActionError(null);
    try {
      await onAssignWorker(appointment.id, selectedWorkerId);
      setIsAssignWorkerModalOpen(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Greška pri dodeli radnika.");
    } finally {
      setIsProcessingAction(null);
    }
  };

  const canPerformActions = appointment.status === AppointmentStatus.PENDING || appointment.status === AppointmentStatus.CONFIRMED;
  const canAssignWorker = userRole === UserRole.VENDOR_OWNER && canPerformActions;
  const canSuperAdminAssignWorker = userRole === UserRole.SUPER_ADMIN && canPerformActions;


  return (
    <div className={`card shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out border-l-4 ${cardBgColor()} overflow-hidden`}>
      <div className="card-body p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-3 gap-2">
          <h3 className="card-title text-lg font-semibold text-base-content">
            Termin: {format(parseISO(appointment.startTime), 'dd.MM.yyyy HH:mm', { locale: sr })}
          </h3>
          <span className={`badge ${
            appointment.status === AppointmentStatus.PENDING ? 'badge-warning' :
            appointment.status === AppointmentStatus.CONFIRMED ? 'badge-success' :
            appointment.status === AppointmentStatus.CANCELLED_BY_USER || appointment.status === AppointmentStatus.CANCELLED_BY_VENDOR || appointment.status === AppointmentStatus.REJECTED ? 'badge-error' :
            appointment.status === AppointmentStatus.COMPLETED ? 'badge-info' :
            'badge-ghost'
          } badge-md font-semibold whitespace-nowrap`}>
            {statusTextMap[appointment.status] || appointment.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-base-content/90">
          <div className="flex items-center">
            <UserIcon className="w-4 h-4 mr-2 text-primary shrink-0" />
            <strong>Korisnik:</strong>&nbsp;
            {appointment.user.firstName || 'N/A'} {appointment.user.lastName || ''} ({appointment.user.email || 'N/A'})
          </div>
          <div className="flex items-center">
            <Briefcase className="w-4 h-4 mr-2 text-primary shrink-0" />
            <strong>Usluga:</strong>&nbsp;
            {appointment.service.name || 'N/A'}
          </div>

          {userRole === UserRole.SUPER_ADMIN && (
            <div className="flex items-center md:col-span-2">
              <Tag className="w-4 h-4 mr-2 text-accent shrink-0" />
              <strong>Salon:</strong>&nbsp;
              {appointment.vendor.name || 'N/A'} (ID: {appointment.vendor.id})
            </div>
          )}

          <div className="flex items-center">
            <UserCog className="w-4 h-4 mr-2 text-secondary shrink-0" />
            <strong>Radnik:</strong>&nbsp;
            {appointment.worker?.name ? (
                <>
                    {appointment.worker.name}
                    {appointment.worker.id && <span className="text-xs opacity-70 ml-1">(ID: {appointment.worker.id.substring(0,8)}...)</span>}
                </>
            ): (
                <span className="italic text-base-content/70">Nije dodeljen</span>
            )}
          </div>


          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-2 text-primary shrink-0" />
            <strong>Trajanje (orig.):</strong>&nbsp;
            {appointment.service.duration || 'N/A'} min
          </div>
          <div className="flex items-center">
            <CalendarDays className="w-4 h-4 mr-2 text-primary shrink-0" />
            <strong>Kraj (izračunat):</strong>&nbsp;
            {format(parseISO(appointment.endTime), 'dd.MM.yyyy HH:mm', { locale: sr })}
          </div>

          {appointment.notes && (
            <div className="flex items-start md:col-span-2 mt-1">
              <Info className="w-4 h-4 mr-2 text-info mt-1 shrink-0" />
              <div>
                <strong>Napomene:</strong>&nbsp;
                <p className="whitespace-pre-wrap break-words inline">{appointment.notes}</p>
              </div>
            </div>
          )}
           <div className="flex items-center text-xs text-base-content/60 md:col-span-2">
            <Hash className="w-3 h-3 mr-1" /> ID Termina: {appointment.id}
          </div>
        </div>

        {actionError && (
          <div role="alert" className="alert alert-error text-xs p-2 mt-3">
            <AlertTriangle className="w-4 h-4" />
            <span>{actionError}</span>
          </div>
        )}

        {canPerformActions && (
          <div className="card-actions justify-end mt-4 pt-4 border-t border-base-300/50 space-x-2 flex-wrap gap-y-2">
            {appointment.status === AppointmentStatus.PENDING && (
              <button
                className="btn btn-success btn-sm"
                onClick={handleApproveClick}
                disabled={isProcessingAction === 'approve'}
              >
                {isProcessingAction === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                Odobri
              </button>
            )}
            {(canAssignWorker || canSuperAdminAssignWorker) && vendorWorkers.length > 0 && (
                 <button
                    className="btn btn-outline btn-secondary btn-sm"
                    onClick={() => {
                        setSelectedWorkerId(appointment.workerId || null); // Pre-fill with current worker
                        setIsAssignWorkerModalOpen(true);
                    }}
                    disabled={!!isProcessingAction}
                 >
                    <UsersRound className="w-4 h-4 mr-1" />
                    {appointment.workerId ? 'Promeni Radnika' : 'Dodeli Radnika'}
                 </button>
            )}
            <button
              className="btn btn-error btn-sm"
              onClick={() => setIsRejectModalOpen(true)}
              disabled={!!isProcessingAction}
            >
              {isProcessingAction === 'reject_modal_open' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
              Odbij / Otkaži
            </button>
            <button
              className="btn btn-outline btn-info btn-sm"
              onClick={() => setIsDurationModalOpen(true)}
              disabled={!!isProcessingAction}
            >
              {isProcessingAction === 'duration_modal_open' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit className="w-4 h-4 mr-1" />}
              Promeni Trajanje
            </button>
          </div>
        )}
      </div>

      {/* Modal za dodelu radnika */}
      {isAssignWorkerModalOpen && (
        <dialog open className="modal modal-bottom sm:modal-middle modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Dodeli Radnika Terminu</h3>
            <button onClick={() => {setIsAssignWorkerModalOpen(false); setActionError(null);}} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" disabled={isProcessingAction === 'assignWorker'}>✕</button>
            <p className="py-2">Izaberite radnika za ovaj termin:</p>
            <select
              className="select select-bordered w-full"
              value={selectedWorkerId || ""}
              onChange={(e) => setSelectedWorkerId(e.target.value || null)}
              disabled={isProcessingAction === 'assignWorker'}
            >
              <option value="">Nije dodeljen / Ukloni radnika</option>
              {vendorWorkers.map(worker => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
            {actionError && isProcessingAction !== 'assignWorker' && <p className="text-error text-xs mt-1">{actionError}</p>}
            <div className="modal-action mt-4">
              <button className="btn btn-ghost" onClick={() => {setIsAssignWorkerModalOpen(false); setActionError(null);}} disabled={isProcessingAction === 'assignWorker'}>Otkaži</button>
              <button className="btn btn-primary" onClick={handleAssignWorkerSubmit} disabled={isProcessingAction === 'assignWorker'}>
                {isProcessingAction === 'assignWorker' ? <Loader2 className="w-4 h-4 animate-spin" /> : ''}
                Sačuvaj Dodelu
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => {setIsAssignWorkerModalOpen(false); setActionError(null);}} disabled={isProcessingAction === 'assignWorker'}>close</button>
          </form>
        </dialog>
      )}


      {/* Modal za odbijanje termina */}
      {isRejectModalOpen && (
        <dialog open className="modal modal-bottom sm:modal-middle modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Odbijanje/Otkazivanje Termina</h3>
            <button onClick={() => { setIsRejectModalOpen(false); setActionError(null); }} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" disabled={isProcessingAction === 'reject'}>✕</button>
            <p className="py-2">Unesite razlog odbijanja/otkazivanja (opciono):</p>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Razlog..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              disabled={isProcessingAction === 'reject'}
            />
            {actionError && isProcessingAction !== 'reject' && <p className="text-error text-xs mt-1">{actionError}</p>}
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setIsRejectModalOpen(false); setActionError(null); }} disabled={isProcessingAction === 'reject'}>Otkaži</button>
              <button className="btn btn-error" onClick={handleRejectSubmit} disabled={isProcessingAction === 'reject'}>
                {isProcessingAction === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : ''}
                Potvrdi Odbijanje
              </button>
            </div>
          </div>
           <form method="dialog" className="modal-backdrop">
            <button onClick={() => { setIsRejectModalOpen(false); setActionError(null); }} disabled={isProcessingAction === 'reject'}>close</button>
          </form>
        </dialog>
      )}

      {/* Modal za promenu trajanja */}
      {isDurationModalOpen && (
        <dialog open className="modal modal-bottom sm:modal-middle modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Promena Trajanja Termina</h3>
            <button onClick={() => { setIsDurationModalOpen(false); setActionError(null); }} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" disabled={isProcessingAction === 'duration'}>✕</button>
            <p className="py-2">Unesite novo trajanje u minutima:</p>
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="Novo trajanje (npr. 45)"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              disabled={isProcessingAction === 'duration'}
            />
            {actionError && isProcessingAction !== 'duration' && <p className="text-error text-xs mt-1">{actionError}</p>}
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setIsDurationModalOpen(false); setActionError(null); }} disabled={isProcessingAction === 'duration'}>Otkaži</button>
              <button className="btn btn-primary" onClick={handleDurationSubmit} disabled={isProcessingAction === 'duration'}>
                {isProcessingAction === 'duration' ? <Loader2 className="w-4 h-4 animate-spin" /> : ''}
                Sačuvaj Trajanje
              </button>
            </div>
          </div>
           <form method="dialog" className="modal-backdrop">
            <button onClick={() => { setIsDurationModalOpen(false); setActionError(null); }} disabled={isProcessingAction === 'duration'}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
