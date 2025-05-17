// src/components/admin/vendors/AdminVendorsClient.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PlusCircle, Store, Edit3, Trash2, AlertTriangle, Eye, Loader2 } from 'lucide-react'; // Added Eye icon and Loader2
import { VendorStatus, UserRole } from '@/lib/types/prisma-enums';


// Definicija tipa za Vendor objekat koji očekujemo od API-ja
export interface VendorWithDetails {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string; // This is Prisma User ID
  owner: {
    id: string; // Prisma User ID
    clerkId: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  address?: string | null;
  phoneNumber?: string | null;
  operatingHours?: any | null; // Consider a more specific type if possible
  status: VendorStatus;
  createdAt: string; // Should be Date or string, handle parsing if string
  updatedAt: string; // Should be Date or string
  _count: {
    services: number;
    appointments: number;
    // workers: number; // Add if you count workers
  };
}

interface AdminVendorsClientProps {
  userRole: UserRole; // Assuming SUPER_ADMIN for this component as per previous context
}

export default function AdminVendorsClient({ userRole }: AdminVendorsClientProps) {
  const [vendors, setVendors] = useState<VendorWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingVendorId, setProcessingVendorId] = useState<string | null>(null); // For specific row loading

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [vendorToAction, setVendorToAction] = useState<VendorWithDetails | null>(null);

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
    setVendorToAction(vendor);
    setIsDeleteModalOpen(true);
    setActionError(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setVendorToAction(null);
    setActionError(null);
  };

  const handleDeleteVendor = async () => {
    if (!vendorToAction) return;

    setIsProcessing(true);
    setProcessingVendorId(vendorToAction.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/vendors/${vendorToAction.id}`, {
        method: 'DELETE', // This API should change status to SUSPENDED
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Suspendovanje salona nije uspelo.' }));
        throw new Error(errorData.message || 'Suspendovanje salona nije uspelo.');
      }
      // alert(`Salon "${vendorToAction.name}" je uspešno suspendovan.`); // Consider toast
      fetchVendors();
      closeDeleteModal();
    } catch (err) {
      const deleteErrorMsg = err instanceof Error ? err.message : 'Došlo je do nepoznate greške prilikom suspendovanja salona.';
      setActionError(deleteErrorMsg);
    } finally {
      setIsProcessing(false);
      setProcessingVendorId(null);
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
    [VendorStatus.SUSPENDED]: 'badge-neutral opacity-70',
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-base-content/70">Učitavanje salona...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="alert alert-error container mx-auto my-8">
        <AlertTriangle className="h-6 w-6"/>
        <span>Greška pri učitavanju salona: {error}</span>
        <button className="btn btn-sm btn-ghost" onClick={fetchVendors}>Pokušaj ponovo</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-content">Upravljanje Salonima</h1>
        <Link href="/admin/vendors/new" className="btn btn-primary w-full sm:w-auto">
          <PlusCircle className="mr-2 h-5 w-5" /> Dodaj Novi Salon
        </Link>
      </div>

      {vendors.length === 0 ? (
        <div className="text-center py-10 card bg-base-100 shadow-md border border-base-300/50">
          <div className="card-body">
            <Store className="h-16 w-16 mx-auto text-base-content/40 mb-4" />
            <p className="text-base-content/70 text-lg">Trenutno nema kreiranih salona.</p>
            <p className="text-sm text-base-content/50">Možete dodati prvi salon koristeći dugme iznad.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-md border border-base-300/50">
          <table className="table w-full table-zebra bg-base-100">
            <thead className="bg-base-200">
              <tr className="text-base text-base-content">
                <th>Naziv Salona</th>
                <th>Vlasnik</th>
                <th>Status</th>
                <th>Usluge</th>
                <th>Termini</th>
                {/* <th>Radnici</th> */}
                <th>Kreiran</th>
                <th className="text-right">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-base-200/50 transition-colors">
                  <td>
                    <div className="font-bold text-base-content">{vendor.name}</div>
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
                  {/* <td className="text-center">{vendor._count.workers || 0}</td> */}
                  <td>{new Date(vendor.createdAt).toLocaleDateString('sr-RS')}</td>
                  <td className="text-right">
                    <div className="flex space-x-1 justify-end">
                       <Link href={`/admin/vendors/${vendor.id}`} className="btn btn-outline btn-info btn-xs" title="Detalji Salona">
                        <Eye size={16} />
                      </Link>
                      <Link href={`/admin/vendors/edit/${vendor.id}`} className="btn btn-outline btn-primary btn-xs" title="Izmeni Salon">
                        <Edit3 size={16} />
                      </Link>
                      <button
                        onClick={() => openDeleteModal(vendor)}
                        className="btn btn-outline btn-error btn-xs"
                        title="Suspenduj Salon"
                        disabled={(isProcessing && processingVendorId === vendor.id) || vendor.status === VendorStatus.SUSPENDED}
                      >
                        {isProcessing && processingVendorId === vendor.id ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isDeleteModalOpen && vendorToAction && (
        <dialog open className="modal modal-bottom sm:modal-middle modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">Potvrda Suspendovanja Salona</h3>
            <button onClick={closeDeleteModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" disabled={isProcessing}>✕</button>
            <p className="py-4">
              Da li ste sigurni da želite da suspendujete salon "<strong>{vendorToAction.name}</strong>"?
              Ova akcija će promeniti status salona u "Suspendovan".
            </p>
            {actionError && (
              <div role="alert" className="alert alert-warning text-xs p-2 my-2">
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
                {isProcessing && processingVendorId === vendorToAction.id ? <Loader2 size={16} className="animate-spin"/> : ''}
                Da, suspenduj salon
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={closeDeleteModal} disabled={isProcessing}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
