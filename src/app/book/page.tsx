'use client';

import { useBookingStore, type SlotWithWorkers } from '@/store/bookingStore';
import { useState, useEffect, Suspense, useRef } from 'react';
import type { Service, Vendor } from '@prisma/client';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { formatErrorMessage } from '@/lib/errorUtils';
import { CalendarDays, Clock, ShoppingBag, AlertTriangle, CheckCircle2, ArrowLeft, Loader2, X, Users, Building2, Info, UserCog, UserCircle as UserAvatarIcon } from 'lucide-react';

import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css'; 
import { format, getDay, addHours, isBefore, isSameDay, setHours, setMinutes, set, startOfTomorrow, isToday } from 'date-fns';
import { srLatn } from 'date-fns/locale';

registerLocale('sr-Latn', srLatn);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

interface BookingErrorPayload {
  message: string;
  status?: number;
  details?: string | object;
}

interface PublicWorkerInfo {
  id: string;
  name: string | null;
  photoUrl?: string | null;
  bio?: string | null;
}

type BookingStep = 'SELECT_VENDOR' | 'SELECT_SERVICE' | 'SELECT_WORKER' | 'SELECT_DATETIME' | 'CONFIRM';

function BookingForm() {
  const searchParams = useSearchParams();
  const successModalRef = useRef<HTMLDialogElement>(null);

  const {
    selectedVendorId,
    selectedServiceId,
    preferredWorkerIdForFilter,
    selectedDate,
    availableSlotsData,
    selectedSlotTime,
    selectedWorkerForBookingId,
    bookingNotes,
    bookingStatus,
    bookingError,
    allVendors: storeAllVendors,
    isLoadingAllVendors: storeIsLoadingAllVendors,
    isHydrated,
    selectVendor,
    selectService,
    selectPreferredWorkerForFilter,
    selectDate,
    setAvailableSlotsData,
    selectSlotTime,
    setBookingNotes,
    setBookingStatus,
    setBookingError,
    resetServiceAndBelow,
    resetWorkerAndBelow,
    fetchAndSetAllVendors,
  } = useBookingStore();

  const [currentStep, setCurrentStep] = useState<BookingStep>('SELECT_VENDOR');

  const [vendors, setVendors] = useState<Vendor[]>(storeAllVendors);
  const [isLoadingVendors, setIsLoadingVendors] = useState(storeIsLoadingAllVendors);
  const [vendorsError, setVendorsError] = useState<string | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [qualifiedWorkers, setQualifiedWorkers] = useState<PublicWorkerInfo[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [workersError, setWorkersError] = useState<string | null>(null);

  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // Effect for initial vendor loading and selection from URL/store
  useEffect(() => {
    if (!isHydrated) return;
    setIsLoadingVendors(storeIsLoadingAllVendors);
    setVendors(storeAllVendors);

    if (!storeIsLoadingAllVendors && storeAllVendors.length === 0 && !selectedVendorId) {
        setVendorsError("Nema dostupnih salona. Molimo proverite kasnije.");
    }

    const vendorIdFromUrl = searchParams.get('vendorId');

    if (currentStep === 'SELECT_VENDOR') {
        if (vendorIdFromUrl && storeAllVendors.some(v => v.id === vendorIdFromUrl)) {
            if (selectedVendorId !== vendorIdFromUrl) selectVendor(vendorIdFromUrl);
            setCurrentStep('SELECT_SERVICE');
        } else if (selectedVendorId && storeAllVendors.some(v => v.id === selectedVendorId)) {
            setCurrentStep(selectedServiceId ? 'SELECT_WORKER' : 'SELECT_SERVICE');
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, storeIsLoadingAllVendors, storeAllVendors, searchParams]);

  useEffect(() => {
    if (isHydrated && storeAllVendors.length === 0 && !storeIsLoadingAllVendors) {
      fetchAndSetAllVendors().catch(err => setVendorsError(formatErrorMessage(err, "inicijalnog preuzimanja salona")));
    }
  }, [isHydrated, storeAllVendors.length, storeIsLoadingAllVendors, fetchAndSetAllVendors]);

  // Fetch services for selected vendor
  useEffect(() => {
    if (selectedVendorId && (currentStep === 'SELECT_SERVICE' || currentStep === 'SELECT_WORKER' || currentStep === 'SELECT_DATETIME' || currentStep === 'CONFIRM')) {
      if (services.length > 0 && services[0].vendorId === selectedVendorId && currentStep !== 'SELECT_SERVICE') {
        return;
      }
      setIsLoadingServices(true);
      setServicesError(null);
      setServices([]);
      fetch(`${SITE_URL}/api/services?vendorId=${selectedVendorId}&activeOnly=true`)
        .then(res => {
          if (!res.ok) return res.json().then(err => Promise.reject({ ...err, status: res.status }));
          return res.json();
        })
        .then((data: Service[]) => {
          setServices(data);
          const serviceIdFromUrl = searchParams.get('serviceId');
          if (currentStep === 'SELECT_SERVICE' && serviceIdFromUrl && data.some(s => s.id === serviceIdFromUrl)) {
            if(selectedServiceId !== serviceIdFromUrl) selectService(serviceIdFromUrl);
            setCurrentStep('SELECT_WORKER');
          } else if (data.length === 0) {
            setServicesError("Odabrani salon trenutno nema dostupnih aktivnih usluga.");
          }
        })
        .catch(err => setServicesError(formatErrorMessage(err, "preuzimanja usluga")))
        .finally(() => setIsLoadingServices(false));
    } else if (!selectedVendorId) {
      setServices([]);
    }
  }, [selectedVendorId, currentStep]);

  useEffect(() => {
    if (selectedVendorId && selectedServiceId &&
        (currentStep === 'SELECT_WORKER' || currentStep === 'SELECT_DATETIME' || currentStep === 'CONFIRM')) {

      if (currentStep === 'SELECT_WORKER' || qualifiedWorkers.length === 0) {
        setIsLoadingWorkers(true);
        setWorkersError(null);

        fetch(`${SITE_URL}/api/vendors/${selectedVendorId}/services/${selectedServiceId}/workers`)
          .then(res => {
            if (!res.ok) return res.json().then(err => Promise.reject({ ...err, status: res.status }));
            return res.json();
          })
          .then((data: PublicWorkerInfo[]) => {
            setQualifiedWorkers(data);
            if (data.length === 0 && currentStep === 'SELECT_WORKER') {
                if (preferredWorkerIdForFilter !== null) {
                    selectPreferredWorkerForFilter(null);
                }
            }
          })
          .catch(err => {
              setWorkersError(formatErrorMessage(err, "preuzimanja liste kvalifikovanih radnika"));
              if (currentStep === 'SELECT_WORKER') {
                  if (preferredWorkerIdForFilter !== null) {
                      selectPreferredWorkerForFilter(null);
                  }
              }
          })
          .finally(() => setIsLoadingWorkers(false));
      }
    } else if (!selectedServiceId) {
      setQualifiedWorkers([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId, selectedServiceId, currentStep]);

  // Fetch available slots
  useEffect(() => {
    if (selectedVendorId && selectedServiceId && selectedDate &&
        (currentStep === 'SELECT_DATETIME' || currentStep === 'CONFIRM')) {

      if (isToday(selectedDate)) { // Prevent fetching for today
        setAvailableSlotsData([]);
        setSlotsError("Rezervacije za danas nisu moguće. Molimo odaberite sutrašnji ili kasniji datum.");
        setIsLoadingSlots(false);
        return;
      }

      if (currentStep === 'SELECT_DATETIME' || availableSlotsData.length === 0) {
        setIsLoadingSlots(true);
        setSlotsError(null);
        setAvailableSlotsData([]);

        let apiUrl = `${SITE_URL}/api/appointments/available?vendorId=${selectedVendorId}&serviceId=${selectedServiceId}&date=${format(selectedDate, 'yyyy-MM-dd')}`;
        if (preferredWorkerIdForFilter) {
          apiUrl += `&workerId=${preferredWorkerIdForFilter}`;
        }

        fetch(apiUrl)
          .then(res => {
            if (!res.ok) return res.json().then(err => Promise.reject({ ...err, status: res.status }));
            return res.json();
          })
          .then((data: { availableSlots: SlotWithWorkers[], message?: string }) => {
            if (data.message && data.availableSlots.length === 0) {
              setSlotsError(data.message);
            } else {
              setAvailableSlotsData(data.availableSlots);
            }
          })
          .catch(err => setSlotsError(formatErrorMessage(err, "preuzimanja dostupnih termina")))
          .finally(() => setIsLoadingSlots(false));
        }
    } else {
      setAvailableSlotsData([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId, selectedServiceId, selectedDate, preferredWorkerIdForFilter, currentStep]);


  const handleVendorSelect = (vendorId: string) => {
    if (selectedVendorId !== vendorId) selectVendor(vendorId);
    setCurrentStep('SELECT_SERVICE');
    setServicesError(null); setWorkersError(null); setSlotsError(null); setBookingError(null);
  };

  const handleServiceSelect = (serviceId: string) => {
    if (selectedServiceId !== serviceId) selectService(serviceId);
    setCurrentStep('SELECT_WORKER');
    setWorkersError(null); setSlotsError(null); setBookingError(null);
  };

  const handleWorkerSelectForFilter = (workerId: string | null) => {
    if (preferredWorkerIdForFilter !== workerId) {
        selectPreferredWorkerForFilter(workerId);
    }
    setCurrentStep('SELECT_DATETIME');
    setSlotsError(null); setBookingError(null);
  };

  const handleDateSelect = (date: Date | null) => {
    // Prevent selecting today or past dates
    if (date && isBefore(date, startOfTomorrow())) {
      selectDate(startOfTomorrow()); // Default to tomorrow if today or past is selected
    } else {
      selectDate(date);
    }
    setSlotsError(null); setBookingError(null);
  };

  const handleSlotButtonClick = (slotDataTime: string) => {
    // Same-day check is now primarily handled by DatePicker's minDate and API
    selectSlotTime(slotDataTime);
    setCurrentStep('CONFIRM');
    setBookingError(null);
  };

  const handleBookingSubmit = async () => {
    if (!selectedVendorId || !selectedServiceId || !selectedDate || !selectedSlotTime) {
      setBookingError("Molimo Vas odaberite salon, uslugu, datum i vreme termina.");
      setBookingStatus('error');
      return;
    }
    if (isToday(selectedDate)) {
        setBookingError("Rezervacije za danas nisu moguće. Molimo odaberite sutrašnji ili kasniji datum.");
        setBookingStatus('error');
        return;
    }

    setBookingStatus('submitting');
    setBookingError(null);
    try {
      const startTime = set(selectedDate, {
        hours: parseInt(selectedSlotTime.split(':')[0]),
        minutes: parseInt(selectedSlotTime.split(':')[1]),
        seconds: 0, milliseconds: 0,
      });

      const response = await fetch(`${SITE_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: selectedVendorId,
          serviceId: selectedServiceId,
          startTime: startTime.toISOString(),
          workerId: selectedWorkerForBookingId,
          notes: bookingNotes,
        }),
      });
      if (!response.ok) {
        const errorPayload: BookingErrorPayload = { message: `Zakazivanje nije uspelo (Status: ${response.status})`, status: response.status };
        try { const errorData = await response.json(); errorPayload.message = errorData.message || errorData.error || errorPayload.message; errorPayload.details = errorData.details || JSON.stringify(errorData); }
        catch { errorPayload.details = await response.text(); }
        throw errorPayload;
      }
      setBookingStatus('success');
      successModalRef.current?.showModal();
      resetServiceAndBelow();
      setCurrentStep('SELECT_SERVICE');
    } catch (err: unknown) {
      setBookingStatus('error');
      setBookingError(formatErrorMessage(err, "slanja zahteva za zakazivanje"));
    }
  };

  const selectedVendorName = vendors.find(v => v.id === selectedVendorId)?.name || 'Salon';
  const selectedServiceName = services.find(s => s.id === selectedServiceId)?.name || 'Usluga';

  const finalSelectedWorkerName = selectedWorkerForBookingId
    ? (qualifiedWorkers.find(w => w.id === selectedWorkerForBookingId)?.name ||
       availableSlotsData.flatMap(s => s.availableWorkers).find(w => w.id === selectedWorkerForBookingId)?.name ||
       `Radnik (ID: ...${selectedWorkerForBookingId.slice(-4)})`)
    : 'Bilo koji dostupan / Automatski dodeljen';

  const isWeekday = (date: Date) => getDay(date) !== 0 && getDay(date) !== 6;
  const getDayClassName = (date: Date): string => {
    // Disable today and past dates
    if (isBefore(date, startOfTomorrow()) && !isSameDay(date, startOfTomorrow())) return "react-datepicker__day--past react-datepicker__day--disabled";
    if (!isWeekday(date)) return "react-datepicker__day--weekend react-datepicker__day--disabled"; // Keep weekend disabling
    return "";
  };

  const isSlotDisabled = (slotTime: string): boolean => {
    // This function might become simpler if date selection already prevents today
    if (selectedDate && isToday(selectedDate)) {
        return true; // Disable all slots for today
    }
    // Original logic for slots too close to current time (now only relevant if minDate was somehow bypassed)
    if (selectedDate && isSameDay(selectedDate, new Date())) { // Should not happen if minDate is tomorrow
        const [hours, minutes] = slotTime.split(':').map(Number);
        const slotDateTime = setMinutes(setHours(selectedDate, hours), minutes);
        return isBefore(slotDateTime, addHours(new Date(), 1));
    }
    return false;
  };

  const StepIndicator = ({ step, title, currentStepProp, onClick, isEnabled }: {step: BookingStep, title: string, currentStepProp: BookingStep, onClick?: () => void, isEnabled: boolean}) => {
    const stepOrder: BookingStep[] = ['SELECT_VENDOR', 'SELECT_SERVICE', 'SELECT_WORKER', 'SELECT_DATETIME', 'CONFIRM'];
    const currentIndex = stepOrder.indexOf(currentStepProp);
    const thisStepIndex = stepOrder.indexOf(step);
    const isCompleted = thisStepIndex < currentIndex;
    const isActive = step === currentStepProp;

    return (
        <button
            onClick={onClick}
            disabled={!isEnabled || isActive}
            className={`step ${isActive || isCompleted ? 'step-primary' : ''} ${!isEnabled && !isActive && !isCompleted ? 'opacity-50 cursor-not-allowed step-neutral' : 'cursor-pointer'}`}
        >
            {title}
        </button>
    )
  }

  const handleGoToStep = (step: BookingStep) => {
    if (step === 'SELECT_VENDOR') selectVendor(null);
    else if (step === 'SELECT_SERVICE') resetServiceAndBelow();
    else if (step === 'SELECT_WORKER') resetWorkerAndBelow();
    else if (step === 'SELECT_DATETIME') { selectDate(null); }

    setCurrentStep(step);
    setBookingError(null);
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-content">Zakažite Vaš Termin</h1>
        <p className="text-lg text-neutral-content/80 mt-2">Brzo i lako do savršene frizure.</p>
      </div>

      <ul className="steps w-full mb-10">
        <StepIndicator step="SELECT_VENDOR" title="1. Salon" currentStepProp={currentStep} onClick={() => handleGoToStep('SELECT_VENDOR')} isEnabled={true} />
        <StepIndicator step="SELECT_SERVICE" title="2. Usluga" currentStepProp={currentStep} onClick={() => handleGoToStep('SELECT_SERVICE')} isEnabled={!!selectedVendorId} />
        <StepIndicator step="SELECT_WORKER" title="3. Radnik" currentStepProp={currentStep} onClick={() => handleGoToStep('SELECT_WORKER')} isEnabled={!!selectedServiceId} />
        <StepIndicator step="SELECT_DATETIME" title="4. Vreme" currentStepProp={currentStep} onClick={() => handleGoToStep('SELECT_DATETIME')}
                       isEnabled={!!selectedServiceId && (preferredWorkerIdForFilter !== undefined || currentStep === 'SELECT_DATETIME' || currentStep === 'CONFIRM')} />
        <StepIndicator step="CONFIRM" title="5. Potvrda" currentStepProp={currentStep} isEnabled={!!selectedSlotTime} />
      </ul>

      {currentStep === 'SELECT_VENDOR' && (
        <section id="select-vendor" className="mb-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 card-title text-primary flex items-center">
            <Building2 className="h-6 w-6 mr-2" /> 1. Odaberite Salon
          </h2>
          {isLoadingVendors ? ( <div className="flex justify-center items-center h-32"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> </div>
          ) : vendorsError ? ( <div role="alert" className="alert alert-error"> <AlertTriangle className="h-6 w-6" /> <span>{vendorsError}</span> </div>
          ) : vendors.length === 0 ? ( <div role="alert" className="alert alert-info"> <Info className="h-6 w-6" /> <span>Trenutno nema aktivnih salona.</span> </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendors.map((vendor) => (
                <div key={vendor.id}
                  className={`card bordered cursor-pointer hover:shadow-md ${selectedVendorId === vendor.id ? 'border-2 border-primary ring-2 ring-primary/50' : 'bg-base-100'}`}
                  onClick={() => handleVendorSelect(vendor.id)} >
                  <div className="card-body p-4"><h3 className="card-title text-lg">{vendor.name}</h3>
                    <p className="text-sm text-base-content/70 line-clamp-2 h-10">{vendor.description || "Nema opisa."}</p>
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
          {isLoadingServices ? ( <div className="flex justify-center items-center h-32"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> </div>
          ) : servicesError ? ( <div role="alert" className="alert alert-error"> <AlertTriangle className="h-6 w-6" /> <span>{servicesError}</span> </div>
          ) : services.length === 0 ? ( <div role="alert" className="alert alert-info"> <Info className="h-6 w-6" /> <span>Ovaj salon nema aktivnih usluga.</span> </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div key={service.id}
                  className={`card bordered cursor-pointer hover:shadow-md ${selectedServiceId === service.id ? 'border-2 border-primary ring-2 ring-primary/50' : 'bg-base-100'}`}
                  onClick={() => handleServiceSelect(service.id)}>
                  <div className="card-body p-4"><h3 className="card-title text-lg">{service.name}</h3>
                    <p className="text-sm text-base-content/70 line-clamp-2 h-10">{service.description || "Nema opisa."}</p>
                    <p className="font-semibold">{service.price.toFixed(2)} RSD - {service.duration} min</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {currentStep === 'SELECT_WORKER' && selectedVendorId && selectedServiceId && (
        <section id="select-worker" className="mb-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 card-title text-primary flex items-center">
            <UserCog className="h-6 w-6 mr-2" /> 3. Odaberite Radnika za &quot;{selectedServiceName}&quot;
          </h2>
          {isLoadingWorkers ? ( <div className="flex justify-center items-center h-32"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> </div>
          ) : workersError ? (
            <div role="alert" className="alert alert-error">
                <AlertTriangle className="h-6 w-6" />
                <span>{workersError}</span>
                <button onClick={() => handleWorkerSelectForFilter(null)} className="btn btn-sm btn-outline btn-info ml-auto">Nastavi sa &quot;Bilo koji&quot;</button>
            </div>
          ) : qualifiedWorkers.length === 0 && !isLoadingWorkers ? (
            <div className="text-center p-4 bg-base-100 rounded-md border">
                <Info className="h-8 w-8 mx-auto text-info mb-2" />
                <p className="text-base-content/80 mb-3">Nema specifičnih radnika koji pružaju ovu uslugu.</p>
                <button onClick={() => handleWorkerSelectForFilter(null)} className="btn btn-primary">Nastavi sa &quot;Bilo koji dostupan&quot;</button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-base-content/80">Možete odabrati željenog radnika ili prepustiti sistemu da odabere bilo kog dostupnog.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className={`card bordered cursor-pointer hover:shadow-md ${preferredWorkerIdForFilter === null ? 'border-2 border-primary ring-2 ring-primary/50' : 'bg-base-100'}`}
                    onClick={() => handleWorkerSelectForFilter(null)}>
                    <div className="card-body p-4 items-center text-center"><Users className="h-8 w-8 text-base-content/70 mb-2"/><h3 className="card-title text-md">Bilo koji dostupan</h3></div>
                </div>
                {qualifiedWorkers.map((worker) => (
                  <div key={worker.id}
                    className={`card bordered cursor-pointer hover:shadow-md ${preferredWorkerIdForFilter === worker.id ? 'border-2 border-primary ring-2 ring-primary/50' : 'bg-base-100'}`}
                    onClick={() => handleWorkerSelectForFilter(worker.id)}>
                    <div className="card-body p-4 items-center text-center">
                      {worker.photoUrl ?
                        <div className="avatar">
                            <div className="w-12 h-12 rounded-full">
                                <Image
                                    src={worker.photoUrl}
                                    alt={worker.name || 'Radnik'}
                                    width={48}
                                    height={48}
                                    className="object-cover"
                                />
                            </div>
                        </div>
                         : <UserAvatarIcon className="h-8 w-8 text-base-content/70 mb-2"/>}
                      <h3 className="card-title text-md">{worker.name || `Radnik ${worker.id.substring(0,6)}`}</h3>
                      {worker.bio && <p className="text-xs text-base-content/60 line-clamp-2">{worker.bio}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {currentStep === 'SELECT_DATETIME' && selectedVendorId && selectedServiceId && (
        <section id="select-datetime" className="mb-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-6 card-title text-primary flex items-center">
            <CalendarDays className="h-6 w-6 mr-2" /> 4. Odaberite Datum i Vreme za &quot;{selectedServiceName}&quot;
            {preferredWorkerIdForFilter && qualifiedWorkers.find(w=>w.id === preferredWorkerIdForFilter) &&
              <span> kod radnika &quot;{qualifiedWorkers.find(w=>w.id === preferredWorkerIdForFilter)?.name}&quot;</span>}
            {!preferredWorkerIdForFilter && <span> kod bilo kog dostupnog radnika</span>}
          </h2>
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            <div className="flex-1 lg:max-w-xs mx-auto lg:mx-0">
              <h3 className="text-lg font-medium mb-3 text-neutral-content text-center lg:text-left">Datum</h3>
              <div className="p-1 border rounded-lg inline-block bg-base-100 shadow-sm">
                <DatePicker
                    selected={selectedDate}
                    onChange={handleDateSelect}
                    dateFormat="dd.MM.yyyy"
                    minDate={startOfTomorrow()} // Set minDate to tomorrow
                    filterDate={isWeekday}
                    inline
                    locale="sr-Latn"
                    calendarClassName="bg-base-100"
                    dayClassName={getDayClassName}
                />
              </div>
            </div>
            {selectedDate && !isToday(selectedDate) && ( // Only show slots if a valid future date is selected
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium mb-3 text-neutral-content">Dostupni Termini za {format(selectedDate, "dd. MMMM yy'.'", { locale: srLatn })}</h3>
                {isLoadingSlots ? ( <div className="flex justify-center items-center h-24"> <Loader2 className="h-10 w-10 animate-spin text-primary" /> </div>
                ) : slotsError ? ( <div role="alert" className="alert alert-warning text-sm p-3"> <AlertTriangle className="h-5 w-5" /> <span>{slotsError}</span> </div>
                ) : availableSlotsData.length === 0 ? ( <p className="text-base-content/70 mt-2 p-4 bg-base-100 rounded-md">Nema dostupnih termina.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {availableSlotsData.map(slotData => {
                      const disabledSlot = isSlotDisabled(slotData.time); // isSlotDisabled will also prevent today's slots
                      return (
                        <button key={slotData.time}
                          className={`btn btn-md ${selectedSlotTime === slotData.time && !disabledSlot ? 'btn-primary' : 'btn-outline'} ${disabledSlot ? 'btn-disabled' : ''}`}
                          onClick={() => !disabledSlot && handleSlotButtonClick(slotData.time)} disabled={disabledSlot} >
                          <Clock className="h-4 w-4 mr-1"/> {slotData.time} {disabledSlot && <X size={12} className="ml-1"/>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
             {selectedDate && isToday(selectedDate) && ( 
                <div className="flex-1 min-w-0">
                     <div role="alert" className="alert alert-info text-sm p-3">
                        <Info className="h-5 w-5" />
                        <span>Rezervacije za danas nisu moguće. Molimo odaberite sutrašnji ili kasniji datum.</span>
                    </div>
                </div>
            )}
          </div>
        </section>
      )}

      {currentStep === 'CONFIRM' && selectedVendorId && selectedServiceId && selectedDate && selectedSlotTime && (
        <section id="confirm-booking" className="mt-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 card-title text-primary flex items-center">
            <CheckCircle2 className="h-6 w-6 mr-2" /> 5. Potvrdite Vaš Zahtev
          </h2>
          <div className="mb-6 space-y-3 p-4 bg-base-100 rounded-lg">
            <p><span className="font-semibold">Salon:</span> {selectedVendorName}</p>
            <p><span className="font-semibold">Usluga:</span> {selectedServiceName}</p>
            <p><span className="font-semibold">Datum:</span> {format(selectedDate, "eeee, dd. MMMM yy'.'", { locale: srLatn })}</p>
            <p><span className="font-semibold">Vreme:</span> {selectedSlotTime}</p>
            <p><span className="font-semibold">Radnik:</span> {finalSelectedWorkerName}</p>
            <div className="form-control w-full mt-3">
                <label className="label" htmlFor="bookingNotes"><span className="label-text font-semibold">Napomena (opciono):</span></label>
                <textarea id="bookingNotes" className="textarea textarea-bordered h-24" placeholder="Dodatne želje..." value={bookingNotes || ''} onChange={(e) => setBookingNotes(e.target.value)}></textarea>
            </div>
          </div>
          {bookingStatus === 'error' && bookingError && ( <div role="alert" className="alert alert-error mb-4"><AlertTriangle/><span>{bookingError}</span></div> )}
          <button onClick={handleBookingSubmit} className={`btn btn-success btn-lg w-full sm:w-auto ${bookingStatus === 'submitting' ? 'btn-disabled' : '' }`} disabled={bookingStatus === 'submitting'}>
            {bookingStatus === 'submitting' ? <><Loader2 className="animate-spin mr-2"/> Slanje...</> : 'Pošalji Zahtev'}
          </button>
        </section>
      )}

      {currentStep !== 'SELECT_VENDOR' && (
         <div className="mt-12 text-center">
            <button onClick={() => {
                if (currentStep === 'SELECT_SERVICE') { handleGoToStep('SELECT_VENDOR'); }
                else if (currentStep === 'SELECT_WORKER') { handleGoToStep('SELECT_SERVICE'); }
                else if (currentStep === 'SELECT_DATETIME') { handleGoToStep('SELECT_WORKER'); }
                else if (currentStep === 'CONFIRM') { handleGoToStep('SELECT_DATETIME'); }
            }} className="btn btn-ghost">
            <ArrowLeft className="h-5 w-5 mr-2" /> Nazad
            </button>
         </div>
      )}

      <dialog id="success_booking_modal" className="modal" ref={successModalRef}>
        <div className="modal-box text-center"><CheckCircle2 className="text-success h-16 w-16 mx-auto mb-4" />
          <h3 className="font-bold text-2xl text-success">Uspešno!</h3>
          <p className="py-4">Vaš zahtev za termin je poslat.</p>
          <div className="modal-action justify-center"><form method="dialog"><button className="btn btn-primary" onClick={() => setCurrentStep('SELECT_SERVICE')}>Odlično!</button></form></div>
        </div>
        <form method="dialog" className="modal-backdrop"><button onClick={() => setCurrentStep('SELECT_SERVICE')}>zatvori</button></form>
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
        .react-datepicker__day--disabled, /* This will cover today if minDate is tomorrow */
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
  return ( <Suspense fallback={<BookingPageSkeleton />}><BookingForm /></Suspense> );
}

function BookingPageSkeleton() {
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
            <div className="h-10 bg-base-300 rounded w-3/4 md:w-1/2 mx-auto mb-10"></div>
            <div className="flex justify-around mb-10">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className={`h-8 bg-base-300 rounded w-1/6 ${i > 0 ? 'opacity-50' : ''}`}></div>
                ))}
            </div>
            <div className="mb-8 p-6 card bg-base-200"><div className="h-8 bg-base-300 rounded w-1/3 mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1,2].map(i=>(<div key={i} className="card bg-base-100 h-28"><div className="card-body p-5 space-y-2"><div className="h-6 bg-base-300 rounded w-3/4"></div><div className="h-4 bg-base-300 rounded w-full"></div><div className="h-4 bg-base-300 rounded w-5/6"></div></div></div>))}
                </div>
            </div>
            <div className="mt-12 text-center"><div className="h-10 bg-base-300 rounded w-1/4 mx-auto"></div></div>
        </div>
    );
}
