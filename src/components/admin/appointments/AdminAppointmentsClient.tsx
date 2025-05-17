// src/components/admin/appointments/AdminAppointmentsClient.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import AppointmentList from './AppointmentList';
import { Worker as PrismaWorker } from '@prisma/client';
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums';

import { Loader2, AlertTriangle, Users2 as NoAppointmentsIcon } from 'lucide-react'; // Added NoAppointmentsIcon

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
  ownedVendorId?: string | null; // Passed from page if VENDOR_OWNER
}

export default function AdminAppointmentsClient({ userRole, ownedVendorId }: AdminAppointmentsClientProps) {
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  const [vendorWorkers, setVendorWorkers] = useState<PrismaWorker[]>([]);

  const fetchAppointments = useCallback(async (page: number = 1, status: AppointmentStatus | '' = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', '10');
      if (status) {
        queryParams.append('status', status);
      }
      // API /api/appointments now includes worker data
      const response = await fetch(`/api/appointments?${queryParams.toString()}`);
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
          const response = await fetch(`/api/admin/vendors/${ownedVendorId}/workers`);
          if (!response.ok) {
            console.error('Neuspešno preuzimanje radnika za salon.');
            setVendorWorkers([]); // Set to empty array on error
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
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleApprove = async (appointmentId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/admin/appointments/${appointmentId}/approve`, { method: 'POST' });
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
      const response = await fetch(`/api/admin/appointments/${appointmentId}/reject`, {
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
      const response = await fetch(`/api/admin/appointments/${appointmentId}/duration`, {
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
      const response = await fetch(`/api/admin/appointments/${appointmentId}/assign-worker`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Dodela radnika nije uspela.' }));
        throw new Error(errData.message || 'Neuspešna dodela radnika.');
      }
      fetchAppointments(currentPage, statusFilter); // Refresh list to show updated worker
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri dodeli radnika.');
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
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center">
        <label htmlFor="statusFilter" className="label font-medium text-base-content">Filtriraj po statusu:</label>
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
