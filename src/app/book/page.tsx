// src/app/book/page.tsx
'use client';

import { useBookingStore } from '@/store/bookingStore';
import { useState, useEffect, Suspense, useRef } from 'react';
import type { Service, Vendor } from '@prisma/client'; // Importujemo Vendor tip
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatErrorMessage, type FormattedError } from '@/lib/errorUtils';
import { CalendarDays, Clock, ShoppingBag, AlertTriangle, CheckCircle2, ArrowLeft, Loader2, X, Store, ChevronRight } from 'lucide-react';

import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, getDay, addHours, isBefore, startOfToday, isSameDay, setHours, setMinutes, set } from 'date-fns';
import { srLatn } from 'date-fns/locale';

registerLocale('sr-Latn', srLatn);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

interface BookingErrorPayload {
  message: string;
  status?: number;
  details?: string | object;
}

// Definišemo korake u procesu zakazivanja
type BookingStep = 'SELECT_VENDOR' | 'SELECT_SERVICE' | 'SELECT_DATETIME' | 'CONFIRM';

function BookingForm() {
  const searchParams = useSearchParams();
  const successModalRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  const {
    selectedVendorId,
    selectedServiceId,
    selectedDate,
    availableSlots,
    selectedSlot,
    bookingStatus,
    bookingError,
    selectVendor,
    selectService,
    selectDate,
    setAvailableSlots,
    selectSlot: setStoreSelectedSlot,
    setBookingStatus,
    setBookingError,
    resetBookingState, // Koristimo novu akciju za kompletno resetovanje
    resetServiceAndBelow, // Pomoćna akcija
  } = useBookingStore();

  const [currentStep, setCurrentStep] = useState<BookingStep>('SELECT_VENDOR');

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoadingVendors, setIsLoadingVendors] = useState(true);
  const [vendorsError, setVendorsError] = useState<string | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // 1. Dobavljanje Salona (Vendora) na inicijalnom učitavanju
  useEffect(() => {
    const fetchVendors = async () => {
      setIsLoadingVendors(true);
      setVendorsError(null);
      try {
        const response = await fetch(`${SITE_URL}/api/vendors`); // API ruta za javnu listu salona
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw { message: `Neuspešno preuzimanje salona: ${response.status}`, status: response.status, details: errorData.message || response.statusText } as FormattedError;
        }
        const data: Vendor[] = await response.json();
        setVendors(data);

        // Ako postoji vendorId u URL-u, pokušaj da ga postaviš
        const vendorIdFromUrl = searchParams.get('vendorId');
        if (vendorIdFromUrl && data.some(v => v.id === vendorIdFromUrl)) {
          // Ne pozivamo handleVendorSelect direktno iz useEffect da izbegnemo re-render loop
          // Store će biti ažuriran, a sledeći useEffect (za usluge) će reagovati
          selectVendor(vendorIdFromUrl); 
          setCurrentStep('SELECT_SERVICE');
        } else {
          // Ako nema vendorId u URL-u, ili nije validan, resetuj store na početno stanje
          // Ovo je važno ako korisnik dođe na stranicu bez parametara ili sa nevažećim
          if(!selectedVendorId) resetBookingState();
        }
      } catch (err: unknown) {
        setVendorsError(formatErrorMessage(err, "preuzimanja salona"));
      } finally {
        setIsLoadingVendors(false);
      }
    };
    fetchVendors();
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [searchParams]); // Samo searchParams, selectVendor i resetBookingState su stabilne reference iz store-a


  // 2. Dobavljanje Usluga nakon odabira Salona
  useEffect(() => {
    if (selectedVendorId && currentStep !== 'SELECT_VENDOR') { // Dobavi usluge samo ako je salon odabran i nismo na koraku odabira salona
      const fetchServicesForVendor = async () => {
        setIsLoadingServices(true);
        setServicesError(null);
        setServices([]); 
        try {
          // API ruta /api/services mora podržavati ?vendorId=xxx
          const response = await fetch(`${SITE_URL}/api/services?vendorId=${selectedVendorId}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw { message: `Neuspešno preuzimanje usluga za salon: ${response.status}`, status: response.status, details: errorData.message || response.statusText } as FormattedError;
          }
          const data: Service[] = await response.json();
          setServices(data);

          const serviceIdFromUrl = searchParams.get('serviceId');
          if (serviceIdFromUrl && data.some(s => s.id === serviceIdFromUrl) && selectedServiceId !== serviceIdFromUrl) {
            selectService(serviceIdFromUrl);
            setCurrentStep('SELECT_DATETIME');
          } else if (data.length === 0) {
            setServicesError("Odabrani salon trenutno nema dostupnih usluga.");
          }
        } catch (err: unknown) {
          setServicesError(formatErrorMessage(err, "preuzimanja usluga za salon"));
        } finally {
          setIsLoadingServices(false);
        }
      };
      fetchServicesForVendor();
    } else if (!selectedVendorId) {
      setServices([]); // Resetuj usluge ako salon nije odabran
      if (selectedServiceId) selectService(null); // Resetuj i u store-u ako je bilo odabrano
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId, currentStep, searchParams]); // Samo selectedVendorId i searchParams, ostalo su stabilne reference

  // 3. Dobavljanje Dostupnih Termina
  useEffect(() => {
    if (selectedVendorId && selectedServiceId && selectedDate && currentStep === 'SELECT_DATETIME') {
      const fetchAvailableSlots = async () => {
        setIsLoadingSlots(true);
        setSlotsError(null);
        setAvailableSlots([]);
        try {
          const formattedDate = format(selectedDate, 'yyyy-MM-dd');
          const response = await fetch(`${SITE_URL}/api/appointments/available?vendorId=${selectedVendorId}&serviceId=${selectedServiceId}&date=${formattedDate}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Termini nisu dostupni: ${response.statusText}` }));
            throw { message: `Neuspešno preuzimanje dostupnih termina: ${response.status}`, status: response.status, details: errorData.message || errorData.availableSlots?.message || response.statusText } as FormattedError;
          }
          const data: { availableSlots: string[], message?: string } = await response.json();
          
          if (data.message && data.availableSlots.length === 0) {
            setSlotsError(data.message);
            setAvailableSlots([]);
          } else {
            let slots = data.availableSlots;
            const currentMinBookingTime = addHours(new Date(), 12); // Ne može se zakazati termin u sledećih 12 sati
            if (isSameDay(selectedDate, new Date())) {
              slots = slots.filter(slot => {
                const [hours, minutes] = slot.split(':').map(Number);
                const slotDateTime = setMinutes(setHours(selectedDate, hours), minutes);
                return isBefore(currentMinBookingTime, slotDateTime);
              });
            }
            setAvailableSlots(slots);
          }
        } catch (err: unknown) {
          setSlotsError(formatErrorMessage(err, "preuzimanja dostupnih termina"));
        } finally {
          setIsLoadingSlots(false);
        }
      };
      fetchAvailableSlots();
    } else {
      setAvailableSlots([]);
      //if (selectedSlot) setStoreSelectedSlot(null); // Resetuj odabrani slot ako nema datuma/usluge/salona
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId, selectedServiceId, selectedDate, currentStep]); // Samo zavisnosti koje pokreću fetch

  const handleVendorSelect = (vendorId: string) => {
    selectVendor(vendorId); // Akcija iz store-a, resetuje service, date, slot
    setCurrentStep('SELECT_SERVICE');
    setServicesError(null); setSlotsError(null); setBookingError(null);
  };

  const handleServiceSelect = (serviceId: string) => {
    selectService(serviceId);
    setCurrentStep('SELECT_DATETIME');
    setSlotsError(null); setBookingError(null);
  };

  const handleDateSelect = (date: Date | null) => {
    if (date && isBefore(date, startOfToday()) && !isSameDay(date, startOfToday())) {
      selectDate(startOfToday()); // Ako je prošli datum, postavi na današnji
    } else {
      selectDate(date);
    }
    // Ostajemo na SELECT_DATETIME koraku
    setSlotsError(null); setBookingError(null);
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
    setCurrentStep('CONFIRM');
    setBookingError(null);
  };

  const handleBookingSubmit = async () => {
    if (!selectedVendorId || !selectedServiceId || !selectedDate || !selectedSlot) {
      setBookingError("Molimo Vas odaberite salon, uslugu, datum i vreme termina.");
      setBookingStatus('error');
      return;
    }
    setBookingStatus('submitting');
    setBookingError(null);
    try {
      // const formattedDate = format(selectedDate, 'yyyy-MM-dd'); // Nije više potrebno slati date i slot odvojeno
      const startTime = set(selectedDate, { // Kombinujemo datum i vreme slota
        hours: parseInt(selectedSlot.split(':')[0]),
        minutes: parseInt(selectedSlot.split(':')[1]),
        seconds: 0,
        milliseconds: 0,
      });

      const response = await fetch(`${SITE_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: selectedVendorId,
          serviceId: selectedServiceId,
          startTime: startTime.toISOString(), // Šaljemo kao ISO string
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
      // Resetujemo samo deo store-a, zadržavajući odabrani salon
      useBookingStore.getState().resetServiceAndBelow();
      setCurrentStep('SELECT_SERVICE'); // Vrati na odabir usluge za isti salon

    } catch (err: unknown) {
      setBookingStatus('error');
      setBookingError(formatErrorMessage(err, "slanja zahteva za zakazivanje"));
    }
  };
  
  const selectedVendorName = vendors.find(v => v.id === selectedVendorId)?.name || 'Salon';
  const selectedServiceName = services.find(s => s.id === selectedServiceId)?.name || 'Usluga';

  const isWeekday = (date: Date) => {
    const day = getDay(date);
    return day !== 0 && day !== 6; // Nedelja (0) i Subota (6) su neaktivne
  };

  const getDayClassName = (date: Date): string => {
    if (isBefore(date, startOfToday()) && !isSameDay(date, startOfToday())) {
      return "react-datepicker__day--past react-datepicker__day--disabled";
    }
    if (!isWeekday(date)) {
      return "react-datepicker__day--weekend react-datepicker__day--disabled";
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

  const StepIndicator = ({ step, title, current, onClick, isEnabled }: {step: BookingStep, title: string, current: BookingStep, onClick?: () => void, isEnabled: boolean}) => {
    const isActive = step === current;
    const isCompleted = 
        (current === 'SELECT_SERVICE' && step === 'SELECT_VENDOR') ||
        (current === 'SELECT_DATETIME' && (step === 'SELECT_VENDOR' || step === 'SELECT_SERVICE')) ||
        (current === 'CONFIRM' && (step === 'SELECT_VENDOR' || step === 'SELECT_SERVICE' || step === 'SELECT_DATETIME'));

    return (
        <button 
            onClick={onClick} 
            disabled={!isEnabled || isActive}
            className={`step ${isActive || isCompleted ? 'step-primary' : ''} ${!isEnabled && !isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            {title}
        </button>
    )
  }

  const handleGoToStep = (step: BookingStep) => {
    if (step === 'SELECT_VENDOR') {
        selectVendor(null); // Ovo će resetovati sve ispod
    } else if (step === 'SELECT_SERVICE') {
        selectService(null); // Ovo će resetovati datum i slot
    } else if (step === 'SELECT_DATETIME') {
        selectDate(null); // Ovo će resetovati slot
    }
    setCurrentStep(step);
  }


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-content">
          Zakažite Vaš Termin
        </h1>
        <p className="text-lg text-neutral-content/80 mt-2">Brzo i lako do savršene frizure.</p>
      </div>

      <ul className="steps w-full mb-10">
        <StepIndicator step="SELECT_VENDOR" title="1. Salon" current={currentStep} onClick={() => handleGoToStep('SELECT_VENDOR')} isEnabled={true} />
        <StepIndicator step="SELECT_SERVICE" title="2. Usluga" current={currentStep} onClick={() => handleGoToStep('SELECT_SERVICE')} isEnabled={!!selectedVendorId} />
        <StepIndicator step="SELECT_DATETIME" title="3. Vreme" current={currentStep} onClick={() => handleGoToStep('SELECT_DATETIME')} isEnabled={!!selectedServiceId} />
        <StepIndicator step="CONFIRM" title="4. Potvrda" current={currentStep} onClick={() => handleGoToStep('CONFIRM')} isEnabled={!!selectedSlot} />
      </ul>

      {/* Korak 1: Odabir Salona */}
      {currentStep === 'SELECT_VENDOR' && (
        <section id="select-vendor" className="mb-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 card-title text-primary flex items-center">
            <Store className="h-6 w-6 mr-2" /> 1. Odaberite Salon
          </h2>
          {isLoadingVendors ? (
            <div className="flex justify-center items-center h-32"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> </div>
          ) : vendorsError ? (
            <div role="alert" className="alert alert-error"> <AlertTriangle className="h-6 w-6" /> <span>{vendorsError}</span> </div>
          ) : vendors.length === 0 ? (
            <div role="alert" className="alert alert-warning"> <AlertTriangle className="h-6 w-6" /> <span>Trenutno nema dostupnih salona.</span> </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className={`card bordered cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md transform hover:-translate-y-1 ${
                    selectedVendorId === vendor.id ? 'border-2 border-primary ring-2 ring-primary/50 bg-primary/10 shadow-lg' : 'bg-base-100 border-base-300 hover:border-primary/70'
                  }`}
                  onClick={() => handleVendorSelect(vendor.id)}
                  tabIndex={0}
                  onKeyPress={(e) => e.key === 'Enter' && handleVendorSelect(vendor.id)}
                >
                  <div className="card-body p-4 sm:p-5">
                    <h3 className="card-title text-lg">{vendor.name}</h3>
                    <p className="text-sm text-base-content/70 mb-1 line-clamp-2 h-10"> {vendor.description || "Nema opisa."} </p>
                    {vendor.address && <p className="text-xs text-base-content/60">{vendor.address}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Korak 2: Odabir Usluge */}
      {currentStep === 'SELECT_SERVICE' && selectedVendorId && (
        <section id="select-service" className="mb-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 card-title text-primary flex items-center">
            <ShoppingBag className="h-6 w-6 mr-2" /> 2. Odaberite Uslugu u salonu &quot;{selectedVendorName}&quot;
          </h2>
          {isLoadingServices ? (
            <div className="flex justify-center items-center h-32"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> </div>
          ) : servicesError ? (
            <div role="alert" className="alert alert-error"> <AlertTriangle className="h-6 w-6" /> <span>{servicesError}</span> </div>
          ) : services.length === 0 ? (
            <div role="alert" className="alert alert-info"> <AlertTriangle className="h-6 w-6" /> <span>Ovaj salon trenutno nema dostupnih usluga.</span> </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div
                  key={service.id}
                  className={`card bordered cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md transform hover:-translate-y-1 ${
                    selectedServiceId === service.id ? 'border-2 border-primary ring-2 ring-primary/50 bg-primary/10 shadow-lg' : 'bg-base-100 border-base-300 hover:border-primary/70'
                  }`}
                  onClick={() => handleServiceSelect(service.id)}
                  tabIndex={0}
                  onKeyPress={(e) => e.key === 'Enter' && handleServiceSelect(service.id)}
                >
                  <div className="card-body p-4 sm:p-5">
                    <h3 className="card-title text-lg">{service.name}</h3>
                    <p className="text-sm text-base-content/70 mb-1 line-clamp-2 h-10"> {service.description || "Nema detaljnog opisa."} </p>
                    <p className="font-semibold text-base-content/90">{service.price.toFixed(2)} RSD - {service.duration} min</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Korak 3: Odabir Datuma i Vremena */}
      {currentStep === 'SELECT_DATETIME' && selectedVendorId && selectedServiceId && (
        <section id="select-datetime" className="mb-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-6 card-title text-primary flex items-center">
            <CalendarDays className="h-6 w-6 mr-2" /> 3. Odaberite Datum i Vreme za &quot;{selectedServiceName}&quot; u &quot;{selectedVendorName}&quot;
          </h2>
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            <div className="flex-1 lg:max-w-xs mx-auto lg:mx-0">
              <h3 className="text-lg font-medium mb-3 text-neutral-content text-center lg:text-left">Datum</h3>
              <div className="p-1 border rounded-lg inline-block bg-base-100 border-base-300 shadow-sm">
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateSelect}
                  dateFormat="dd.MM.yyyy"
                  minDate={startOfToday()} // Omogući današnji dan, slotovi će biti filtrirani
                  filterDate={isWeekday}
                  inline
                  locale="sr-Latn"
                  calendarClassName="bg-base-100"
                  dayClassName={getDayClassName}
                />
              </div>
            </div>

            {selectedDate && (
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium mb-3 text-neutral-content">
                  Dostupni Termini za {format(selectedDate, "dd. MMMM yy'.'", { locale: srLatn })}
                </h3>
                {isLoadingSlots ? (
                  <div className="flex justify-center items-center h-24"> <Loader2 className="h-10 w-10 animate-spin text-primary" /> </div>
                ) : slotsError ? (
                  <div role="alert" className="alert alert-warning text-sm p-3"> <AlertTriangle className="h-5 w-5" /> <span>{slotsError}</span> </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-base-content/70 mt-2 p-4 bg-base-100 rounded-md border border-base-300"> Nema dostupnih termina za odabrani datum. Molimo Vas pokušajte sa drugim datumom. </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                    {availableSlots.map(slot => {
                      const disabledSlot = isSlotDisabled(slot);
                      return (
                        <button
                          key={slot}
                          className={`btn btn-md h-auto py-2.5 sm:py-3 text-sm sm:text-base ${
                            selectedSlot === slot && !disabledSlot ? 'btn-primary' : 'btn-outline btn-ghost hover:bg-primary/10 hover:border-primary'
                          } ${disabledSlot ? 'btn-disabled !bg-base-200 !border-base-300 !text-base-content/30' : ''}`}
                          onClick={() => !disabledSlot && handleSlotSelect(slot)}
                          disabled={disabledSlot}
                          title={disabledSlot ? "Ovaj termin je unutar narednih 12 sati" : `Zakaži za ${slot}`}
                        >
                          <Clock className="h-4 w-4 mr-1 sm:mr-1.5" /> {slot}
                           {disabledSlot && <X className="h-3 w-3 ml-1 text-error/70" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
      
      {/* Korak 4: Potvrda */}
      {currentStep === 'CONFIRM' && selectedVendorId && selectedServiceId && selectedDate && selectedSlot && (
        <section id="confirm-booking" className="mt-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 card-title text-primary flex items-center">
            <CheckCircle2 className="h-6 w-6 mr-2" /> 4. Potvrdite Vaš Zahtev za Termin
          </h2>
          <div className="mb-6 space-y-2 text-base-content/90 p-4 bg-base-100 rounded-lg border border-base-300">
            <p><span className="font-semibold">Salon:</span> {selectedVendorName}</p>
            <p><span className="font-semibold">Usluga:</span> {selectedServiceName}</p>
            <p><span className="font-semibold">Datum:</span> {format(selectedDate, "eeee, dd. MMMM yy'.'", { locale: srLatn })}</p>
            <p><span className="font-semibold">Vreme:</span> {selectedSlot}</p>
          </div>
          <button
            onClick={handleBookingSubmit}
            className={`btn btn-success btn-lg w-full sm:w-auto ${ bookingStatus === 'submitting' ? 'btn-disabled' : '' }`}
            disabled={bookingStatus === 'submitting'}
          >
            {bookingStatus === 'submitting' ? (
              <> <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Slanje Zahteva... </>
            ) : ( 'Pošalji Zahtev za Termin' )}
          </button>
          {bookingStatus === 'error' && bookingError && (
            <div role="alert" className="alert alert-error mt-4"> <AlertTriangle className="h-6 w-6" /> <div> <h3 className="font-bold">Zakazivanje Neuspešno!</h3> <div className="text-xs">{bookingError}</div> </div> </div>
          )}
        </section>
      )}

      {/* Link za povratak */}
      {(currentStep !== 'SELECT_VENDOR' || vendorsError || servicesError || slotsError) && (
         <div className="mt-12 text-center">
            <button onClick={() => {
                if (currentStep === 'SELECT_SERVICE') { handleGoToStep('SELECT_VENDOR'); }
                else if (currentStep === 'SELECT_DATETIME') { handleGoToStep('SELECT_SERVICE'); }
                else if (currentStep === 'CONFIRM') { handleGoToStep('SELECT_DATETIME'); }
                else { router.back(); }
            }} className="btn btn-ghost">
            <ArrowLeft className="h-5 w-5 mr-2" /> Nazad
            </button>
         </div>
      )}

      {/* Modal za uspešnu rezervaciju */}
      <dialog id="success_booking_modal" className="modal modal-bottom sm:modal-middle" ref={successModalRef}>
        <div className="modal-box text-center bg-base-100">
            <CheckCircle2 className="text-success h-16 w-16 mx-auto mb-4" />
          <h3 className="font-bold text-2xl text-success">Uspešno!</h3>
          <p className="py-4 text-base text-base-content">Vaš zahtev za termin je uspešno poslat. Dobićete potvrdu kada bude odobren.</p>
          <div className="modal-action justify-center">
            <form method="dialog">
              <button className="btn btn-primary" onClick={() => { resetBookingState(); setCurrentStep('SELECT_VENDOR');}}>Odlično!</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
            <button onClick={() => { resetBookingState(); setCurrentStep('SELECT_VENDOR');}}>zatvori</button>
        </form>
      </dialog>
      
      <style jsx global>{`
        /* CSS za DatePicker ostaje isti kao u prethodnoj verziji */
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
        .react-datepicker__day--in-range,
        .react-datepicker__day--keyboard-selected {
          background-color: hsl(var(--p)) !important;
          color: hsl(var(--pc)) !important;
          border-radius: var(--rounded-btn, 0.5rem);
        }
        .react-datepicker__day--selected:hover {
            background-color: hsl(var(--pf, var(--p))) !important;
        }
        .react-datepicker__day:not(.react-datepicker__day--selected):not(.react-datepicker__day--disabled):not(.react-datepicker__day--past):not(.react-datepicker__day--weekend):hover {
          background-color: hsl(var(--p)/0.1);
          border-radius: var(--rounded-btn, 0.5rem);
        }
        .react-datepicker__day--disabled,
        .react-datepicker__day--past,
        .react-datepicker__day--weekend:not(.react-datepicker__day--selected) { /* Ciljamo vikende koji nisu selektovani */
          color: hsl(var(--bc) / 0.3) !important;
          background-color: hsl(var(--b2) / 0.5) !important; 
          cursor: not-allowed !important;
          pointer-events: none !important;
          opacity: 0.5;
        }
         .react-datepicker__day--disabled:hover,
        .react-datepicker__day--past:hover,
        .react-datepicker__day--weekend:not(.react-datepicker__day--selected):hover {
            background-color: hsl(var(--b2) / 0.6) !important;
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
      `}</style>
    </div>
  );
}

export default function BookingPage() {
  return (
    // Omotavamo BookingForm sa Suspense da bismo mogli da koristimo useSearchParams
    <Suspense fallback={<BookingPageSkeleton />}>
      <BookingForm />
    </Suspense>
  );
}

function BookingPageSkeleton() {
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
            <div className="h-10 bg-base-300 rounded w-3/4 md:w-1/2 mx-auto mb-10"></div>
            {/* Skeleton za korake */}
            <div className="flex justify-around mb-10">
                <div className="h-8 bg-base-300 rounded w-1/5"></div>
                <div className="h-8 bg-base-300 rounded w-1/5 opacity-50"></div>
                <div className="h-8 bg-base-300 rounded w-1/5 opacity-50"></div>
                <div className="h-8 bg-base-300 rounded w-1/5 opacity-50"></div>
            </div>

            {/* Skeleton za odabir salona */}
            <div className="mb-8 p-6 card bg-base-200">
                <div className="h-8 bg-base-300 rounded w-1/3 mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                        <div key={i} className="card bg-base-100 h-28">
                            <div className="card-body p-5 space-y-2">
                                <div className="h-6 bg-base-300 rounded w-3/4"></div>
                                <div className="h-4 bg-base-300 rounded w-full"></div>
                                <div className="h-4 bg-base-300 rounded w-5/6"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Skeleton za ostale korake (usluga, datum/vreme, potvrda) - mogu se dodati po potrebi */}
            <div className="mb-8 p-6 card bg-base-200 opacity-50">
                <div className="h-8 bg-base-300 rounded w-2/5 mb-6"></div>
                 <div className="h-20 bg-base-100 rounded"></div>
            </div>
             <div className="mb-8 p-6 card bg-base-200 opacity-50">
                <div className="h-8 bg-base-300 rounded w-2/5 mb-6"></div>
                 <div className="h-20 bg-base-100 rounded"></div>
            </div>

            <div className="mt-12 text-center">
                <div className="h-10 bg-base-300 rounded w-1/4 mx-auto"></div>
            </div>
        </div>
    );
}
