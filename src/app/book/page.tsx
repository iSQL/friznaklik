// src/app/book/page.tsx
'use client';

import { useBookingStore, type SlotWithWorkers, type WorkerInfo } from '@/store/bookingStore';
import { useState, useEffect, Suspense, useRef } from 'react';
import type { Service, Vendor } from '@prisma/client';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatErrorMessage, type FormattedError } from '@/lib/errorUtils';
import { CalendarDays, Clock, ShoppingBag, AlertTriangle, CheckCircle2, ArrowLeft, Loader2, X, Store, Users, MessageSquare } from 'lucide-react'; // Added MessageSquare

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

type BookingStep = 'SELECT_VENDOR' | 'SELECT_SERVICE' | 'SELECT_DATETIME' | 'CONFIRM';

function BookingForm() {
  const searchParams = useSearchParams();
  const successModalRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  const {
    selectedVendorId,
    selectedServiceId,
    selectedDate,
    availableSlotsData,
    selectedSlotTime,
    selectedWorkerForBookingId,
    bookingNotes, // Get notes from store
    bookingStatus,
    bookingError,
    selectVendor,
    selectService,
    selectDate,
    setAvailableSlotsData,
    selectSlotTime,
    selectWorkerForBooking,
    setBookingNotes, // Get action for notes
    setBookingStatus,
    setBookingError,
    resetBookingState,
    resetServiceAndBelow,
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

  const [workersForSelectedSlot, setWorkersForSelectedSlot] = useState<WorkerInfo[]>([]);

  useEffect(() => {
    const fetchVendors = async () => {
      setIsLoadingVendors(true);
      setVendorsError(null);
      try {
        const response = await fetch(`${SITE_URL}/api/vendors`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw { message: `Neuspešno preuzimanje salona: ${response.status}`, status: response.status, details: errorData.message || response.statusText } as FormattedError;
        }
        const data: Vendor[] = await response.json();
        setVendors(data);

        const vendorIdFromUrl = searchParams.get('vendorId');
        if (vendorIdFromUrl && data.some(v => v.id === vendorIdFromUrl)) {
          if (selectedVendorId !== vendorIdFromUrl) selectVendor(vendorIdFromUrl);
          setCurrentStep('SELECT_SERVICE');
        } else if (!selectedVendorId && data.length > 0) {
           if (data.length === 1) {
             // selectVendor(data[0].id);
             // setCurrentStep('SELECT_SERVICE');
           }
        } else if (selectedVendorId && data.some(v => v.id === selectedVendorId)) {
            setCurrentStep('SELECT_SERVICE');
        } else if (selectedVendorId && !data.some(v => v.id === selectedVendorId)) {
            resetBookingState();
            setCurrentStep('SELECT_VENDOR');
        }
      } catch (err: unknown) {
        setVendorsError(formatErrorMessage(err, "preuzimanja salona"));
      } finally {
        setIsLoadingVendors(false);
      }
    };
    fetchVendors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);


  useEffect(() => {
    if (selectedVendorId && currentStep !== 'SELECT_VENDOR') {
      const fetchServicesForVendor = async () => {
        setIsLoadingServices(true);
        setServicesError(null);
        setServices([]);
        try {
          const response = await fetch(`${SITE_URL}/api/services?vendorId=${selectedVendorId}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw { message: `Neuspešno preuzimanje usluga za salon: ${response.status}`, status: response.status, details: errorData.message || response.statusText } as FormattedError;
          }
          const data: Service[] = await response.json();
          setServices(data);

          const serviceIdFromUrl = searchParams.get('serviceId');
          const serviceNameFromUrl = searchParams.get('serviceName'); // For pre-selection if ID matches
          
          if (serviceIdFromUrl && data.some(s => s.id === serviceIdFromUrl)) {
            if(selectedServiceId !== serviceIdFromUrl) selectService(serviceIdFromUrl);
            setCurrentStep('SELECT_DATETIME');
          } else if (data.length === 0) {
            setServicesError("Odabrani salon trenutno nema dostupnih aktivnih usluga.");
          }
        } catch (err: unknown) {
          setServicesError(formatErrorMessage(err, "preuzimanja usluga za salon"));
        } finally {
          setIsLoadingServices(false);
        }
      };
      fetchServicesForVendor();
    } else if (!selectedVendorId) {
      setServices([]);
      if (selectedServiceId) selectService(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId, currentStep, searchParams]);

  useEffect(() => {
    if (selectedVendorId && selectedServiceId && selectedDate && currentStep === 'SELECT_DATETIME') {
      const fetchAvailableSlots = async () => {
        setIsLoadingSlots(true);
        setSlotsError(null);
        setAvailableSlotsData([]);
        setWorkersForSelectedSlot([]);
        try {
          const formattedDate = format(selectedDate, 'yyyy-MM-dd');
          const response = await fetch(`${SITE_URL}/api/appointments/available?vendorId=${selectedVendorId}&serviceId=${selectedServiceId}&date=${formattedDate}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Termini nisu dostupni: ${response.statusText}` }));
            throw { message: `Neuspešno preuzimanje dostupnih termina: ${response.status}`, status: response.status, details: errorData.message || errorData.availableSlots?.message || response.statusText } as FormattedError;
          }
          const data: { availableSlots: SlotWithWorkers[], message?: string } = await response.json();

          if (data.message && data.availableSlots.length === 0) {
            setSlotsError(data.message);
            setAvailableSlotsData([]);
          } else {
            let slotsData = data.availableSlots;
            const currentMinBookingTime = addHours(new Date(), 1); // Allow booking 1 hour from now
            if (isSameDay(selectedDate, new Date())) {
              slotsData = slotsData.filter(slot => {
                const [hours, minutes] = slot.time.split(':').map(Number);
                const slotDateTime = setMinutes(setHours(selectedDate, hours), minutes);
                return isBefore(currentMinBookingTime, slotDateTime);
              });
            }
            setAvailableSlotsData(slotsData);
          }
        } catch (err: unknown) {
          setSlotsError(formatErrorMessage(err, "preuzimanja dostupnih termina"));
        } finally {
          setIsLoadingSlots(false);
        }
      };
      fetchAvailableSlots();
    } else {
      setAvailableSlotsData([]);
      setWorkersForSelectedSlot([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId, selectedServiceId, selectedDate, currentStep]);

  const handleVendorSelect = (vendorId: string) => {
    selectVendor(vendorId);
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
      selectDate(startOfToday());
    } else {
      selectDate(date);
    }
    setSlotsError(null); setBookingError(null);
    setWorkersForSelectedSlot([]);
  };

  const handleSlotSelect = (slotData: SlotWithWorkers) => {
    const currentMinBookingTime = addHours(new Date(), 1);
    if (selectedDate && isSameDay(selectedDate, new Date())) {
        const [hours, minutes] = slotData.time.split(':').map(Number);
        const slotDateTime = setMinutes(setHours(selectedDate, hours), minutes);
        if (isBefore(slotDateTime, currentMinBookingTime)) {
            setBookingError("Odabrani termin je unutar narednih sat vremena i ne može se rezervisati.");
            selectSlotTime(null);
            setWorkersForSelectedSlot([]);
            return;
        }
    }
    selectSlotTime(slotData.time);
    setWorkersForSelectedSlot(slotData.availableWorkers || []);
    // Default worker selection is handled in the store's selectSlotTime action
    setCurrentStep('CONFIRM');
    setBookingError(null);
  };

  const handleBookingSubmit = async () => {
    if (!selectedVendorId || !selectedServiceId || !selectedDate || !selectedSlotTime) {
      setBookingError("Molimo Vas odaberite salon, uslugu, datum i vreme termina.");
      setBookingStatus('error');
      return;
    }
    setBookingStatus('submitting');
    setBookingError(null);
    try {
      const startTime = set(selectedDate, {
        hours: parseInt(selectedSlotTime.split(':')[0]),
        minutes: parseInt(selectedSlotTime.split(':')[1]),
        seconds: 0,
        milliseconds: 0,
      });

      const response = await fetch(`${SITE_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: selectedVendorId,
          serviceId: selectedServiceId,
          startTime: startTime.toISOString(),
          workerId: selectedWorkerForBookingId,
          notes: bookingNotes, // Send notes
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
      useBookingStore.getState().resetServiceAndBelow(); // Resets service, date, slot, worker, notes
      setWorkersForSelectedSlot([]);
      setCurrentStep('SELECT_SERVICE');

    } catch (err: unknown) {
      setBookingStatus('error');
      setBookingError(formatErrorMessage(err, "slanja zahteva za zakazivanje"));
    }
  };

  const selectedVendorName = vendors.find(v => v.id === selectedVendorId)?.name || 'Salon';
  const selectedServiceName = services.find(s => s.id === selectedServiceId)?.name || 'Usluga';
  const selectedWorkerName = workersForSelectedSlot.find(w => w.id === selectedWorkerForBookingId)?.name || 'Bilo koji dostupan';


  const isWeekday = (date: Date) => {
    const day = getDay(date);
    return day !== 0 && day !== 6;
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

  const isSlotDisabled = (slotTime: string): boolean => {
    const currentMinBookingTime = addHours(new Date(), 1);
    if (selectedDate && isSameDay(selectedDate, new Date())) {
        const [hours, minutes] = slotTime.split(':').map(Number);
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
        selectVendor(null); // This will reset service, date, slot, worker, notes via store logic
    } else if (step === 'SELECT_SERVICE') {
        selectService(null); // This will reset date, slot, worker, notes
    } else if (step === 'SELECT_DATETIME') {
        selectDate(null); // This will reset slot, worker, notes
        setWorkersForSelectedSlot([]);
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
        <StepIndicator step="CONFIRM" title="4. Potvrda" current={currentStep} onClick={() => handleGoToStep('CONFIRM')} isEnabled={!!selectedSlotTime} />
      </ul>

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
            <div role="alert" className="alert alert-info"> <AlertTriangle className="h-6 w-6" /> <span>Trenutno nema aktivnih salona. Molimo pokušajte kasnije.</span> </div>
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
            <div role="alert" className="alert alert-info"> <AlertTriangle className="h-6 w-6" /> <span>Ovaj salon trenutno nema dostupnih aktivnih usluga.</span> </div>
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
                  minDate={startOfToday()}
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
                ) : availableSlotsData.length === 0 ? (
                  <p className="text-base-content/70 mt-2 p-4 bg-base-100 rounded-md border border-base-300"> Nema dostupnih termina za odabrani datum. Molimo Vas pokušajte sa drugim datumom. </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                    {availableSlotsData.map(slotData => {
                      const disabledSlot = isSlotDisabled(slotData.time);
                      return (
                        <button
                          key={slotData.time}
                          className={`btn btn-md h-auto py-2.5 sm:py-3 text-sm sm:text-base ${
                            selectedSlotTime === slotData.time && !disabledSlot ? 'btn-primary' : 'btn-outline btn-ghost hover:bg-primary/10 hover:border-primary'
                          } ${disabledSlot ? 'btn-disabled !bg-base-200 !border-base-300 !text-base-content/30' : ''}`}
                          onClick={() => !disabledSlot && handleSlotSelect(slotData)}
                          disabled={disabledSlot}
                          title={disabledSlot ? "Ovaj termin je unutar narednih sat vremena" : `Zakaži za ${slotData.time}`}
                        >
                          <Clock className="h-4 w-4 mr-1 sm:mr-1.5" /> {slotData.time}
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

      {currentStep === 'CONFIRM' && selectedVendorId && selectedServiceId && selectedDate && selectedSlotTime && (
        <section id="confirm-booking" className="mt-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 card-title text-primary flex items-center">
            <CheckCircle2 className="h-6 w-6 mr-2" /> 4. Potvrdite Vaš Zahtev za Termin
          </h2>
          <div className="mb-6 space-y-3 text-base-content/90 p-4 bg-base-100 rounded-lg border border-base-300">
            <p><span className="font-semibold">Salon:</span> {selectedVendorName}</p>
            <p><span className="font-semibold">Usluga:</span> {selectedServiceName}</p>
            <p><span className="font-semibold">Datum:</span> {format(selectedDate, "eeee, dd. MMMM yy'.'", { locale: srLatn })}</p>
            <p><span className="font-semibold">Vreme:</span> {selectedSlotTime}</p>

            {workersForSelectedSlot.length > 0 && (
                <div className="form-control w-full max-w-md mt-3">
                    <label className="label" htmlFor="workerSelect">
                        <span className="label-text font-semibold flex items-center"><Users className="h-4 w-4 mr-2"/>Odaberite Radnika:</span>
                    </label>
                    <select
                        id="workerSelect"
                        className="select select-bordered select-sm"
                        value={selectedWorkerForBookingId || ""}
                        onChange={(e) => selectWorkerForBooking(e.target.value || null)}
                    >
                        <option value="">Bilo koji dostupan radnik</option>
                        {workersForSelectedSlot.map(worker => (
                            <option key={worker.id} value={worker.id}>
                                {worker.name || `Radnik ${worker.id.substring(0,6)}...`}
                            </option>
                        ))}
                    </select>
                </div>
            )}
             <p className="text-sm mt-1"><span className="font-semibold">Izabrani radnik:</span> {selectedWorkerName}</p>

            <div className="form-control w-full mt-3">
                <label className="label" htmlFor="bookingNotes">
                    <span className="label-text font-semibold flex items-center"><MessageSquare className="h-4 w-4 mr-2"/>Napomena (opciono):</span>
                </label>
                <textarea
                    id="bookingNotes"
                    className="textarea textarea-bordered h-24"
                    placeholder="Dodatne informacije ili želje..."
                    value={bookingNotes || ''}
                    onChange={(e) => setBookingNotes(e.target.value)}
                ></textarea>
            </div>
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
        .react-datepicker__day--weekend:not(.react-datepicker__day--selected) {
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
    <Suspense fallback={<BookingPageSkeleton />}>
      <BookingForm />
    </Suspense>
  );
}

function BookingPageSkeleton() {
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
            <div className="h-10 bg-base-300 rounded w-3/4 md:w-1/2 mx-auto mb-10"></div>
            <div className="flex justify-around mb-10">
                <div className="h-8 bg-base-300 rounded w-1/5"></div>
                <div className="h-8 bg-base-300 rounded w-1/5 opacity-50"></div>
                <div className="h-8 bg-base-300 rounded w-1/5 opacity-50"></div>
                <div className="h-8 bg-base-300 rounded w-1/5 opacity-50"></div>
            </div>
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
