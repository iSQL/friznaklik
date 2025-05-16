// src/components/admin/vendors/AdminVendorsClient.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PlusCircle, Store, Users, ClipboardList, CalendarDays, Edit3, Trash2, AlertTriangle } from 'lucide-react';
import { VendorStatus, UserRole } from '@/lib/types/prisma-enums';


// Definicija tipa za Vendor objekat koji očekujemo od API-ja
export interface VendorWithDetails {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  owner: {
    id: string;
    clerkId: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  address?: string | null;
  phoneNumber?: string | null;
  operatingHours?: any | null;
  status: VendorStatus;
  createdAt: string;
  updatedAt: string;
  _count: {
    services: number;
    appointments: number;
  };
}

interface AdminVendorsClientProps {
  userRole: UserRole;
}

export default function AdminVendorsClient({ userRole }: AdminVendorsClientProps) {
  const [vendors, setVendors] = useState<VendorWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null); // Za greške pri akcijama
  const [isProcessing, setIsProcessing] = useState(false); // Za praćenje da li je akcija u toku

  // Modal za potvrdu brisanja/suspendovanja
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<VendorWithDetails | null>(null);

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/vendors');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Neuspešno preuzimanje salona: ${response.statusText}` }));
        throw new Error(errorData.message || `Neuspešno preuzimanje salona: ${response.statusText}`);
      }
      const data: VendorWithDetails[] = await response.json();
      setVendors(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Došlo je do nepoznate greške prilikom preuzimanja salona.';
      setError(errorMessage);
      console.error("Greška pri preuzimanju salona:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userRole === UserRole.SUPER_ADMIN) {
      fetchVendors();
    }
  }, [fetchVendors, userRole]);

  const openDeleteModal = (vendor: VendorWithDetails) => {
    setVendorToDelete(vendor);
    setIsDeleteModalOpen(true);
    setActionError(null); // Resetuj grešku akcije pri otvaranju modala
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setVendorToDelete(null);
    setActionError(null);
  };

  const handleDeleteVendor = async () => {
    if (!vendorToDelete) return;

    setIsProcessing(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/vendors/${vendorToDelete.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Suspendovanje salona nije uspelo.' }));
        throw new Error(errorData.message || 'Suspendovanje salona nije uspelo.');
      }
      alert(`Salon "${vendorToDelete.name}" je uspešno suspendovan.`); // Razmisliti o boljem UX-u
      fetchVendors(); // Osveži listu salona
      closeDeleteModal();
    } catch (err) {
      const deleteErrorMsg = err instanceof Error ? err.message : 'Došlo je do nepoznate greške prilikom suspendovanja salona.';
      setActionError(deleteErrorMsg); // Prikazi grešku u modalu
      console.error("Greška pri suspendovanju salona:", err);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const statusTextMap: Record<VendorStatus, string> = {
    [VendorStatus.ACTIVE]: 'Aktivan',
    [VendorStatus.PENDING_APPROVAL]: 'Na čekanju',
    [VendorStatus.REJECTED]: 'Odbijen',
    [VendorStatus.SUSPENDED]: 'Suspendovan',
  };

  const statusColorMap: Record<VendorStatus, string> = {
    [VendorStatus.ACTIVE]: 'badge-success',
    [VendorStatus.PENDING_APPROVAL]: 'badge-warning',
    [VendorStatus.REJECTED]: 'badge-error',
    [VendorStatus.SUSPENDED]: 'badge-neutral', // Može i badge-error ili neka druga boja za suspendovan
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <span className="loading loading-lg loading-spinner text-primary"></span>
        <p className="ml-4 text-lg">Učitavanje salona...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="alert alert-error container mx-auto my-8">
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Greška pri učitavanju salona: {error}</span>
        <button className="btn btn-sm btn-ghost" onClick={fetchVendors}>Pokušaj ponovo</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">Upravljanje Salonima</h1>
        <Link href="/admin/vendors/new" className="btn btn-primary w-full sm:w-auto">
          <PlusCircle className="mr-2 h-5 w-5" /> Dodaj Novi Salon
        </Link>
      </div>

      {vendors.length === 0 ? (
        <div className="text-center py-10 card bg-base-100 shadow">
          <div className="card-body">
            <Store className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg">Trenutno nema kreiranih salona.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Možete dodati prvi salon koristeći dugme iznad.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full table-zebra shadow-lg">
            <thead>
              <tr className="text-base">
                <th>Naziv Salona</th>
                <th>Vlasnik</th>
                <th>Status</th>
                <th>Usluge</th>
                <th>Termini</th>
                <th>Kreiran</th>
                <th>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="hover">
                  <td>
                    <div className="font-bold">{vendor.name}</div>
                    <div className="text-xs opacity-70">{vendor.address || 'Adresa nije uneta'}</div>
                  </td>
                  <td>
                    {vendor.owner.firstName || ''} {vendor.owner.lastName || ''}
                    <br />
                    <span className="badge badge-ghost badge-sm">{vendor.owner.email}</span>
                  </td>
                  <td>
                    <span className={`badge ${statusColorMap[vendor.status] || 'badge-ghost'}`}>
                      {statusTextMap[vendor.status] || vendor.status}
                    </span>
                  </td>
                  <td className="text-center">{vendor._count.services}</td>
                  <td className="text-center">{vendor._count.appointments}</td>
                  <td>{new Date(vendor.createdAt).toLocaleDateString('sr-RS')}</td>
                  <td>
                    <div className="flex space-x-2">
                      <Link href={`/admin/vendors/edit/${vendor.id}`} className="btn btn-outline btn-primary btn-xs" title="Izmeni salon">
                        <Edit3 className="h-4 w-4" />
                      </Link>
                      <button 
                        onClick={() => openDeleteModal(vendor)} 
                        className="btn btn-outline btn-error btn-xs" 
                        title="Suspenduj salon"
                        disabled={vendor.status === VendorStatus.SUSPENDED || isProcessing} // Onemogući ako je već suspendovan ili se obrađuje
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal za potvrdu suspendovanja salona */}
      {isDeleteModalOpen && vendorToDelete && (
        <dialog open className="modal modal-bottom sm:modal-middle">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">Potvrda Suspendovanja Salona</h3>
            <button onClick={closeDeleteModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" disabled={isProcessing}>✕</button>
            <p className="py-4">
              Da li ste sigurni da želite da suspendujete salon "<strong>{vendorToDelete.name}</strong>"?
              Ova akcija će promeniti status salona u "Suspendovan" i može uticati na njegovu vidljivost i funkcionalnost.
            </p>
            {actionError && (
              <div role="alert" className="alert alert-error text-xs p-2 my-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{actionError}</span>
              </div>
            )}
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={closeDeleteModal} disabled={isProcessing}>
                Otkaži
              </button>
              <button 
                className="btn btn-error" 
                onClick={handleDeleteVendor} 
                disabled={isProcessing}
              >
                {isProcessing ? <span className="loading loading-spinner loading-xs"></span> : ''}
                Da, suspenduj salon
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={closeDeleteModal}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
