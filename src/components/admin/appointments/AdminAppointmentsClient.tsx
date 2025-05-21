'use client';

import { useState, useEffect, useCallback } from 'react';
import AppointmentList from './AppointmentList';
import { Worker as PrismaWorker } from '@prisma/client';
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums';
import { formatErrorMessage } from '@/lib/errorUtils';

import { Loader2, AlertTriangle, Users2 as NoAppointmentsIcon, CheckCircle, Trash2, Filter } from 'lucide-react';

interface AppointmentUser {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}
interface AppointmentService {
  name?: string | null;
  duration?: number | null;
}
interface AppointmentVendor {
  id: string;
  name?: string | null;
}
export interface AppointmentWorker {
  id: string;
  name?: string | null;
}

export interface AdminAppointment {
  id: string;
  userId: string;
  user: AppointmentUser;
  serviceId: string;
  service: AppointmentService;
  vendorId: string;
  vendor: AppointmentVendor;
  workerId?: string | null;
  worker?: AppointmentWorker | null;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminAppointmentsClientProps {
  userRole: UserRole;
  ownedVendorId?: string | null;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function AdminAppointmentsClient({ userRole, ownedVendorId }: AdminAppointmentsClientProps) {
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  const [vendorWorkers, setVendorWorkers] = useState<PrismaWorker[]>([]);

  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [approveAllError, setApproveAllError] = useState<string | null>(null);
  const [approveAllSuccess, setApproveAllSuccess] = useState<string | null>(null);

  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [cleanupSuccess, setCleanupSuccess] = useState<string | null>(null);


  const fetchAppointments = useCallback(async (page: number = 1, status: AppointmentStatus | '' = '') => {
    setIsLoading(true);
    setError(null);
    // Clear batch action messages on new fetch
    setApproveAllError(null);
    setApproveAllSuccess(null);
    setCleanupError(null);
    setCleanupSuccess(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', '10');
      if (status) {
        queryParams.append('status', status);
      }
      const response = await fetch(`${SITE_URL}/api/appointments?${queryParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Neuspešno preuzimanje termina: ${response.statusText}` }));
        throw new Error(errorData.message || `Neuspešno preuzimanje termina: ${response.statusText}`);
      }
      const data: { appointments: AdminAppointment[], totalPages: number, currentPage: number, totalAppointments: number } = await response.json();
      setAppointments(data.appointments);
      setTotalPages(data.totalPages);
      setCurrentPage(data.currentPage);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Došlo je do nepoznate greške prilikom preuzimanja termina.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments(currentPage, statusFilter);
  }, [fetchAppointments, currentPage, statusFilter]);

  useEffect(() => {
    if (userRole === UserRole.VENDOR_OWNER && ownedVendorId) {
      const fetchVendorWorkers = async () => {
        try {
          const response = await fetch(`${SITE_URL}/api/admin/vendors/${ownedVendorId}/workers`);
          if (!response.ok) {
            console.error('Neuspešno preuzimanje radnika za salon.');
            setVendorWorkers([]);
            return;
          }
          const data: PrismaWorker[] = await response.json();
          setVendorWorkers(data);
        } catch (fetchError) {
          console.error('Greška pri preuzimanju radnika:', fetchError);
          setVendorWorkers([]);
        }
      };
      fetchVendorWorkers();
    }
  }, [userRole, ownedVendorId]);


