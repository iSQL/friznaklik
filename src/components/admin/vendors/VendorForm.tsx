'use client';

import { useState, FormEvent, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image'; 
import { Vendor, Prisma } from '@prisma/client';
import { UserRole, VendorStatus } from '@/lib/types/prisma-enums';
import { Info, Loader2, Clock } from 'lucide-react';
import { z } from 'zod';

interface DailyOperatingHours {
  open: string | null;
  close: string | null;
  isClosed: boolean;
}

type FormOperatingHours = {
  [key in 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday']: DailyOperatingHours;
};

interface BasicUser {
    id: string;
    clerkId: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    role: UserRole;
    profileImageUrl?: string | null;
}

interface VendorFormData {
  name: string;
  description: string;
  ownerClerkId: string;
  address: string;
  phoneNumber: string;
  operatingHours: FormOperatingHours;
}

type VendorFormInitialData = Omit<Vendor, 'operatingHours' | 'status'> & {
    operatingHours?: Prisma.JsonValue | null;
    status: VendorStatus; 
    owner?: BasicUser;
};

interface VendorFormProps {
  initialData?: VendorFormInitialData | null;
  currentUserRole: UserRole;
  allVendors?: Vendor[];
}

// Define a more specific type for the API payload
interface VendorApiPayload {
  name: string;
  description?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  operatingHours?: Prisma.InputJsonValue;
  status?: VendorStatus;
  ownerId?: string; // Clerk ID of the owner for creation
}


const daysOfWeek = [
  { key: 'monday', label: 'Ponedeljak' },
  { key: 'tuesday', label: 'Utorak' },
  { key: 'wednesday', label: 'Sreda' },
  { key: 'thursday', label: 'Četvrtak' },
  { key: 'friday', label: 'Petak' },
  { key: 'saturday', label: 'Subota' },
  { key: 'sunday', label: 'Nedelja' },
] as const;

const timeFormatRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dailyHoursSchemaForValidation = z.object({
    open: z.string().regex(timeFormatRegex, "Format vremena mora biti HH:mm").optional().nullable(),
    close: z.string().regex(timeFormatRegex, "Format vremena mora biti HH:mm").optional().nullable(),
    isClosed: z.boolean().optional(),
}).refine(data => {
    if (data && !data.isClosed && (data.open && data.close)) {
        const [openHour, openMinute] = data.open.split(':').map(Number);
        const [closeHour, closeMinute] = data.close.split(':').map(Number);
        if (openHour > closeHour || (openHour === closeHour && openMinute >= closeMinute)) {
            return false;
        }
    }
    return true;
}, {
    message: "Krajnje vreme mora biti nakon početnog vremena.",
    path: ['close'],
});


export default function VendorForm({ initialData, currentUserRole, allVendors = [] }: VendorFormProps) {
  const router = useRouter();
  console.log("[VendorForm] Initialized. Props - currentUserRole:", currentUserRole, "initialData exists:", !!initialData, "allVendors count:", allVendors.length);


  const initialFormOperatingHours = useCallback((): FormOperatingHours => {
    const defaultOpenTime = '09:00';
    const defaultCloseTime = '17:00';
    const hours = {} as FormOperatingHours;

    daysOfWeek.forEach(day => {
        let daySpecificHours: DailyOperatingHours = { open: defaultOpenTime, close: defaultCloseTime, isClosed: false };

        if (initialData?.operatingHours && typeof initialData.operatingHours === 'object' && initialData.operatingHours !== null) {
            const dbDayData = (initialData.operatingHours as Record<string, Partial<DailyOperatingHours> & {isClosed?: boolean} | null>)[day.key];

            if (dbDayData === null || (dbDayData && dbDayData.isClosed === true)) {
                daySpecificHours = { open: null, close: null, isClosed: true };
            } else if (dbDayData) {
                daySpecificHours = {
                    open: dbDayData.open || defaultOpenTime,
                    close: dbDayData.close || defaultCloseTime,
                    isClosed: dbDayData.isClosed ?? false,
                };
            }
        }
        hours[day.key] = daySpecificHours;
    });
    return hours;
  }, [initialData?.operatingHours]);

  const [formData, setFormData] = useState<VendorFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    ownerClerkId: initialData?.owner?.clerkId || '',
    address: initialData?.address || '',
    phoneNumber: initialData?.phoneNumber || '',
    operatingHours: initialFormOperatingHours(),
  });

  const [suggestedUsers, setSuggestedUsers] = useState<BasicUser[]>([]);
  const [ownerSearchTerm, setOwnerSearchTerm] = useState(initialData?.owner?.email || '');
  const [selectedOwner, setSelectedOwner] = useState<BasicUser | null>(initialData?.owner || null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof VendorFormData | string, string>>>({});


  const fetchUsers = useCallback(async (searchTerm: string) => {
    console.log(`[VendorForm] fetchUsers called with searchTerm: "${searchTerm}"`);
    if (searchTerm.length < 2 && currentUserRole === UserRole.SUPER_ADMIN && !initialData) {
        setSuggestedUsers([]);
        console.log("[VendorForm] Search term too short for SUPER_ADMIN creating new, clearing suggestions.");
        return;
    }
    setIsSearchingUsers(true);
    setSuggestedUsers([]);
    try {
      const apiUrl = `/api/admin/users?search=${encodeURIComponent(searchTerm)}&role=${UserRole.USER}&limit=5`;
      const response = await fetch(apiUrl);
      const responseBody = await response.text();
      console.log(`[VendorForm] fetchUsers - API URL: ${apiUrl}, Status: ${response.status}, Body: ${responseBody}`);

      if (!response.ok) {
        let errMessage = `Neuspešno dobavljanje korisnika. Status: ${response.status}`;
        try { const errData = JSON.parse(responseBody); errMessage = errData.message || errMessage; }
        catch { console.warn("[VendorForm] API error response was not valid JSON."); }
        throw new Error(errMessage);
      }

      const data = JSON.parse(responseBody) as { users: BasicUser[] };
      setSuggestedUsers(data.users || []);
      if (!data.users || data.users.length === 0) console.log("[VendorForm] No users found for the search term.");

    } catch (err) {
      console.error("[VendorForm] Greška pri dobavljanju korisnika:", err);
      setSuggestedUsers([]);
    } finally {
      setIsSearchingUsers(false);
      console.log("[VendorForm] fetchUsers finished.");
    }
  }, [currentUserRole, initialData]);

  useEffect(() => {
    if (initialData?.owner) {
        setOwnerSearchTerm(initialData.owner.email);
        setSelectedOwner(initialData.owner);
        setFormData(prev => ({ ...prev, ownerClerkId: initialData.owner!.clerkId }));
    }
    setFormData(prev => ({ ...prev, operatingHours: initialFormOperatingHours() }));
  }, [initialData, initialFormOperatingHours]);

  useEffect(() => {
    if (selectedOwner && ownerSearchTerm === selectedOwner.email) {
        setSuggestedUsers([]);
        return;
    }
    if (initialData && ownerSearchTerm === initialData.owner?.email) {
        setSuggestedUsers([]);
        return;
    }

    const shouldFetch = currentUserRole === UserRole.SUPER_ADMIN && !initialData && ownerSearchTerm.trim().length >= 2;
    console.log(`[VendorForm] useEffect for ownerSearchTerm - shouldFetch: ${shouldFetch}, ownerSearchTerm: "${ownerSearchTerm}"`);


    const debounceTimeout = setTimeout(() => {
        if (shouldFetch) {
            fetchUsers(ownerSearchTerm);
        } else if (currentUserRole === UserRole.SUPER_ADMIN && !initialData) {
            setSuggestedUsers([]);
        }
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [ownerSearchTerm, fetchUsers, selectedOwner, initialData, currentUserRole]);


  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof VendorFormData | string, string>> = {};
    if (!formData.name.trim()) errors.name = 'Naziv salona je obavezan.';

    console.log("[VendorForm] validateForm - Checking owner. currentUserRole:", currentUserRole, "initialData:", !!initialData, "selectedOwner:", !!selectedOwner, "ownerSearchTerm:", `"${ownerSearchTerm.trim()}"`, "isSearchingUsers:", isSearchingUsers, "suggestedUsers.length:", suggestedUsers.length);

    if (currentUserRole === UserRole.SUPER_ADMIN && !initialData) {
      if (!selectedOwner) {
        console.log("[VendorForm] validateForm - SUPER_ADMIN creating new, selectedOwner is NULL.");
        if (ownerSearchTerm.trim() === '') {
          console.log("[VendorForm] validateForm - ownerSearchTerm is empty. Setting error: Vlasnik salona je obavezan.");
          errors.ownerClerkId = 'Vlasnik salona je obavezan.';
        } else if (isSearchingUsers) {
          console.log("[VendorForm] validateForm - isSearchingUsers is true. Setting error: Pretraga korisnika je u toku...");
          errors.ownerClerkId = 'Pretraga korisnika je u toku, molimo sačekajte.';
        } else if (suggestedUsers.length > 0) {
            console.log("[VendorForm] validateForm - suggestions available but none selected. Setting error: Molimo odaberite vlasnika...");
            errors.ownerClerkId = 'Molimo odaberite vlasnika sa liste predloga.';
        } else {
          console.log("[VendorForm] validateForm - no suggestions and not searching. Setting error for not found/role.");
          errors.ownerClerkId = 'Korisnik sa unetim emailom nije pronađen ili nema odgovarajuću ulogu (USER).';
        }
      } else {
        console.log("[VendorForm] validateForm - SUPER_ADMIN creating new, selectedOwner IS SET. No owner error.");
      }
    }

    daysOfWeek.forEach(day => {
        const dayKey = day.key;
        const hours = formData.operatingHours[dayKey];
        if (!hours.isClosed && (!hours.open || !hours.close)) {
            errors[`operatingHours.${dayKey}`] = `Molimo unesite vreme otvaranja i zatvaranja za ${day.label} ili označite kao zatvoren.`;
        } else if (!hours.isClosed && hours.open && hours.close) {
            const validationResult = dailyHoursSchemaForValidation.safeParse(hours);
            if (!validationResult.success) {
                 errors[`operatingHours.${dayKey}`] = validationResult.error.errors[0]?.message || `Neispravno vreme za ${day.label}.`;
            }
        }
    });

    console.log("[VendorForm] validateForm - currentFormErrors before setFormErrors:", JSON.stringify(errors));
    setFormErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    console.log("[VendorForm] validateForm - returning:", isValid, "Errors object after set:", JSON.stringify(errors));
    return isValid;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof VendorFormData]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleOperatingHoursChange = (
    dayKey: keyof FormOperatingHours,
    field: keyof DailyOperatingHours,
    value: string | boolean
  ) => {
    setFormData(prev => {
        const newOperatingHours = { ...prev.operatingHours };
        const currentDayHours = { ...newOperatingHours[dayKey] };
        let updatedDayHours: DailyOperatingHours;

        if (field === 'isClosed') {
            if (typeof value === 'boolean') {
                updatedDayHours = {
                    ...currentDayHours,
                    isClosed: value,
                    open: value ? null : (currentDayHours.open || '09:00'),
                    close: value ? null : (currentDayHours.close || '17:00'),
                };
            } else {
                updatedDayHours = currentDayHours;
            }
        } else if ((field === 'open' || field === 'close') && typeof value === 'string') {
            updatedDayHours = {
                ...currentDayHours,
                [field]: value,
            };
        } else {
            updatedDayHours = currentDayHours;
        }

        newOperatingHours[dayKey] = updatedDayHours;
        return { ...prev, operatingHours: newOperatingHours };
    });

    if (formErrors[`operatingHours.${dayKey}`]) {
        setFormErrors(prev => ({ ...prev, [`operatingHours.${dayKey}`]: undefined }));
    }
  };


  const handleOwnerSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOwnerSearchTerm(e.target.value);
    setSelectedOwner(null);
    setFormData(prev => ({ ...prev, ownerClerkId: '' }));
    if (formErrors.ownerClerkId) {
        setFormErrors(prev => ({ ...prev, ownerClerkId: undefined }));
    }
  };

  const handleSelectOwner = (user: BasicUser) => {
    setSelectedOwner(user);
    setOwnerSearchTerm(user.email);
    setFormData(prev => ({ ...prev, ownerClerkId: user.clerkId }));
    setSuggestedUsers([]);
    if (formErrors.ownerClerkId) {
        setFormErrors(prev => ({ ...prev, ownerClerkId: undefined }));
    }
  };


  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const isFormValid = validateForm();
    console.log("[VendorForm] handleSubmit - isFormValid from validateForm():", isFormValid);

    if (!isFormValid) {
      console.log("[VendorForm] Form is NOT valid based on validateForm(), returning. Current formErrors:", JSON.stringify(formErrors));
      return;
    }

    setIsLoading(true);
    setError(null);

    const method = initialData ? 'PUT' : 'POST';
    const url = initialData ? `/api/admin/vendors/${initialData.id}` : '/api/admin/vendors';

    const operatingHoursPayload: Record<string, { open: string | null; close: string | null, isClosed: boolean } | null> = {};
    daysOfWeek.forEach(day => {
      const dayData = formData.operatingHours[day.key];
      if (dayData.isClosed) {
        operatingHoursPayload[day.key] = { open: null, close: null, isClosed: true };
      } else if (dayData.open && dayData.close) {
        operatingHoursPayload[day.key] = { open: dayData.open, close: dayData.close, isClosed: false };
      } else {
        operatingHoursPayload[day.key] = { open: null, close: null, isClosed: true };
      }
    });

    const payload: VendorApiPayload = {
      name: formData.name,
      description: formData.description || null,
      address: formData.address || null,
      phoneNumber: formData.phoneNumber || null,
      operatingHours: operatingHoursPayload as Prisma.JsonObject, // Cast to Prisma.JsonObject
      ...(method === 'PUT' && initialData?.status && { status: initialData.status })
    };

    if (method === 'POST' && currentUserRole === UserRole.SUPER_ADMIN) {
        if (selectedOwner && selectedOwner.clerkId) {
            payload.ownerId = selectedOwner.clerkId; // This is the Clerk ID
        } else {
            console.error("[VendorForm] handleSubmit: CRITICAL - selectedOwner is null or has no clerkId when creating a new vendor as SUPER_ADMIN. ValidateForm should have caught this.");
            setError("Kritična greška: Vlasnik nije ispravno odabran ili nema validan ID. Molimo osvežite i pokušajte ponovo.");
            setIsLoading(false);
            return;
        }
    }

    console.log("[VendorForm] Submitting payload:", JSON.stringify(payload, null, 2));

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log(`[VendorForm] API Response for ${method} ${url}: ${response.status}`, responseText);


      if (!response.ok) {
        let errorData = { message: `Neuspešno ${initialData ? 'ažuriranje' : 'kreiranje'} salona. Status: ${response.status}` };
        try {
            errorData = JSON.parse(responseText);
        } catch {
            errorData.message = responseText || errorData.message;
        }
        throw new Error(errorData.message || `Neuspešno ${initialData ? 'ažuriranje' : 'kreiranje'} salona.`);
      }

      router.push(currentUserRole === UserRole.SUPER_ADMIN ? '/admin/vendors' : '/admin');
      router.refresh();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Došlo je do nepoznate greške.';
      setError(errorMessage);
      console.error("[VendorForm] Greška pri slanju forme:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const showOwnerSelection = currentUserRole === UserRole.SUPER_ADMIN && !initialData;
  console.log("[VendorForm] Render - showOwnerSelection:", showOwnerSelection);


  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4 md:p-6 lg:p-8 bg-base-100 shadow-xl rounded-lg max-w-3xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center text-neutral-content">
        {initialData ? 'Izmena Podataka Salona' : 'Kreiranje Novog Salona'}
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

      {showOwnerSelection && (
        <div className="form-control w-full relative">
          <label htmlFor="ownerSearchTerm" className="label">
            <span className="label-text text-base font-medium">Vlasnik Salona (Email ili Ime)</span>
          </label>
          <div className="relative">
              <input
              type="text"
              id="ownerSearchTerm"
              name="ownerSearchTerm"
              value={ownerSearchTerm}
              onChange={handleOwnerSearchChange}
              placeholder="Pretražite korisnika (min. 2 karaktera)..."
              className={`input input-bordered w-full ${formErrors.ownerClerkId ? 'input-error' : ''}`}
              disabled={isLoading}
              autoComplete="off"
              />
              {isSearchingUsers && (
                  <span className="loading loading-sm loading-spinner text-primary absolute right-3 top-1/2 -translate-y-1/2"></span>
              )}
          </div>
          {formErrors.ownerClerkId && <span className="text-error text-xs mt-1">{formErrors.ownerClerkId}</span>}

          {suggestedUsers.length > 0 && !selectedOwner && (
            <ul className="absolute z-10 w-full bg-base-100 border border-base-300 rounded-md mt-1 shadow-lg max-h-60 overflow-y-auto">
              {suggestedUsers.map(user => (
                <li
                  key={user.id}
                  onClick={() => handleSelectOwner(user)}
                  className="px-4 py-2 hover:bg-base-200 cursor-pointer flex items-center gap-2"
                >
                  {user.profileImageUrl &&
                    <Image
                        src={user.profileImageUrl}
                        alt="profilna"
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-full"
                    />
                  }
                  <span>{user.firstName || ''} {user.lastName || ''} ({user.email}) - <span className="text-xs opacity-70">{user.role}</span></span>
                </li>
              ))}
            </ul>
          )}
          {selectedOwner && (
               <div className="mt-2 p-2 border border-success rounded-md bg-success/10">
                  <p className="text-sm text-success-content">
                      Odabran vlasnik: {selectedOwner.firstName || ''} {selectedOwner.lastName || ''} ({selectedOwner.email})
                  </p>
               </div>
          )}
        </div>
      )}
      {(initialData && initialData.owner) && (
         <div className="form-control w-full">
            <label className="label"><span className="label-text text-base font-medium">Vlasnik Salona</span></label>
            <input type="text" value={`${initialData.owner.firstName || ''} ${initialData.owner.lastName || ''} (${initialData.owner.email})`} className="input input-bordered w-full" disabled />
            {currentUserRole === UserRole.SUPER_ADMIN && <p className="text-xs text-base-content/70 mt-1">Vlasnik se ne može menjati nakon kreiranja salona putem ove forme.</p>}
         </div>
      )}


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

      <div className="space-y-4 p-4 border border-base-300 rounded-lg bg-base-100/30">
          <h3 className="text-lg font-semibold text-primary flex items-center"><Clock size={20} className="mr-2"/> Radno Vreme Salona</h3>
          {daysOfWeek.map(day => (
            <div key={day.key} className="grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-2 items-center">
                <label className="md:col-span-3 label py-0">
                    <span className="label-text font-medium">{day.label}</span>
                </label>
                <div className="md:col-span-2 form-control">
                    <label className="cursor-pointer label justify-start gap-2 py-0">
                        <input
                        type="checkbox"
                        className="toggle toggle-error toggle-sm"
                        checked={formData.operatingHours[day.key].isClosed}
                        onChange={(e) => handleOperatingHoursChange(day.key, 'isClosed', e.target.checked)}
                        disabled={isLoading}
                        />
                        <span className="label-text text-xs">Zatvoren</span>
                    </label>
                </div>
                <div className="md:col-span-3 form-control">
                    <input
                        type="time"
                        className={`input input-bordered input-sm w-full ${formData.operatingHours[day.key].isClosed ? 'input-disabled' : ''} ${formErrors[`operatingHours.${day.key}`] ? 'input-error' : ''}`}
                        value={formData.operatingHours[day.key].open ?? ''}
                        onChange={(e) => handleOperatingHoursChange(day.key, 'open', e.target.value)}
                        disabled={isLoading || formData.operatingHours[day.key].isClosed}
                    />
                </div>
                <span className={`md:col-span-1 text-center ${formData.operatingHours[day.key].isClosed ? 'text-base-content/30' : ''}`}>-</span>
                <div className="md:col-span-3 form-control">
                    <input
                        type="time"
                        className={`input input-bordered input-sm w-full ${formData.operatingHours[day.key].isClosed ? 'input-disabled' : ''} ${formErrors[`operatingHours.${day.key}`] ? 'input-error' : ''}`}
                        value={formData.operatingHours[day.key].close ?? ''}
                        onChange={(e) => handleOperatingHoursChange(day.key, 'close', e.target.value)}
                        disabled={isLoading || formData.operatingHours[day.key].isClosed}
                    />
                </div>
                 {formErrors[`operatingHours.${day.key}`] && <span className="text-error text-xs mt-1 md:col-span-12">{formErrors[`operatingHours.${day.key}`]}</span>}
            </div>
          ))}
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
            disabled={isLoading || (!initialData && currentUserRole === UserRole.SUPER_ADMIN && ownerSearchTerm.length > 0 && suggestedUsers.length > 0 && !selectedOwner)}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
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
