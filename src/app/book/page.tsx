// src/app/book/page.tsx
'use client';

import { useBookingStore } from '@/store/bookingStore';
import { useState, useEffect, Suspense, useRef } from 'react';
import { Service } from '@prisma/client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatErrorMessage, type FormattedError } from '@/lib/errorUtils';
import { CalendarDays, Clock, ShoppingBag, AlertTriangle, CheckCircle2, ArrowLeft, Loader2, X } from 'lucide-react';

import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, getDay, addHours, isBefore, startOfToday, isSameDay, setHours, setMinutes } from 'date-fns';
import { srLatn } from 'date-fns/locale';

registerLocale('sr-Latn', srLatn);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

interface BookingErrorPayload {
  message: string;
  status?: number;
  details?: string | object;
}

function BookingForm() {
  const searchParams = useSearchParams();
  const successModalRef = useRef<HTMLDialogElement>(null);

  const {
    selectedServiceId,
    selectedDate,
    availableSlots,
    selectedSlot,
    bookingStatus,
    bookingError,
    selectService,
    selectDate,
    setAvailableSlots,
    selectSlot: setStoreSelectedSlot,
    setBookingStatus,
    setBookingError,
    resetBooking,
  } = useBookingStore();

  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      setIsLoadingServices(true);
      setServicesError(null);
      try {
        const response = await fetch(`${SITE_URL}/api/services`);
        if (!response.ok) {
          const errorText = await response.text();
          const errorToThrow: FormattedError = {
            message: `Neuspesno preuzimanje usluga: ${response.status}`,
            originalError: errorText,
            context: "preuzimanje usluga",
            status: response.status
          };
          throw errorToThrow;
        }
        const data: Service[] = await response.json();
        setServices(data);
      } catch (err: unknown) {
        setServicesError(formatErrorMessage(err, "preuzimanja usluga"));
      } finally {
        setIsLoadingServices(false);
      }
    };
    fetchServices();
  }, []);

  useEffect(() => {
    const serviceIdFromUrl = searchParams.get('serviceId');
    if (serviceIdFromUrl && services.length > 0) {
      const serviceExists = services.some(s => s.id === serviceIdFromUrl);
      if (serviceExists) {
        selectService(serviceIdFromUrl);
      } else {
        console.warn(`ID usluge ${serviceIdFromUrl} iz URL-a nije pronadjen u preuzetim uslugama.`);
      }
    }
  }, [searchParams, services, selectService]);

  useEffect(() => {
    if (selectedServiceId && selectedDate) {
      const fetchAvailableSlots = async () => {
        setIsLoadingSlots(true);
        setSlotsError(null);
        setAvailableSlots([]);
        try {
          const formattedDate = format(selectedDate, 'yyyy-MM-dd');
          const response = await fetch(`${SITE_URL}/api/appointments/available?serviceId=${selectedServiceId}&date=${formattedDate}`);
          if (!response.ok) {
            const errorText = await response.text();
            const errorToThrow: FormattedError = {
              message: `Neuspesno preuzimanje dostupnih termina: ${response.status}`,
              originalError: errorText,
              context: "preuzimanje dostupnih termina",
              status: response.status
            };
            throw errorToThrow;
          }
          let data: string[] = await response.json();
          
          const currentMinBookingTime = addHours(new Date(), 12); // Ne moze se zakazati termin u sledecih 12 sati
          if (isSameDay(selectedDate, new Date())) {
            data = data.filter(slot => {
              const [hours, minutes] = slot.split(':').map(Number);
              const slotDateTime = setMinutes(setHours(selectedDate, hours), minutes);
              return isBefore(currentMinBookingTime, slotDateTime);
            });
          }
          setAvailableSlots(data);

        } catch (err: unknown) {
          setSlotsError(formatErrorMessage(err, "preuzimanja dostupnih termina"));
        } finally {
          setIsLoadingSlots(false);
        }
      };
      fetchAvailableSlots();
    } else {
      setAvailableSlots([]);
      setStoreSelectedSlot(null);
    }
  }, [selectedServiceId, selectedDate, setAvailableSlots, setStoreSelectedSlot]);

  const handleServiceSelect = (serviceId: string) => {
    selectService(serviceId);
    selectDate(null);
    setStoreSelectedSlot(null);
    setAvailableSlots([]);
    setSlotsError(null);
    setBookingError(null);
  };

  const handleDateSelect = (date: Date | null) => {
    if (date && isBefore(date, startOfToday())) {
        selectDate(startOfToday());
    } else {
        selectDate(date);
    }
    setStoreSelectedSlot(null);
    setSlotsError(null);
    setBookingError(null);
  };

  const handleSlotSelect = (slot: string) => {
    const currentMinBookingTime = addHours(new Date(), 12);
    if (selectedDate && isSameDay(selectedDate, new Date())) {
        const [hours, minutes] = slot.split(':').map(Number);
        const slotDateTime = setMinutes(setHours(selectedDate, hours), minutes);
        if (isBefore(slotDateTime, currentMinBookingTime)) {
            setBookingError("Odabrani termin je unutar narednih 12 sati i ne može se rezervisati.");
            setStoreSelectedSlot(null);
            return;
        }
    }
    setStoreSelectedSlot(slot);
    setBookingError(null);
  };

  const handleBookingSubmit = async () => {
    if (!selectedServiceId || !selectedDate || !selectedSlot) {
      setBookingError("Molimo Vas odaberite uslugu, datum i vreme termina.");
      setBookingStatus('error');
      return;
    }
    setBookingStatus('submitting');
    setBookingError(null);
    try {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`${SITE_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          date: formattedDate,
          slot: selectedSlot,
        }),
      });
      if (!response.ok) {
        const errorPayload: BookingErrorPayload = {
          message: `Zakazivanje nije uspelo (Status: ${response.status})`,
          status: response.status
        };
        try {
          const errorData = await response.json();
          errorPayload.details = errorData.message || errorData.error || errorPayload.details || JSON.stringify(errorData);
        } catch {
          errorPayload.details = await response.text();
        }
        throw errorPayload;
      }
      setBookingStatus('success');
      successModalRef.current?.showModal();
      selectDate(null);
      setStoreSelectedSlot(null);
    } catch (err: unknown) {
      setBookingStatus('error');
      setBookingError(formatErrorMessage(err, "slanja zahteva za zakazivanje"));
    }
  };

  const selectedServiceName = services.find(s => s.id === selectedServiceId)?.name || 'Usluga';

  const isWeekday = (date: Date) => {
    const day = getDay(date);
    return day !== 0 && day !== 6;
  };

  const getDayClassName = (date: Date): string => {
    if (isBefore(date, startOfToday())) {
      return "react-datepicker__day--past";
    }
    if (!isWeekday(date)) {
      return "react-datepicker__day--weekend";
    }
    return "";
  };
  
  const isSlotDisabled = (slot: string): boolean => {
    const currentMinBookingTime = addHours(new Date(), 12);
    if (selectedDate && isSameDay(selectedDate, new Date())) {
        const [hours, minutes] = slot.split(':').map(Number);
        const slotDateTime = setMinutes(setHours(selectedDate, hours), minutes);
        return isBefore(slotDateTime, currentMinBookingTime);
    }
    return false;
  };


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-neutral-content">
          Zakažite Vaš Termin
        </h1>
        <p className="text-lg text-neutral-content/80 mt-2">Brzo i lako do savršene frizure.</p>
      </div>

      <div className="mb-8 p-6 card bg-base-200 shadow-xl border border-base-300/50">
        <h2 className="text-2xl font-semibold mb-4 card-title text-primary flex items-center">
          <ShoppingBag className="h-6 w-6 mr-2" /> 1. Odaberite Uslugu
        </h2>
        {isLoadingServices ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : servicesError ? (
          <div role="alert" className="alert alert-error">
            <AlertTriangle className="h-6 w-6" />
            <span>{servicesError}</span>
          </div>
        ) : services.length === 0 ? (
          <div role="alert" className="alert alert-warning">
             <AlertTriangle className="h-6 w-6" />
            <span>Trenutno nema dostupnih usluga. Molimo pokušajte kasnije.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                className={`card bordered cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md transform hover:-translate-y-1 ${
                  selectedServiceId === service.id
                    ? 'border-2 border-primary ring-2 ring-primary/50 bg-primary/10 shadow-lg'
                    : 'bg-base-100 border-base-300 hover:border-primary/70'
                }`}
                onClick={() => handleServiceSelect(service.id)}
                tabIndex={0}
                onKeyPress={(e) => e.key === 'Enter' && handleServiceSelect(service.id)}
              >
                <div className="card-body p-5">
                  <h3 className="card-title text-lg">{service.name}</h3>
                  <p className="text-sm text-base-content/70 mb-1 line-clamp-2 h-10">
                    {service.description || "Nema detaljnog opisa."}
                  </p>
                  <p className="font-semibold text-base-content/90">{service.price.toFixed(2)} RSD - {service.duration} min</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedServiceId && (
        <div className="mb-8 p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-2xl font-semibold mb-6 card-title text-primary flex items-center">
            <CalendarDays className="h-6 w-6 mr-2" /> 2. Odaberite Datum i Vreme za &quot;{selectedServiceName}&quot;
          </h2>
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            <div className="flex-1 lg:max-w-sm">
              <h3 className="text-xl font-medium mb-3 text-neutral-content">Datum</h3>
              <div className="p-1 border rounded-lg inline-block bg-base-100 border-base-300 shadow-sm">
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateSelect}
                  dateFormat="dd.MM.yyyy"
                  minDate={addHours(new Date(), 12)}
                  filterDate={isWeekday}
                  inline
                  locale="sr-Latn"
                  className="react-datepicker-override"
                  calendarClassName="bg-base-100"
                  dayClassName={getDayClassName}
                />
              </div>
            </div>

            {selectedDate && (
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-medium mb-3 text-neutral-content">
                  Dostupni Termini za {format(selectedDate, "dd. MMMM yyyy'.'", { locale: srLatn })}
                </h3>
                {isLoadingSlots ? (
                  <div className="flex justify-center items-center h-24">
                     <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  </div>
                ) : slotsError ? (
                  <div role="alert" className="alert alert-warning text-sm p-3">
                    <AlertTriangle className="h-5 w-5" />
                    <span>{slotsError}</span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-base-content/70 mt-2 p-4 bg-base-100 rounded-md border border-base-300">
                    Nema dostupnih termina za odabrani datum. Molimo Vas pokušajte sa drugim datumom.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {availableSlots.map(slot => {
                      const disabledSlot = isSlotDisabled(slot);
                      return (
                        <button
                          key={slot}
                          className={`btn btn-md h-auto py-3 ${
                            selectedSlot === slot && !disabledSlot
                              ? 'btn-primary'
                              : 'btn-outline btn-ghost hover:bg-primary/10 hover:border-primary'
                          } ${disabledSlot ? 'btn-disabled !bg-base-200 !border-base-300 !text-base-content/30' : ''}`}
                          onClick={() => !disabledSlot && handleSlotSelect(slot)}
                          disabled={disabledSlot}
                          title={disabledSlot ? "Ovaj termin je unutar narednih 12 sati" : `Zakaži za ${slot}`}
                        >
                          <Clock className="h-4 w-4 mr-1.5" /> {slot}
                           {disabledSlot && <X className="h-3 w-3 ml-1 text-error/70" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <style jsx global>{`
        .react-datepicker-wrapper { display: inline-block; }
        .react-datepicker {
          font-family: inherit;
          border-color: hsl(var(--b3));
          background-color: hsl(var(--b1));
          color: hsl(var(--bc));
          border-radius: var(--rounded-box, 1rem);
          box-shadow: var(--shadow-lg, 0 25px 50px -12px rgba(0,0,0,0.25));
        }
        .react-datepicker__header {
          background-color: hsl(var(--b2));
          border-bottom-color: hsl(var(--b3));
          padding-top: 8px;
        }
        .react-datepicker__current-month,
        .react-datepicker-time__header,
        .react-datepicker-year-header {
          color: hsl(var(--bc));
          font-weight: 600;
        }
        .react-datepicker__day-name,
        .react-datepicker__day,
        .react-datepicker__time-name {
          color: hsl(var(--bc));
          width: 2.25rem;
          line-height: 2.25rem;
          margin: 0.2rem;
        }
        .react-datepicker__day--selected,
        .react-datepicker__day--in-selecting-range,
        .react-datepicker__day--in-range {
          background-color: hsl(var(--p)) !important;
          color: hsl(var(--pc)) !important;
          border-radius: var(--rounded-btn, 0.5rem);
        }
        .react-datepicker__day--selected:hover,
        .react-datepicker__day--keyboard-selected {
            background-color: hsl(var(--pf, var(--p))) !important;
            color: hsl(var(--pc)) !important;
        }
        .react-datepicker__day:not(.react-datepicker__day--selected):not(.react-datepicker__day--disabled):not(.react-datepicker__day--past):not(.react-datepicker__day--weekend):hover {
          background-color: hsl(var(--p)/0.1);
          border-radius: var(--rounded-btn, 0.5rem);
        }

        /* General style for days disabled by minDate/maxDate (but not past/weekend) */
        .react-datepicker__day--disabled:not(.react-datepicker__day--past):not(.react-datepicker__day--weekend) {
          color: hsl(var(--bc) / 0.35) !important;
          background-color: hsl(var(--b2) / 0.3) !important; 
          cursor: default !important;
        }
        .react-datepicker__day--disabled:not(.react-datepicker__day--past):not(.react-datepicker__day--weekend):hover {
          background-color: hsl(var(--b2) / 0.3) !important;
        }

        /* Style for PAST days */
        .react-datepicker__day--past {
  color: hsl(var(--bc) / 0.3) !important; /* Lighter text for disabled effect */
  background-color: hsl(var(--b2)) !important; /* Softer background tone */
  cursor: not-allowed !important; /* Standard cursor for disabled items */
  pointer-events: none !important; /* Prevent interaction */
  opacity: 0.2; /* Additional visual cue for disabled state */
        }
        .react-datepicker__day--past:hover {
          background-color: hsl(var(--b2) / 0.6) !important;
        }



        .react-datepicker__day--weekend:not(.react-datepicker__day--past):hover {
          background-color: hsl(var(--b3)) !important; /* No change on hover */
        }

        .react-datepicker__navigation {
          top: 12px;
        }
        .react-datepicker__navigation-icon::before {
          border-color: hsl(var(--bc));
          border-width: 2px 2px 0 0;
          height: 7px;
          width: 7px;
        }
        .react-datepicker__navigation:hover .react-datepicker__navigation-icon::before {
            border-color: hsl(var(--p));
        }
        .react-datepicker__month {
            margin: 0.4rem;
        }
                    /* Style for WEEKEND days (that are not past) */
        /* These will also have .react-datepicker__day--disabled due to filterDate */
        .react-datepicker__day--weekend:not(.react-datepicker__day--past) {
  color: hsl(var(--bc) / 0.3) !important; /* Lighter text for disabled effect */
  background-color: hsl(var(--b2)) !important; /* Softer background tone */
  cursor: not-allowed !important; /* Standard cursor for disabled items */
  pointer-events: none !important; /* Prevent interaction */
  opacity: 0.2; /* Additional visual cue for disabled state */
}
      `}</style>

      {selectedSlot && selectedDate && selectedServiceId && (
        <div className="mt-8 p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-2xl font-semibold mb-4 card-title text-primary flex items-center">
            <CheckCircle2 className="h-6 w-6 mr-2" /> 3. Potvrdite Vaš Zahtev za Termin
          </h2>
          <div className="mb-6 space-y-2 text-base-content/90 p-4 bg-base-100 rounded-lg border border-base-300">
            <p><span className="font-semibold">Usluga:</span> {selectedServiceName}</p>
            <p><span className="font-semibold">Datum:</span> {selectedDate ? format(selectedDate, "eeee, dd. MMMM yyyy'.'", { locale: srLatn }) : 'N/A'}</p>
            <p><span className="font-semibold">Vreme:</span> {selectedSlot}</p>
          </div>
          <button
            onClick={handleBookingSubmit}
            className={`btn btn-success btn-lg w-full sm:w-auto ${
              bookingStatus === 'submitting' ? 'btn-disabled' : ''
            }`}
            disabled={bookingStatus === 'submitting'}
          >
            {bookingStatus === 'submitting' ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Slanje Zahteva...
              </>
            ) : (
              'Pošalji Zahtev za Termin'
            )}
          </button>
          {bookingStatus === 'error' && bookingError && (
            <div role="alert" className="alert alert-error mt-4">
              <AlertTriangle className="h-6 w-6" />
              <div>
                <h3 className="font-bold">Zakazivanje Neuspešno!</h3>
                <div className="text-xs">{bookingError}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-12 text-center">
        <Link href="/" className="btn btn-ghost">
          <ArrowLeft className="h-5 w-5 mr-2" /> Nazad na Početnu
        </Link>
      </div>

      <dialog id="success_booking_modal" className="modal modal-bottom sm:modal-middle" ref={successModalRef}>
        <div className="modal-box text-center bg-base-100">
            <CheckCircle2 className="text-success h-16 w-16 mx-auto mb-4" />
          <h3 className="font-bold text-2xl text-success">Uspešno!</h3>
          <p className="py-4 text-base text-base-content">Vaš zahtev za termin je uspešno poslat. Dobićete potvrdu kada bude odobren.</p>
          <div className="modal-action justify-center">
            <form method="dialog">
              <button className="btn btn-primary" onClick={() => resetBooking()}>Odlično!</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
            <button onClick={() => resetBooking()}>zatvori</button>
        </form>
      </dialog>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<BookingPageSkeleton />}>
      <BookingForm />
    </Suspense>
  );
}

function BookingPageSkeleton() {
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
            <div className="h-10 bg-base-300 rounded w-3/4 md:w-1/2 mx-auto mb-10"></div>

            <div className="mb-8 p-6 card bg-base-200">
                <div className="h-8 bg-base-300 rounded w-1/3 mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card bg-base-100 h-36">
                            <div className="card-body p-5 space-y-3">
                                <div className="h-6 bg-base-300 rounded w-3/4"></div>
                                <div className="h-4 bg-base-300 rounded w-full"></div>
                                <div className="h-4 bg-base-300 rounded w-5/6"></div>
                                <div className="h-5 bg-base-300 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-8 p-6 card bg-base-200">
                <div className="h-8 bg-base-300 rounded w-2/5 mb-6"></div>
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                    <div className="flex-1 lg:max-w-sm">
                        <div className="h-7 bg-base-300 rounded w-1/4 mb-3"></div>
                        <div className="p-1 bg-base-100 rounded-lg inline-block">
                            <div className="h-64 w-72 bg-base-300 rounded-md"></div>
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="h-7 bg-base-300 rounded w-1/2 mb-3"></div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="h-12 bg-base-300 rounded-lg"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

             <div className="mt-8 p-6 card bg-base-200">
                <div className="h-8 bg-base-300 rounded w-1/3 mb-6"></div>
                <div className="space-y-2 p-4 bg-base-100 rounded-lg mb-6">
                    <div className="h-4 bg-base-300 rounded w-3/4"></div>
                    <div className="h-4 bg-base-300 rounded w-1/2"></div>
                    <div className="h-4 bg-base-300 rounded w-1/3"></div>
                </div>
                <div className="h-12 bg-success/50 rounded-lg w-full sm:w-1/3"></div>
            </div>

            <div className="mt-12 text-center">
                <div className="h-10 bg-base-300 rounded w-1/4 mx-auto"></div>
            </div>
        </div>
    );
}
