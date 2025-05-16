'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Vendor } from '@prisma/client';
import { UserRole } from '@/lib/types/prisma-enums';

import { Service } from './AdminServicesClient'; 

interface ServiceFormProps {
  initialData?: Service | null; 
  userRole: UserRole;
  ownedVendorId?: string | null; 
  allVendors?: Vendor[]; 
}

interface FormData {
  name: string;
  description: string;
  price: string; 
  duration: string; 
  vendorId?: string;
}

export default function ServiceForm({
  initialData,
  userRole,
  ownedVendorId,
  allVendors = [], 
}: ServiceFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    price: initialData?.price?.toString() || '',
    duration: initialData?.duration?.toString() || '',
    vendorId: (userRole === UserRole.SUPER_ADMIN && initialData) 
                ? initialData.vendorId 
                : (userRole === UserRole.SUPER_ADMIN && allVendors.length > 0) 
                    ? allVendors[0].id // Podrazumevani prvi salon za SUPER_ADMINA pri kreiranju
                    : ownedVendorId || '', // Za VENDOR_OWNER ili ako SUPER_ADMIN nema salona za izbor
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    if (userRole === UserRole.SUPER_ADMIN && !initialData && !ownedVendorId && !formData.vendorId && allVendors.length > 0) {
      setFormData(prev => ({ ...prev, vendorId: allVendors[0].id }));
    }
  }, [userRole, initialData, ownedVendorId, allVendors, formData.vendorId]);


  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {};
    if (!formData.name.trim()) errors.name = 'Naziv usluge je obavezan.';
    if (!formData.price.trim() || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      errors.price = 'Cena mora biti pozitivan broj.';
    }
    if (!formData.duration.trim() || isNaN(parseInt(formData.duration)) || parseInt(formData.duration) <= 0) {
      errors.duration = 'Trajanje mora biti pozitivan ceo broj (u minutima).';
    }
    if (userRole === UserRole.SUPER_ADMIN && !initialData && !formData.vendorId) {
      errors.vendorId = 'Morate odabrati salon za koji kreirate uslugu.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof FormData]) {
        setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    const method = initialData ? 'PUT' : 'POST';
    const url = initialData ? `/api/admin/services/${initialData.id}` : '/api/admin/services';

    const payload: any = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      duration: parseInt(formData.duration),
    };

    // Za VENDOR_OWNER, vendorId je implicitno njegov ownedVendorId
    // Za SUPER_ADMINA, vendorId se uzima iz forme
    if (userRole === UserRole.VENDOR_OWNER && ownedVendorId) {
      payload.vendorId = ownedVendorId;
    } else if (userRole === UserRole.SUPER_ADMIN) {
      if (initialData) { 
        payload.vendorId = initialData.vendorId;
      } else {
        payload.vendorId = formData.vendorId;
      }
    }
    
    if (!payload.vendorId && method === 'POST') {
        setError('Salon (Vendor ID) nije specificiran. Ovo se ne bi smelo dogoditi.');
        setIsLoading(false);
        return;
    }


    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Došlo je do greške na serveru.' }));
        throw new Error(errorData.message || `Neuspešno ${initialData ? 'ažuriranje' : 'kreiranje'} usluge.`);
      }

      alert(`Usluga uspešno ${initialData ? 'ažurirana' : 'kreirana'}!`); // Razmisliti o boljem UX-u od alert-a
      router.push('/admin/services'); 
      router.refresh(); 

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Došlo je do nepoznate greške.';
      setError(errorMessage);
      console.error("Greška pri slanju forme:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4 md:p-6 lg:p-8 bg-base-100 shadow-xl rounded-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center text-gray-800 dark:text-gray-100">
        {initialData ? 'Izmena Usluge' : 'Kreiranje Nove Usluge'}
      </h2>

      {error && (
        <div role="alert" className="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>Greška: {error}</span>
        </div>
      )}

      {/* Polje za odabir salona - samo za SUPER_ADMINA pri kreiranju nove usluge */}
      {userRole === UserRole.SUPER_ADMIN && !initialData && (
        <div className="form-control w-full">
          <label htmlFor="vendorId" className="label">
            <span className="label-text text-base font-medium text-gray-700 dark:text-gray-300">Salon (Vendor)</span>
          </label>
          <select
            id="vendorId"
            name="vendorId"
            value={formData.vendorId}
            onChange={handleChange}
            className={`select select-bordered w-full ${formErrors.vendorId ? 'select-error' : ''}`}
            disabled={isLoading || allVendors.length === 0}
          >
            <option value="" disabled>Odaberite salon</option>
            {allVendors.map(vendor => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name} (ID: {vendor.id})
              </option>
            ))}
          </select>
          {formErrors.vendorId && <span className="text-error text-xs mt-1">{formErrors.vendorId}</span>}
          {allVendors.length === 0 && <span className="text-warning text-xs mt-1">Nema dostupnih salona za odabir.</span>}
        </div>
      )}
      
      {userRole === UserRole.SUPER_ADMIN && initialData && initialData.vendorId && (
        <div className="form-control w-full">
            <label className="label">
                <span className="label-text text-base font-medium text-gray-700 dark:text-gray-300">Salon (Vendor)</span>
            </label>
            <input 
                type="text" 
                value={allVendors.find(v => v.id === initialData.vendorId)?.name || initialData.vendorId} 
                className="input input-bordered w-full" 
                readOnly 
            />
            <p className="text-xs text-gray-500 mt-1">Salon se ne može menjati kroz ovu formu.</p>
        </div>
      )}


      <div className="form-control w-full">
        <label htmlFor="name" className="label">
          <span className="label-text text-base font-medium text-gray-700 dark:text-gray-300">Naziv Usluge</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Npr. Muško šišanje"
          className={`input input-bordered w-full ${formErrors.name ? 'input-error' : ''}`}
          disabled={isLoading}
        />
        {formErrors.name && <span className="text-error text-xs mt-1">{formErrors.name}</span>}
      </div>

      <div className="form-control w-full">
        <label htmlFor="description" className="label">
          <span className="label-text text-base font-medium text-gray-700 dark:text-gray-300">Opis (opciono)</span>
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Unesite detaljniji opis usluge..."
          className="textarea textarea-bordered w-full h-24"
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-control w-full">
          <label htmlFor="price" className="label">
            <span className="label-text text-base font-medium text-gray-700 dark:text-gray-300">Cena (RSD)</span>
          </label>
          <input
            type="number"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleChange}
            placeholder="Npr. 1500"
            min="0"
            step="any"
            className={`input input-bordered w-full ${formErrors.price ? 'input-error' : ''}`}
            disabled={isLoading}
          />
          {formErrors.price && <span className="text-error text-xs mt-1">{formErrors.price}</span>}
        </div>

        <div className="form-control w-full">
          <label htmlFor="duration" className="label">
            <span className="label-text text-base font-medium text-gray-700 dark:text-gray-300">Trajanje (minuti)</span>
          </label>
          <input
            type="number"
            id="duration"
            name="duration"
            value={formData.duration}
            onChange={handleChange}
            placeholder="Npr. 30"
            min="0"
            step="1"
            className={`input input-bordered w-full ${formErrors.duration ? 'input-error' : ''}`}
            disabled={isLoading}
          />
          {formErrors.duration && <span className="text-error text-xs mt-1">{formErrors.duration}</span>}
        </div>
      </div>
      
      <div className="flex justify-end space-x-3 pt-4">
        <button 
            type="button" 
            onClick={() => router.back()} 
            className="btn btn-ghost"
            disabled={isLoading}
        >
          Otkaži
        </button>
        <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="loading loading-spinner loading-xs"></span>
              {initialData ? 'Ažuriram...' : 'Kreiram...'}
            </>
          ) : (
            initialData ? 'Sačuvaj Izmene' : 'Kreiraj Uslugu'
          )}
        </button>
      </div>
    </form>
  );
}
