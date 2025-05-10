'use client';

import { useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import { Service } from '@prisma/client';
import { format } from 'date-fns';
import { useAuth } from "@clerk/nextjs";
import { AlertTriangle, Clock, CheckCircle2, XCircle, Info } from 'lucide-react';
import { formatErrorMessage } from '@/lib/errorUtils';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

interface BookingErrorPayload {
  message: string;
  status?: number;
  details?: string | object;
}

export default function QuickReserveWidget() {
  const { isSignedIn } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  const [servicesError, setServicesError] = useState<string | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  const todayDate = format(new Date(), 'yyyy-MM-dd');

  // Fetch services
  useEffect(() => {
    const fetchServices = async () => {
      setIsLoadingServices(true);
      setServicesError(null);
      try {
        const response = await fetch(`${SITE_URL}/api/services`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: `Failed to fetch services: ${response.status}` }));
          throw { message: errorData.message || 'Service fetch failed', status: response.status, details: errorData };
        }
        const data: Service[] = await response.json();
        setServices(data);
        if (data.length > 0) {
          // Optionally pre-select the first service or a common one like "Šišanje"
          // setSelectedService(data.find(s => s.name.toLowerCase().includes("šišanje")) || data[0]);
        }
      } catch (err: unknown) {
        setServicesError(formatErrorMessage(err, "fetching services for quick reserve"));
      } finally {
        setIsLoadingServices(false);
      }
    };
    fetchServices();
  }, []);

  // Fetch available slots when selectedService changes for today's date
  useEffect(() => {
    if (selectedService) {
      const fetchSlots = async () => {
        setIsLoadingSlots(true);
        setSlotsError(null);
        setAvailableSlots([]);
        setSelectedSlot(null); // Reset selected slot
        setBookingError(null);
        setBookingSuccess(null);

        try {
          const response = await fetch(`${SITE_URL}/api/appointments/available?serviceId=${selectedService.id}&date=${todayDate}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Failed to fetch slots: ${response.status}` }));
            throw { message: errorData.message || 'Slot fetch failed', status: response.status, details: errorData };
          }
          const data: string[] = await response.json();
          setAvailableSlots(data);
        } catch (err: unknown) {
          setSlotsError(formatErrorMessage(err, `Workspaceing slots for ${selectedService.name} for today`));
        } finally {
          setIsLoadingSlots(false);
        }
      };
      fetchSlots();
    } else {
      setAvailableSlots([]);
      setSelectedSlot(null);
      setIsLoadingSlots(false);
    }
  }, [selectedService, todayDate]);

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setSelectedService(service || null);
  };

  const handleBooking = async () => {
    if (!selectedService || !selectedSlot || !isSignedIn) {
      if (!isSignedIn) {
        setBookingError("Molimo Vas prijavite se da biste rezervisali termin.");
      } else {
        setBookingError("Molimo odaberite uslugu i vreme.");
      }
      return;
    }

    setIsBooking(true);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      const response = await fetch(`${SITE_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          date: todayDate,
          slot: selectedSlot,
        }),
      });

      if (!response.ok) {
        const errorData: BookingErrorPayload = await response.json().catch(() => ({ message: `Booking failed: ${response.status}` }));
        throw { message: errorData.message, status: response.status, details: errorData.details || errorData };
      }
      
      setBookingSuccess(`Uspešno ste zatražili termin za ${selectedService.name} u ${selectedSlot}!`);
      setSelectedSlot(null); // Reset slot
       const fetchSlotsAfterBooking = async () => {
        setIsLoadingSlots(true);
         try {
            const res = await fetch(`${SITE_URL}/api/appointments/available?serviceId=${selectedService.id}&date=${todayDate}`);
            if (res.ok) {
                const data: string[] = await res.json();
                setAvailableSlots(data);
            } else {
                 setSlotsError("Nije moguće osvežiti termine.");
            }
        } catch (e) {
            setSlotsError(formatErrorMessage(e, "refreshing slots after booking"));
        } finally {
            setIsLoadingSlots(false);
        }
       }
       fetchSlotsAfterBooking();


    } catch (err: unknown) {
      setBookingError(formatErrorMessage(err, "quick booking submission"));
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoadingServices) {
    return <div className="skeleton h-32 w-full"></div>;
  }

  if (servicesError) {
    return (
      <div role="alert" className="alert alert-error">
        <AlertTriangle />
        <span>Greška pri učitavanju usluga: {servicesError}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="service-select" className="label">
          <span className="label-text">Odaberite uslugu:</span>
        </label>
        <select
          id="service-select"
          className="select select-bordered w-full"
          value={selectedService?.id || ''}
          onChange={(e) => handleServiceChange(e.target.value)}
          disabled={services.length === 0}
        >
          <option value="" disabled>
            {services.length === 0 ? "Nema dostupnih usluga" : "Izaberite uslugu"}
          </option>
          {services.map(service => (
            <option key={service.id} value={service.id}>
              {service.name} ({service.duration} min) - {service.price} RSD
            </option>
          ))}
        </select>
      </div>

      {selectedService && (
        <div>
          <h3 className="text-lg font-semibold mb-2">
            Dostupni termini za danas ({format(new Date(todayDate), 'dd.MM.yyyy')}) za {selectedService.name}:
          </h3>
          {isLoadingSlots ? (
            <div className="flex justify-center items-center py-4">
              <span className="loading loading-dots loading-md"></span>
            </div>
          ) : slotsError ? (
            <div role="alert" className="alert alert-warning text-sm p-3">
              <AlertTriangle className="h-5 w-5" />
              <span>{slotsError}</span>
            </div>
          ) : availableSlots.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
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
            <p className="text-base-content/70">Nema dostupnih termina za danas za odabranu uslugu.</p>
          )}
        </div>
      )}

      {bookingSuccess && (
        <div role="alert" className="alert alert-success">
          <CheckCircle2 />
          <span>{bookingSuccess}</span>
        </div>
      )}
      {bookingError && (
        <div role="alert" className="alert alert-error">
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
            <p className="mb-2">Žao nam je, nema brzih termina za danas.</p>
            <Link href="/book" className="btn btn-secondary">
                Pogledajte sve termine
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