  const handleStatusChange = (newStatus: AppointmentStatus | '') => {
    setStatusFilter(newStatus);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleApprove = async (appointmentId: string) => {
    setError(null);
    try {
      const response = await fetch(`${SITE_URL}/api/admin/appointments/${appointmentId}/approve`, { method: 'POST' });
      if (!response.ok) {
        const errData = await response.json().catch(()=> ({message: 'Odobravanje termina nije uspelo.'}));
        throw new Error(errData.message || 'Neuspešno odobravanje termina.');
      }
      fetchAppointments(currentPage, statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri odobravanju.');
    }
  };

  const handleReject = async (appointmentId: string, rejectionReason?: string) => {
    setError(null);
    try {
      const response = await fetch(`${SITE_URL}/api/admin/appointments/${appointmentId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason })
      });
      if (!response.ok) {
        const errData = await response.json().catch(()=> ({message: 'Odbijanje termina nije uspelo.'}));
        throw new Error(errData.message || 'Neuspešno odbijanje termina.');
      }
      fetchAppointments(currentPage, statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri odbijanju.');
    }
  };

  const handleUpdateDuration = async (appointmentId: string, newDuration: number) => {
    setError(null);
    try {
      const response = await fetch(`${SITE_URL}/api/admin/appointments/${appointmentId}/duration`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDuration }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(()=> ({message: 'Izmena trajanja nije uspela.'}));
        throw new Error(errData.message || 'Neuspešna izmena trajanja termina.');
      }
      fetchAppointments(currentPage, statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri izmeni trajanja.');
    }
  };

  const handleAssignWorker = async (appointmentId: string, workerId: string | null) => {
    setError(null);
    try {
      const response = await fetch(`${SITE_URL}/api/admin/appointments/${appointmentId}/assign-worker`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Dodela radnika nije uspela.' }));
        throw new Error(errData.message || 'Neuspešna dodela radnika.');
      }
      fetchAppointments(currentPage, statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri dodeli radnika.');
    }
  };

  const handleApproveAllPending = async () => {
    if (!ownedVendorId && userRole === UserRole.VENDOR_OWNER) {
        setApproveAllError("ID salona nije dostupan za odobravanje svih termina.");
        return;
    }
    if (!confirm("Da li ste sigurni da želite da odobrite sve termine na čekanju za Vaš salon?")) return;

    setIsApprovingAll(true);
    setApproveAllError(null);
    setApproveAllSuccess(null);
    try {
        const response = await fetch(`${SITE_URL}/api/admin/appointments/bulk-approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // VENDOR_OWNER doesn't need to send vendorId, it's derived from their session
            // SUPER_ADMIN would need to send vendorId if they were to use this for a specific vendor
            body: userRole === UserRole.SUPER_ADMIN && ownedVendorId ? JSON.stringify({ vendorId: ownedVendorId }) : undefined,
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Neuspešno masovno odobravanje termina.");
        }
        setApproveAllSuccess(data.message || "Svi termini na čekanju su uspešno odobreni.");
        fetchAppointments(1, AppointmentStatus.PENDING); // Refresh and show pending (which should now be empty or fewer)
    } catch (err) {
        setApproveAllError(formatErrorMessage(err, "masovnog odobravanja termina"));
    } finally {
        setIsApprovingAll(false);
    }
  };

  const handleCleanupAppointments = async () => {
    if (!confirm("Da li ste sigurni da želite da uklonite otkazane, odbijene i veoma stare završene termine? Ova akcija je nepovratna.")) return;

    setIsCleaningUp(true);
    setCleanupError(null);
    setCleanupSuccess(null);
    try {
        const response = await fetch(`${SITE_URL}/api/admin/appointments/bulk-cleanup`, {
            method: 'POST', // Using POST for batch delete as DELETE usually targets one resource
            headers: { 'Content-Type': 'application/json' },
            // VENDOR_OWNER cleans their own, SUPER_ADMIN could potentially clean all or specific if API supports
            body: userRole === UserRole.SUPER_ADMIN && ownedVendorId ? JSON.stringify({ vendorId: ownedVendorId }) : undefined,
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Neuspešno čišćenje termina.");
        }
        setCleanupSuccess(data.message || "Terminalni i stari termini su uspešno uklonjeni.");
        fetchAppointments(1, statusFilter); 
    } catch (err) {
        setCleanupError(formatErrorMessage(err, "čišćenja termina"));
    } finally {
        setIsCleaningUp(false);
    }
  };


  if (isLoading && appointments.length === 0) {
    return (
        <div className="flex justify-center items-center min-h-[300px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-base-content/70">Učitavanje termina...</p>
        </div>
    );
  }

  if (error && !isLoading) {
    return (
        <div role="alert" className="alert alert-error my-8">
            <AlertTriangle className="h-6 w-6"/>
            <div>
                <h3 className="font-bold">Greška!</h3>
                <div className="text-xs">{error}</div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => fetchAppointments(currentPage, statusFilter)}>Pokušaj ponovo</button>
        </div>
    );
  }

  return (
    <div>
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 items-center w-full sm:w-auto">
                <label htmlFor="statusFilter" className="label font-medium text-base-content whitespace-nowrap">
                    <Filter size={16} className="mr-2"/>
                    Filtriraj po statusu:
                </label>
                <select
                    id="statusFilter"
                    value={statusFilter}
                    onChange={(e) => handleStatusChange(e.target.value as AppointmentStatus | '')}
                    className="select select-bordered w-full sm:w-auto focus:select-primary"
                >
                    <option value="">Svi Statusi</option>
                    {Object.values(AppointmentStatus).map(status => (
                        <option key={status} value={status}>{status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</option>
                    ))}
                </select>
                {isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary ml-2" />}
            </div>
            {userRole === UserRole.VENDOR_OWNER && (
                <button
                    onClick={handleApproveAllPending}
                    className="btn btn-success btn-sm w-full sm:w-auto"
                    disabled={isApprovingAll}
                >
                    {isApprovingAll ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <CheckCircle className="h-4 w-4 mr-2"/>}
                    Odobri sve na čekanju
                </button>
            )}
        </div>
         <div className="mb-6 flex justify-end">
             {(userRole === UserRole.VENDOR_OWNER || userRole === UserRole.SUPER_ADMIN) && (
                <button
                    onClick={handleCleanupAppointments}
                    className="btn btn-outline btn-error btn-sm"
                    disabled={isCleaningUp}
                >
                    {isCleaningUp ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Trash2 className="h-4 w-4 mr-2"/>}
                    Očisti stare/otkazane
                </button>
            )}
        </div>


        {approveAllSuccess && <div role="alert" className="alert alert-success my-4"><CheckCircle/><span>{approveAllSuccess}</span></div>}
        {approveAllError && <div role="alert" className="alert alert-error my-4"><AlertTriangle/><span>{approveAllError}</span></div>}
        {cleanupSuccess && <div role="alert" className="alert alert-success my-4"><CheckCircle/><span>{cleanupSuccess}</span></div>}
        {cleanupError && <div role="alert" className="alert alert-error my-4"><AlertTriangle/><span>{cleanupError}</span></div>}


      {appointments.length === 0 && !isLoading ? (
        <div className="text-center py-10 card bg-base-200 shadow border border-base-300/50">
            <div className="card-body">
                <NoAppointmentsIcon className="h-16 w-16 mx-auto text-base-content/30 mb-4" />
                <p className="text-xl text-base-content/70 font-semibold">Nema termina</p>
                <p className="text-base-content/60 mt-1">
                    {statusFilter ? `Nema termina koji odgovaraju statusu "${statusFilter.replace(/_/g, ' ').toLowerCase()}"` : "Nema zakazanih termina za prikaz."}
                </p>
            </div>
        </div>
      ) : (
        <AppointmentList
          appointments={appointments}
          userRole={userRole}
          onApprove={handleApprove}
          onReject={handleReject}
          onUpdateDuration={handleUpdateDuration}
          onAssignWorker={handleAssignWorker}
          vendorWorkers={userRole === UserRole.VENDOR_OWNER ? vendorWorkers : []}
        />
      )}

      {totalPages > 1 && (
        <div className="join flex justify-center mt-8">
          <button
            className="join-item btn btn-outline"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
          >
            «
          </button>
          <button className="join-item btn btn-outline no-animation">Strana {currentPage} od {totalPages}</button>
          <button
            className="join-item btn btn-outline"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}
