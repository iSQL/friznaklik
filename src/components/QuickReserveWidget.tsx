// src/components/QuickReserveWidget.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Service as PrismaService } from '@prisma/client';
import { format, addHours, setHours, setMinutes, isBefore, startOfToday, isSameDay, parseISO } from 'date-fns';
import { useAuth } from "@clerk/nextjs";
import { AlertTriangle, Clock, CheckCircle2, XCircle, Info, Store, ShoppingBag, Loader2, UserCog, CalendarDays, Scissors } from 'lucide-react';
import { formatErrorMessage } from '@/lib/errorUtils';
import { useBookingStore, type SlotWithWorkers, type WorkerInfo } from '@/store/bookingStore'; // Import store types

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

interface BookingErrorPayload {
  message: string;
  status?: number;
  details?: string | object;
}

// Type for the appointment object returned by the booking API
interface BookedAppointment {
  id: string;
  service?: { name?: string | null };
  vendor?: { name?: string | null };
  worker?: { name?: string | null } | null; // Worker can be null
  startTime: string;
}


export default function QuickReserveWidget() {
  const { isSignedIn } = useAuth();

  const globallySelectedVendorId = useBookingStore((state) => state.selectedVendorId);
  const allVendorsFromStore = useBookingStore((state) => state.allVendors);
  const isLoadingAllVendorsGlobal = useBookingStore((state) => state.isLoadingAllVendors);
  const isStoreHydrated = useBookingStore((state) => state.isHydrated);

  const [services, setServices] = useState<PrismaService[]>([]);
  const [selectedService, setSelectedService] = useState<PrismaService | null>(null);
  
  const [availableSlotsData, setAvailableSlotsData] = useState<SlotWithWorkers[]>([]);
  const [selectedSlotData, setSelectedSlotData] = useState<SlotWithWorkers | null>(null); 

  const [selectedVendorName, setSelectedVendorName] = useState<string | null>(null);

  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  const [servicesError, setServicesError] = useState<string | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookedAppointmentDetails, setBookedAppointmentDetails] = useState<BookedAppointment | null>(null);


  const todayDateString = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (globallySelectedVendorId && allVendorsFromStore.length > 0) {
      const currentVendor = allVendorsFromStore.find(v => v.id === globallySelectedVendorId);
      setSelectedVendorName(currentVendor?.name || `Salon (ID: ${globallySelectedVendorId.substring(0, 8)}...)`);
    } else if (globallySelectedVendorId) {
      setSelectedVendorName(`Salon (ID: ${globallySelectedVendorId.substring(0, 8)}...)`);
    } else {
      setSelectedVendorName(null);
    }
  }, [globallySelectedVendorId, allVendorsFromStore]);

  const resetSelections = useCallback(() => {
    setSelectedService(null);
    setAvailableSlotsData([]);
    setSelectedSlotData(null);
    setServicesError(null);
    setSlotsError(null);
    setBookingError(null);
    setBookingSuccess(null);
    setBookedAppointmentDetails(null);
  }, []);

  useEffect(() => {
    if (globallySelectedVendorId && isStoreHydrated) {
      setIsLoadingServices(true);
      resetSelections(); 

      fetch(`${SITE_URL}/api/services?vendorId=${globallySelectedVendorId}&activeOnly=true`)
        .then(res => {
          if (!res.ok) return res.json().then(errData => Promise.reject({ message: `Neuspešno preuzimanje usluga: ${res.status}`, status: res.status, details: errData.message || "Nepoznata greška" }));
          return res.json();
        })
        .then((data: PrismaService[]) => setServices(data))
        .catch((err: unknown) => setServicesError(formatErrorMessage(err, `preuzimanja usluga za izabrani salon`)))
        .finally(() => setIsLoadingServices(false));
    } else {
      resetSelections(); 
      setIsLoadingServices(false);
    }
  }, [globallySelectedVendorId, isStoreHydrated, resetSelections]);

  useEffect(() => {
    if (globallySelectedVendorId && selectedService && isStoreHydrated) {
      setIsLoadingSlots(true);
      setSlotsError(null);
      setAvailableSlotsData([]);
      setSelectedSlotData(null);
      setBookingError(null);
      setBookingSuccess(null);
      setBookedAppointmentDetails(null);

      fetch(`${SITE_URL}/api/appointments/available?vendorId=${globallySelectedVendorId}&serviceId=${selectedService.id}&date=${todayDateString}`)
        .then(res => {
          if (!res.ok) return res.json().then(errData => Promise.reject({ message: `Neuspešno preuzimanje termina: ${res.status}`, status: res.status, details: errData.message || "Nepoznata greška" }));
          return res.json();
        })
        .then((data: { availableSlots: SlotWithWorkers[], message?: string }) => {
          if (data.message && data.availableSlots.length === 0) {
            setSlotsError(data.message);
            setAvailableSlotsData([]);
          } else {
            let slotsData = data.availableSlots;
            const currentMinBookingTime = addHours(new Date(), 1);
            const todayAsDateObj = startOfToday();
             if (isSameDay(parseISO(todayDateString), todayAsDateObj)) { 
                slotsData = slotsData.filter(slot => {
                    const [slotHours, slotMinutes] = slot.time.split(':').map(Number);
                    const slotDateTime = setMinutes(setHours(todayAsDateObj, slotHours), slotMinutes);
                    return isBefore(currentMinBookingTime, slotDateTime);
                });
            }
            setAvailableSlotsData(slotsData);
          }
        })
        .catch((err: unknown) => setSlotsError(formatErrorMessage(err, `preuzimanja termina za ${selectedService.name} za danas`)))
        .finally(() => setIsLoadingSlots(false));
    } else {
      setAvailableSlotsData([]);
      setSelectedSlotData(null);
      setIsLoadingSlots(false);
      setSlotsError(null);
    }
  }, [globallySelectedVendorId, selectedService, todayDateString, isStoreHydrated]);

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service || null);
    setAvailableSlotsData([]);
    setSelectedSlotData(null);
  };
  
  const handleSlotSelect = (slotData: SlotWithWorkers) => {
    setSelectedSlotData(slotData);
  };

  const handleBooking = async () => {
    if (!globallySelectedVendorId || !selectedService || !selectedSlotData || !isSignedIn) {
      setBookingError(!isSignedIn ? "Molimo Vas prijavite se da biste rezervisali termin." : "Molimo odaberite uslugu i vreme.");
      return;
    }

    setIsBooking(true);
    setBookingError(null);
    setBookingSuccess(null);
    setBookedAppointmentDetails(null);

    try {
      const [hours, minutes] = selectedSlotData.time.split(':').map(Number);
      const todayAsDateObj = startOfToday(); 
      const startTime = setMinutes(setHours(todayAsDateObj, hours), minutes);

      const bookingPayload = {
        vendorId: globallySelectedVendorId,
        serviceId: selectedService.id,
        startTime: startTime.toISOString(),
        workerId: null, 
      };

      const response = await fetch(`${SITE_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload),
      });

      if (!response.ok) {
        const errorData: BookingErrorPayload = await response.json().catch(() => ({ message: `Rezervacija neuspešna: ${response.status}` }));
        throw { message: errorData.message, status: response.status, details: errorData.details || errorData };
      }
      
      const newAppointment: BookedAppointment = await response.json();
      setBookedAppointmentDetails(newAppointment); 

      let successMsg = `Uspešno ste zatražili termin za ${selectedService.name} u ${selectedSlotData.time} u salonu ${selectedVendorName || 'izabranom salonu'}.`;
      if(newAppointment.worker?.name) {
        successMsg += ` Dodeljen Vam je radnik: ${newAppointment.worker.name}.`;
      }
      setBookingSuccess(successMsg);
      setSelectedSlotData(null); 
      
      if (globallySelectedVendorId && selectedService) {
        setIsLoadingSlots(true);
        fetch(`${SITE_URL}/api/appointments/available?vendorId=${globallySelectedVendorId}&serviceId=${selectedService.id}&date=${todayDateString}`)
          .then(res => res.ok ? res.json() : Promise.reject(res))
          .then((data: { availableSlots: SlotWithWorkers[] }) => {
              let slotsData = data.availableSlots;
              const currentMinBookingTime = addHours(new Date(), 1);
              const todayObjForRefresh = startOfToday();
               if (isSameDay(parseISO(todayDateString), todayObjForRefresh)) {
                    slotsData = slotsData.filter(slot => {
                        const [slotHours, slotMinutes] = slot.time.split(':').map(Number);
                        const slotDateTime = setMinutes(setHours(todayObjForRefresh, slotHours), slotMinutes);
                        return isBefore(currentMinBookingTime, slotDateTime);
                    });
                }
              setAvailableSlotsData(slotsData);
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
            {isLoadingServices ? "Učitavanje usluga..." : (services.length === 0 && !servicesError ? "Nema aktivnih usluga" : (servicesError ? "Greška pri učitavanju" : "Izaberite uslugu"))}
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
            <div className="flex justify-center items-center py-4"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </div>
          ) : slotsError ? (
            <div role="alert" className="alert alert-warning text-sm p-3"> <AlertTriangle className="h-5 w-5" /> <span>{slotsError}</span> </div>
          ) : availableSlotsData.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableSlotsData.map(slot => {
                const slotHours = parseInt(slot.time.split(':')[0]);
                const slotMinutes = parseInt(slot.time.split(':')[1]);
                const slotDateTime = setMinutes(setHours(startOfToday(), slotHours), slotMinutes);
                const isSlotTooSoon = isBefore(slotDateTime, addHours(new Date(),1));

                return (
                  <button
                    key={slot.time}
                    className={`btn btn-sm ${selectedSlotData?.time === slot.time ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => handleSlotSelect(slot)}
                    disabled={isBooking || isSlotTooSoon}
                    title={isSlotTooSoon ? "Termin je unutar narednih sat vremena" : ""}
                  >
                    <Clock className="mr-1 h-4 w-4" /> {slot.time}
                  </button>
                );
              })}
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

      {selectedService && selectedSlotData && isSignedIn && (
        <button
          className="btn btn-success w-full mt-4"
          onClick={handleBooking}
          disabled={isBooking || !selectedSlotData}
        >
          {isBooking ? (
            <> <Loader2 className="loading loading-spinner loading-sm mr-2" /> Rezerviše se... </>
          ) : (
            <> <CheckCircle2 className="mr-2 h-5 w-5" /> Potvrdi Rezervaciju za {selectedSlotData.time} </>
          )}
        </button>
      )}
      
      {selectedService && availableSlotsData.length === 0 && !isLoadingSlots && !slotsError && (
         <div className="mt-4 text-center">
            <p className="mb-2 text-sm text-base-content/70">Žao nam je, nema brzih termina za danas za ovu uslugu.</p>
            <Link href={`/book?vendorId=${globallySelectedVendorId}`} className="btn btn-secondary btn-sm">
                <CalendarDays className="mr-2 h-4 w-4"/> Pogledajte sve termine
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

