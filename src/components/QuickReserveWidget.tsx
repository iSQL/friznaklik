// src/components/QuickReserveWidget.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Service as PrismaService, Vendor as PrismaVendor } from '@prisma/client';
import { format, addHours, setHours, setMinutes, isBefore, startOfToday } from 'date-fns'; // Ensure all used date-fns functions are here
import { useAuth } from "@clerk/nextjs";
import { AlertTriangle, Clock, CheckCircle2, XCircle, Info, Store, ShoppingBag, Loader2 } from 'lucide-react';
import { formatErrorMessage } from '@/lib/errorUtils';
import { useBookingStore } from '@/store/bookingStore';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

interface BookingErrorPayload {
  message: string;
  status?: number;
  details?: string | object;
}

export default function QuickReserveWidget() {
  const { isSignedIn } = useAuth();

  // Get global state from useBookingStore
  const globallySelectedVendorId = useBookingStore((state) => state.selectedVendorId);
  const allVendorsFromStore = useBookingStore((state) => state.allVendors);
  const isLoadingAllVendorsGlobal = useBookingStore((state) => state.isLoadingAllVendors);
  const isStoreHydrated = useBookingStore((state) => state.isHydrated); // Use hydration state

  // Local state for this widget's specific selections and operations
  const [services, setServices] = useState<PrismaService[]>([]);
  const [selectedService, setSelectedService] = useState<PrismaService | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedVendorName, setSelectedVendorName] = useState<string | null>(null);

  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  const [servicesError, setServicesError] = useState<string | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  const todayDate = format(new Date(), 'yyyy-MM-dd'); // String for API calls

  // Effect to derive selected vendor's name when global selection or vendor list changes
  useEffect(() => {
    if (globallySelectedVendorId && allVendorsFromStore.length > 0) {
      const currentVendor = allVendorsFromStore.find(v => v.id === globallySelectedVendorId);
      setSelectedVendorName(currentVendor?.name || `Salon (ID: ${globallySelectedVendorId.substring(0, 8)}...)`);
    } else if (globallySelectedVendorId) {
      // Fallback if allVendorsFromStore is not yet populated but ID exists (e.g. from cookie)
      // Optionally, could fetch vendor details here, but ideally Header populates store.
      setSelectedVendorName(`Salon (ID: ${globallySelectedVendorId.substring(0, 8)}...)`);
    } else {
      setSelectedVendorName(null);
    }
  }, [globallySelectedVendorId, allVendorsFromStore]);

  // Fetch services when globallySelectedVendorId changes
  useEffect(() => {
    if (globallySelectedVendorId && isStoreHydrated) { // Ensure store is hydrated before fetching
      setIsLoadingServices(true);
      setServicesError(null);
      setServices([]);
      setSelectedService(null);
      setAvailableSlots([]);
      setSelectedSlot(null);

      fetch(`${SITE_URL}/api/services?vendorId=${globallySelectedVendorId}`)
        .then(res => {
          if (!res.ok) {
            return res.json().then(errData => {
              throw { message: `Neuspešno preuzimanje usluga: ${res.status}`, status: res.status, details: errData.message || "Nepoznata greška" };
            });
          }
          return res.json();
        })
        .then((data: PrismaService[]) => {
          setServices(data);
        })
        .catch((err: unknown) => {
          setServicesError(formatErrorMessage(err, `preuzimanja usluga za izabrani salon`));
        })
        .finally(() => {
          setIsLoadingServices(false);
        });
    } else {
      setServices([]);
      setSelectedService(null);
      setAvailableSlots([]);
      setSelectedSlot(null);
      setIsLoadingServices(false);
      setServicesError(null);
      setSlotsError(null);
    }
  }, [globallySelectedVendorId, isStoreHydrated]); // Depend on isStoreHydrated

  // Fetch available slots when selectedService (and implicitly global vendor) changes
  useEffect(() => {
    if (globallySelectedVendorId && selectedService && isStoreHydrated) {
      setIsLoadingSlots(true);
      setSlotsError(null);
      setAvailableSlots([]);
      setSelectedSlot(null);
      setBookingError(null);
      setBookingSuccess(null);

      fetch(`${SITE_URL}/api/appointments/available?vendorId=${globallySelectedVendorId}&serviceId=${selectedService.id}&date=${todayDate}`)
        .then(res => {
          if (!res.ok) {
            return res.json().then(errData => {
              throw { message: `Neuspešno preuzimanje termina: ${res.status}`, status: res.status, details: errData.message || "Nepoznata greška" };
            });
          }
          return res.json();
        })
        .then((data: { availableSlots: Array<{time: string, availableWorkers: any[]}> }) => {
          let slotsData = data.availableSlots.map(s => s.time);
          const currentMinBookingTime = addHours(new Date(), 1);
          const todayAsDateObj = startOfToday();

          slotsData = slotsData.filter(slotTime => {
              const [slotHours, slotMinutes] = slotTime.split(':').map(Number);
              const slotDateTime = setMinutes(setHours(todayAsDateObj, slotHours), slotMinutes);
              return isBefore(currentMinBookingTime, slotDateTime);
          });
          setAvailableSlots(slotsData);
        })
        .catch((err: unknown) => {
          setSlotsError(formatErrorMessage(err, `preuzimanja termina za ${selectedService.name} za danas`));
        })
        .finally(() => {
          setIsLoadingSlots(false);
        });
    } else {
      setAvailableSlots([]);
      setSelectedSlot(null);
      setIsLoadingSlots(false);
      setSlotsError(null);
    }
  }, [globallySelectedVendorId, selectedService, todayDate, isStoreHydrated]); // Depend on isStoreHydrated

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service || null);
    setAvailableSlots([]); // Reset subsequent selections
    setSelectedSlot(null);
  };

  const handleBooking = async () => {
    if (!globallySelectedVendorId || !selectedService || !selectedSlot || !isSignedIn) {
      if (!isSignedIn) {
        setBookingError("Molimo Vas prijavite se da biste rezervisali termin.");
      } else {
        setBookingError("Molimo odaberite uslugu i vreme (salon je već izabran globalno).");
      }
      return;
    }

    setIsBooking(true);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      const [hours, minutes] = selectedSlot.split(':').map(Number);
      const todayAsDateObj = startOfToday();
      const startTime = setMinutes(setHours(todayAsDateObj, hours), minutes);

      const response = await fetch(`${SITE_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: globallySelectedVendorId,
          serviceId: selectedService.id,
          startTime: startTime.toISOString(),
          // For QuickReserve, workerId is usually not selected, backend might auto-assign
        }),
      });

      if (!response.ok) {
        const errorData: BookingErrorPayload = await response.json().catch(() => ({ message: `Rezervacija neuspešna: ${response.status}` }));
        throw { message: errorData.message, status: response.status, details: errorData.details || errorData };
      }
      
      setBookingSuccess(`Uspešno ste zatražili termin za ${selectedService.name} u ${selectedSlot} u salonu ${selectedVendorName || 'izabranom salonu'}!`);
      setSelectedSlot(null); // Reset slot
      
      // Refetch slots after booking
      if (globallySelectedVendorId && selectedService) {
        setIsLoadingSlots(true);
        fetch(`${SITE_URL}/api/appointments/available?vendorId=${globallySelectedVendorId}&serviceId=${selectedService.id}&date=${todayDate}`)
          .then(res => res.ok ? res.json() : Promise.reject(res))
          .then((data: { availableSlots: Array<{time: string, availableWorkers: any[]}> }) => {
              let slotsData = data.availableSlots.map(s => s.time);
              const currentMinBookingTime = addHours(new Date(), 1);
              const todayAsDateObjForRefresh = startOfToday();
              slotsData = slotsData.filter(slotTime => {
                  const [slotHours, slotMinutes] = slotTime.split(':').map(Number);
                  const slotDateTime = setMinutes(setHours(todayAsDateObjForRefresh, slotHours), slotMinutes);
                  return isBefore(currentMinBookingTime, slotDateTime);
              });
              setAvailableSlots(slotsData);
          })
          .catch(e => setSlotsError(formatErrorMessage(e, "osvežavanja termina nakon rezervacije")))
          .finally(() => setIsLoadingSlots(false));
      }
    } catch (err: unknown) {
      setBookingError(formatErrorMessage(err, "podnošenja brze rezervacije"));
    } finally {
      setIsBooking(false);
    }
  };

  // Initial check for store hydration and global vendor list loading
  if (!isStoreHydrated || isLoadingAllVendorsGlobal) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body items-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-2 text-base-content/70">Učitavanje podešavanja...</p>
        </div>
      </div>
    );
  }

  // If store is hydrated but no vendor is selected globally
  if (!globallySelectedVendorId) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <Store size={32} className="text-primary mb-2"/>
          <p className="font-semibold">Molimo Vas, izaberite salon iz zaglavlja kako biste videli brze rezervacije.</p>
          <Link href="/vendors" className="btn btn-sm btn-outline btn-primary mt-3">Pregledaj Salone</Link>
        </div>
      </div>
    );
  }

  // Main widget content (if vendor is selected globally)
  return (
    <div className="space-y-4">
      {selectedVendorName && (
        <p className="text-sm text-center text-base-content/80">
            Brza rezervacija za danas u salonu: <span className="font-semibold text-primary">{selectedVendorName}</span>
        </p>
      )}
      <div>
        <label htmlFor="service-select-quick" className="label">
          <span className="label-text flex items-center"><ShoppingBag size={16} className="mr-2"/>Odaberite uslugu:</span>
        </label>
        <select
          id="service-select-quick"
          className="select select-bordered w-full"
          value={selectedService?.id || ''}
          onChange={(e) => handleServiceChange(e.target.value)}
          disabled={isLoadingServices || services.length === 0}
        >
          <option value="" disabled>
            {isLoadingServices ? "Učitavanje usluga..." : (services.length === 0 ? "Nema aktivnih usluga" : "Izaberite uslugu")}
          </option>
          {services.map(service => (
            <option key={service.id} value={service.id}>
              {service.name} ({service.duration} min) - {service.price.toFixed(2)} RSD
            </option>
          ))}
        </select>
        {servicesError && <p className="text-error text-xs mt-1">{servicesError}</p>}
      </div>

      {selectedService && (
        <div>
          <h3 className="text-md font-semibold mb-2 mt-3">
            Dostupni termini za danas ({format(startOfToday(), 'dd.MM.yyyy')}) za {selectedService.name}:
          </h3>
          {isLoadingSlots ? (
            <div className="flex justify-center items-center py-4">
              <span className="loading loading-dots loading-md text-primary"></span>
            </div>
          ) : slotsError ? (
            <div role="alert" className="alert alert-warning text-sm p-3">
              <AlertTriangle className="h-5 w-5" />
              <span>{slotsError}</span>
            </div>
          ) : availableSlots.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableSlots.map(slot => (
                <button
                  key={slot}
                  className={`btn btn-sm ${selectedSlot === slot ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setSelectedSlot(slot)}
                  disabled={isBooking}
                >
                  <Clock className="mr-1 h-4 w-4" /> {slot}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-base-content/70 p-3 bg-base-200 rounded-md">Nema dostupnih termina za danas za odabranu uslugu.</p>
          )}
        </div>
      )}

      {bookingSuccess && (
        <div role="alert" className="alert alert-success mt-3">
          <CheckCircle2 />
          <span>{bookingSuccess}</span>
        </div>
      )}
      {bookingError && (
        <div role="alert" className="alert alert-error mt-3">
          <XCircle />
          <span>{bookingError}</span>
        </div>
      )}

      {selectedService && selectedSlot && isSignedIn && (
        <button
          className="btn btn-success w-full mt-4"
          onClick={handleBooking}
          disabled={isBooking || !selectedSlot}
        >
          {isBooking ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              Rezerviše se...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5" /> Potvrdi Rezervaciju za {selectedSlot}
            </>
          )}
        </button>
      )}
      
      {selectedService && !selectedSlot && availableSlots.length === 0 && !isLoadingSlots && !slotsError &&(
         <div className="mt-4 text-center">
            <p className="mb-2 text-sm text-base-content/70">Žao nam je, nema brzih termina za danas za ovu uslugu.</p>
            <Link href={`/book?vendorId=${globallySelectedVendorId}`} className="btn btn-secondary btn-sm">
                Pogledajte sve termine za izabrani salon
            </Link>
         </div>
      )}

      {!isSignedIn && selectedService && (
         <div role="alert" className="alert alert-info mt-4">
            <Info className="h-5 w-5"/>
            <span>Molimo <Link href={`/sign-in?redirect_url=/`} className="link link-primary font-semibold">prijavite se</Link> ili <Link href={`/sign-up?redirect_url=/`} className="link link-secondary font-semibold">registrujte</Link> da biste rezervisali termin.</span>
        </div>
      )}
    </div>
  );
}
