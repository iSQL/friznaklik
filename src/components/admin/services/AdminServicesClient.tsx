'use client';

import { useState, useEffect, useCallback } from 'react';
import ServiceList from './ServiceList';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { UserRole } from '@/lib/types/prisma-enums'; 

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  duration: number;
  vendorId: string;
  vendor?: { 
    id: string;
    name: string;
  };
  // Dodaj ostala polja po potrebi, npr. createdAt, updatedAt
}

interface AdminServicesClientProps {
  userRole: UserRole; 
}

export default function AdminServicesClient({ userRole }: AdminServicesClientProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/services');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Neuspešno preuzimanje usluga: ${response.statusText}` }));
        throw new Error(errorData.message || `Neuspešno preuzimanje usluga: ${response.statusText}`);
      }
      const data: Service[] = await response.json();
      setServices(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Došlo je do nepoznate greške prilikom preuzimanja usluga.';
      setError(errorMessage);
      console.error("Greška pri preuzimanju usluga:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Da li ste sigurni da želite da obrišete ovu uslugu? Ova akcija se ne može opozvati.')) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Brisanje usluge nije uspelo. Server nije pružio specifičnu poruku o grešci.' }));
        throw new Error(errorData.message || 'Brisanje usluge nije uspelo');
      }
      setServices(prevServices => prevServices.filter(service => service.id !== serviceId));
    } catch (err) {
      const deleteError = err instanceof Error ? err.message : 'Nije moguće obrisati uslugu zbog nepoznate greške.';
      setError(deleteError);
      console.error("Greška pri brisanju usluge:", err);
    }
  };

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <span className="loading loading-lg loading-spinner text-primary"></span>
            <p className="ml-4 text-lg">Učitavanje usluga...</p>
        </div>
    );
  }
  
  if (error) {
    return (
        <div role="alert" className="alert alert-error container mx-auto my-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Greška pri učitavanju usluga: {error}</span>
        </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">Upravljanje Uslugama</h1>
        <Link href="/admin/services/new" className="btn btn-primary w-full sm:w-auto">
          <PlusCircle className="mr-2 h-5 w-5" /> Dodaj Novu Uslugu
        </Link>
      </div>
      
      <ServiceList 
        services={services} 
        onDelete={handleDeleteService}
        userRole={userRole}
      />
    </div>
  );
}
