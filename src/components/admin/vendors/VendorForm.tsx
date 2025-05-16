// src/components/admin/vendors/VendorForm.tsx
'use client';

import { useState, FormEvent, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {  Vendor } from '@prisma/client'; 
import { UserRole } from '@/lib/types/prisma-enums'; // UserRole za filtriranje


import { Info } from 'lucide-react';


// Tip za BasicUser koji API /api/admin/users vraća i koji forma koristi
interface BasicUser {
    id: string; // Prisma User ID
    clerkId: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    role: UserRole; // Uloga korisnika
    profileImageUrl?: string | null;
}

// Tip za podatke koje forma prikuplja
interface VendorFormData {
  name: string;
  description: string;
  ownerClerkId: string; // Clerk ID korisnika koji će biti vlasnik
  address: string;
  phoneNumber: string;
  // operatingHours: string;
}

// Tip koji ova forma očekuje za initialData prop
// To je Vendor tip iz Prisma, sa opcionim owner objektom tipa BasicUser
type VendorFormInitialData = Vendor & {
    owner?: BasicUser; // Vlasnik je sada BasicUser tip
};

interface VendorFormProps {
  initialData?: VendorFormInitialData | null;
}

export default function VendorForm({ initialData }: VendorFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<VendorFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    ownerClerkId: initialData?.owner?.clerkId || '',
    address: initialData?.address || '',
    phoneNumber: initialData?.phoneNumber || '',
    // operatingHours: initialData?.operatingHours ? JSON.stringify(initialData.operatingHours, null, 2) : '',
  });

  const [suggestedUsers, setSuggestedUsers] = useState<BasicUser[]>([]);
  const [ownerSearchTerm, setOwnerSearchTerm] = useState(initialData?.owner?.email || '');
  const [selectedOwner, setSelectedOwner] = useState<BasicUser | null>(initialData?.owner || null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof VendorFormData, string>>>({});

  // Dobavljanje korisnika za odabir vlasnika preko API rute
  const fetchUsers = useCallback(async (searchTerm: string) => {
    if (searchTerm.length < 2) { // Ne pretražuj za manje od 2 karaktera
        setSuggestedUsers([]);
        return;
    }
    setIsSearchingUsers(true);
    try {
      // Pretražujemo samo korisnike sa ulogom USER, jer oni mogu postati VENDOR_OWNER
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(searchTerm)}&role=${UserRole.USER}&limit=5`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Neuspešno dobavljanje korisnika.');
      }
      const data: { users: BasicUser[] } = await response.json();
      setSuggestedUsers(data.users || []);
    } catch (err) {
      console.error("Greška pri dobavljanju korisnika:", err);
      setSuggestedUsers([]);
      // Možete postaviti i neku grešku za prikaz korisniku ako je potrebno
    } finally {
      setIsSearchingUsers(false);
    }
  }, []);
  
  useEffect(() => {
    // Ako imamo initialData i vlasnika, popuni searchTerm i selectedOwner
    if (initialData?.owner) {
        setOwnerSearchTerm(initialData.owner.email); // Ili neko drugo polje za prikaz
        setSelectedOwner(initialData.owner);
        setFormData(prev => ({ ...prev, ownerClerkId: initialData.owner!.clerkId }));
    }
  }, [initialData]);

  useEffect(() => {
    // Ne pokreći pretragu ako je vlasnik već odabran i searchTerm odgovara emailu odabranog vlasnika
    // ili ako je forma za izmenu i vlasnik je već postavljen iz initialData
    if (selectedOwner && ownerSearchTerm === selectedOwner.email) {
        setSuggestedUsers([]); // Sakrij predloge ako je vlasnik već odabran i potvrđen
        return;
    }
    if (initialData && ownerSearchTerm === initialData.owner?.email) {
        setSuggestedUsers([]);
        return;
    }

    const debounceTimeout = setTimeout(() => {
        fetchUsers(ownerSearchTerm);
    }, 500); // Debounce od 500ms

    return () => clearTimeout(debounceTimeout);
  }, [ownerSearchTerm, fetchUsers, selectedOwner, initialData]);


  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof VendorFormData, string>> = {};
    if (!formData.name.trim()) errors.name = 'Naziv salona je obavezan.';
    if (!selectedOwner && !formData.ownerClerkId.trim()) {
        errors.ownerClerkId = 'Vlasnik salona mora biti odabran.';
    } else if (!selectedOwner && formData.ownerClerkId.trim() && suggestedUsers.length === 0 && !isSearchingUsers) {
        // Ako je unet Clerk ID ručno, a nema predloga i nije u toku pretraga,
        // ovo može biti validno ako SUPER_ADMIN zna tačan Clerk ID.
        // Za sada, zahtevamo odabir sa liste ako nije initialData.
        if (!initialData) errors.ownerClerkId = 'Molimo odaberite vlasnika sa liste predloga.';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof VendorFormData]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleOwnerSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOwnerSearchTerm(e.target.value);
    setSelectedOwner(null); // Resetuj odabranog vlasnika kada se pretraga menja
    setFormData(prev => ({ ...prev, ownerClerkId: '' }));
    if (formErrors.ownerClerkId) {
        setFormErrors(prev => ({ ...prev, ownerClerkId: undefined }));
    }
  };

  const handleSelectOwner = (user: BasicUser) => {
    setSelectedOwner(user);
    setOwnerSearchTerm(user.email); // Postavi email u input polje radi prikaza
    setFormData(prev => ({ ...prev, ownerClerkId: user.clerkId })); // Postavi Clerk ID u formu
    setSuggestedUsers([]); // Sakrij listu predloga
    if (formErrors.ownerClerkId) {
        setFormErrors(prev => ({ ...prev, ownerClerkId: undefined }));
    }
  };


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    const method = initialData ? 'PUT' : 'POST';
    const url = initialData ? `/api/admin/vendors/${initialData.id}` : '/api/admin/vendors';

    const payload = {
      name: formData.name,
      description: formData.description || null,
      ownerId: selectedOwner ? selectedOwner.clerkId : formData.ownerClerkId, // Clerk ID vlasnika
      address: formData.address || null,
      phoneNumber: formData.phoneNumber || null,
      // operatingHours: formData.operatingHours ? JSON.parse(formData.operatingHours) : null,
      // Status se postavlja na API ruti za kreiranje, a može se menjati na PUT ruti
      ...(method === 'PUT' && initialData?.status && { status: initialData.status }) // Primer ako želimo da prosledimo status pri izmeni
    };
    
    if (!payload.ownerId) {
        setError("ID vlasnika nije ispravno postavljen. Molimo odaberite vlasnika.");
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
        throw new Error(errorData.message || `Neuspešno ${initialData ? 'ažuriranje' : 'kreiranje'} salona.`);
      }
      
      router.push('/admin/vendors');
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
        {initialData ? 'Izmena Salona' : 'Kreiranje Novog Salona'}
      </h2>

      {error && (
        <div role="alert" className="alert alert-error">
          <Info className="h-5 w-5" /> <span>Greška: {error}</span>
        </div>
      )}

      <div className="form-control w-full">
        <label htmlFor="name" className="label">
          <span className="label-text text-base font-medium">Naziv Salona</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Unesite naziv salona"
          className={`input input-bordered w-full ${formErrors.name ? 'input-error' : ''}`}
          disabled={isLoading}
        />
        {formErrors.name && <span className="text-error text-xs mt-1">{formErrors.name}</span>}
      </div>

      <div className="form-control w-full relative">
        <label htmlFor="ownerSearchTerm" className="label">
          <span className="label-text text-base font-medium">Vlasnik Salona (Email ili Ime)</span>
        </label>
        <input
          type="text"
          id="ownerSearchTerm"
          name="ownerSearchTerm"
          value={ownerSearchTerm}
          onChange={handleOwnerSearchChange}
          placeholder="Pretražite korisnika (min. 2 karaktera)..."
          className={`input input-bordered w-full ${formErrors.ownerClerkId ? 'input-error' : ''}`}
          disabled={isLoading || !!initialData} // Onemogući promenu vlasnika pri izmeni
          autoComplete="off"
        />
        {initialData && <p className="text-xs text-gray-500 mt-1">Vlasnik se ne može menjati nakon kreiranja salona putem ove forme.</p>}
        {formErrors.ownerClerkId && <span className="text-error text-xs mt-1">{formErrors.ownerClerkId}</span>}
        
        {isSearchingUsers && (
            <span className="loading loading-sm loading-spinner text-primary absolute right-3 top-12"></span>
        )}
        {suggestedUsers.length > 0 && !selectedOwner && (
          <ul className="absolute z-10 w-full bg-base-100 border border-base-300 rounded-md mt-1 shadow-lg max-h-60 overflow-y-auto">
            {suggestedUsers.map(user => (
              <li 
                key={user.id} 
                onClick={() => handleSelectOwner(user)}
                className="px-4 py-2 hover:bg-base-200 cursor-pointer"
              >
                {user.firstName || ''} {user.lastName || ''} ({user.email}) - {user.role}
                {user.profileImageUrl && <img src={user.profileImageUrl} alt="profilna" className="w-6 h-6 rounded-full inline-block ml-2"/>}
              </li>
            ))}
          </ul>
        )}
        {selectedOwner && ( // Prikaz odabranog vlasnika, čak i ako je initialData
             <div className="mt-2 p-2 border border-success rounded-md bg-success/10">
                <p className="text-sm text-success-content">
                    Odabran vlasnik: {selectedOwner.firstName || ''} {selectedOwner.lastName || ''} ({selectedOwner.email})
                </p>
             </div>
        )}
      </div>

      <div className="form-control w-full">
        <label htmlFor="description" className="label">
          <span className="label-text text-base font-medium">Opis (opciono)</span>
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Unesite opis salona..."
          className="textarea textarea-bordered w-full h-24"
          disabled={isLoading}
        />
      </div>

      <div className="form-control w-full">
        <label htmlFor="address" className="label">
          <span className="label-text text-base font-medium">Adresa (opciono)</span>
        </label>
        <input
          type="text"
          id="address"
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="Npr. Glavna ulica 123, Beograd"
          className="input input-bordered w-full"
          disabled={isLoading}
        />
      </div>
      
      <div className="form-control w-full">
        <label htmlFor="phoneNumber" className="label">
          <span className="label-text text-base font-medium">Broj Telefona (opciono)</span>
        </label>
        <input
          type="tel"
          id="phoneNumber"
          name="phoneNumber"
          value={formData.phoneNumber}
          onChange={handleChange}
          placeholder="Npr. 0601234567"
          className="input input-bordered w-full"
          disabled={isLoading}
        />
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
            disabled={isLoading || (ownerSearchTerm.length > 0 && suggestedUsers.length > 0 && !selectedOwner && !initialData)}
        >
          {isLoading ? (
            <>
              <span className="loading loading-spinner loading-xs"></span>
              {initialData ? 'Ažuriram...' : 'Kreiram...'}
            </>
          ) : (
            initialData ? 'Sačuvaj Izmene Salona' : 'Kreiraj Salon'
          )}
        </button>
      </div>
    </form>
  );
}
