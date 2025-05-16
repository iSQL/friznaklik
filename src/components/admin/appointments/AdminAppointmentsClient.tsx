'use client';

import { useState, useEffect, useCallback } from 'react';
import AppointmentList from './AppointmentList'; 
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums';

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
interface AppointmentWorker {
    name?: string | null;
}

export interface AdminAppointment {
  id: string;
  userId: string;
  user: AppointmentUser; // Korisnik koji je zakazao
  serviceId: string;
  service: AppointmentService; 
  vendorId: string;
  vendor: AppointmentVendor; // Salon
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
}

export default function AdminAppointmentsClient({ userRole }: AdminAppointmentsClientProps) {
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>(''); 

  const fetchAppointments = useCallback(async (page: number = 1, status: AppointmentStatus | '' = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', '10'); // Broj termina po stranici
      if (status) {
        queryParams.append('status', status);
      }

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
      console.error("Greška pri preuzimanju termina:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments(currentPage, statusFilter);
  }, [fetchAppointments, currentPage, statusFilter]);

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
    try {
      const response = await fetch(`/api/admin/appointments/${appointmentId}/approve`, { method: 'POST' });
      if (!response.ok) throw new Error('Neuspešno odobravanje termina.');
      fetchAppointments(currentPage, statusFilter); 
      alert('Termin uspešno odobren!'); // TODO: Razmisliti o boljem UX-u
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri odobravanju.');
    }
  };

  const handleReject = async (appointmentId: string, rejectionReason?: string) => {
    try {
      const response = await fetch(`/api/admin/appointments/${appointmentId}/reject`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason })
      });
      if (!response.ok) throw new Error('Neuspešno odbijanje termina.');
      fetchAppointments(currentPage, statusFilter);
      alert('Termin uspešno odbijen!'); // TODO: Razmisliti o boljem UX-u
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri odbijanju.');
    }
  };

  const handleUpdateDuration = async (appointmentId: string, newDuration: number) => {
    try {
      const response = await fetch(`/api/admin/appointments/${appointmentId}/duration`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDuration }),
      });
      if (!response.ok) throw new Error('Neuspešna izmena trajanja termina.');
      fetchAppointments(currentPage, statusFilter);
    alert('Trajanje termina uspešno izmenjeno!'); // TODO: Razmisliti o boljem UX-u
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Greška pri izmeni trajanja.');
    }
  };

  if (isLoading && appointments.length === 0) { 
    return (
        <div className="flex justify-center items-center min-h-[300px]">
            <span className="loading loading-lg loading-spinner text-primary"></span>
            <p className="ml-4 text-lg">Učitavanje termina...</p>
        </div>
    );
  }
  
  if (error) {
    return (
        <div role="alert" className="alert alert-error my-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Greška: {error}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => fetchAppointments(currentPage, statusFilter)}>Pokušaj ponovo</button>
        </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center">
        <label htmlFor="statusFilter" className="label font-medium">Filtriraj po statusu:</label>
        <select 
            id="statusFilter"
            value={statusFilter} 
            onChange={(e) => handleStatusChange(e.target.value as AppointmentStatus | '')}
            className="select select-bordered w-full sm:w-auto"
        >
            <option value="">Svi Statusi</option>
            {Object.values(AppointmentStatus).map(status => (
                <option key={status} value={status}>{status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
        </select>
         {isLoading && <span className="loading loading-sm loading-spinner text-primary ml-2"></span>}
      </div>

      {appointments.length === 0 && !isLoading ? (
        <p className="text-center text-gray-500 py-10">Nema termina koji odgovaraju zadatim filterima.</p>
      ) : (
        <AppointmentList
          appointments={appointments}
          userRole={userRole} 
          onApprove={handleApprove}
          onReject={handleReject}
          onUpdateDuration={handleUpdateDuration}
        />
      )}

      {totalPages > 1 && (
        <div className="join flex justify-center mt-8">
          <button 
            className="join-item btn" 
            onClick={() => handlePageChange(currentPage - 1)} 
            disabled={currentPage === 1 || isLoading}
          >
            «
          </button>
          <button className="join-item btn">Strana {currentPage} od {totalPages}</button>
          <button 
            className="join-item btn" 
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

