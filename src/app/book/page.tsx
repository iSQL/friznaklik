// src/app/book/page.tsx
'use client';

import { useBookingStore, type SlotWithWorkers, type WorkerInfo as BookingStoreWorkerInfo } from '@/store/bookingStore';
import { useState, useEffect, Suspense, useRef } from 'react';
import type { Service, Vendor, Worker as PrismaWorker } from '@prisma/client'; // Added PrismaWorker
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatErrorMessage, type FormattedError } from '@/lib/errorUtils';
import { CalendarDays, Clock, ShoppingBag, AlertTriangle, CheckCircle2, ArrowLeft, Loader2, X, Store, Users, MessageSquare, Building2, Info, UserCog, UserCircle } from 'lucide-react';

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

// Extended Worker type for frontend, including services they can perform
interface QualifiedWorker extends BookingStoreWorkerInfo {
  services: Array<{ id: string }>; // Simplified, just need service IDs for filtering
}

type BookingStep = 'SELECT_VENDOR' | 'SELECT_SERVICE' | 'SELECT_WORKER' | 'SELECT_DATETIME' | 'CONFIRM';

function BookingForm() {
  const searchParams = useSearchParams();
  const successModalRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  const {
    selectedVendorId,
    selectedServiceId,
    preferredWorkerIdForFilter, // User's preference for filtering slots
    selectedDate,
    availableSlotsData,
    selectedSlotTime,
    selectedWorkerForBookingId, // Actual worker for the chosen slot
    bookingNotes,
    bookingStatus,
    bookingError,
    allVendors: storeAllVendors, // Use vendors from the store
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
    resetBookingState,
    resetServiceAndBelow,
    resetWorkerAndBelow, // New reset action from store
    fetchAndSetAllVendors,
  } = useBookingStore();

  const [currentStep, setCurrentStep] = useState<BookingStep>('SELECT_VENDOR');

  // --- Local State for UI & Data specific to this page ---
  // Vendors (fetched once or from store)
  const [vendors, setVendors] = useState<Vendor[]>(storeAllVendors);
  const [isLoadingVendors, setIsLoadingVendors] = useState(storeIsLoadingAllVendors);
  const [vendorsError, setVendorsError] = useState<string | null>(null);

  // Services for the selected vendor
  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  // Workers for the selected vendor & service
  const [qualifiedWorkers, setQualifiedWorkers] = useState<QualifiedWorker[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [workersError, setWorkersError] = useState<string | null>(null);
  
  // Slots (fetched based on vendor, service, date, preferredWorker)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // Workers available for a specifically chosen slot (from availableSlotsData)
  const [workersForSelectedSlot, setWorkersForSelectedSlot] = useState<BookingStoreWorkerInfo[]>([]);


  // Effect to sync local vendors state with store, and handle initial vendor selection
  useEffect(() => {
    if (!isHydrated) return; // Wait for store rehydration

    setIsLoadingVendors(storeIsLoadingAllVendors);
    setVendors(storeAllVendors);

    if (!storeIsLoadingAllVendors && storeAllVendors.length === 0 && !selectedVendorId) {
        // If store is done loading and no vendors, show error or guide user
        setVendorsError("Nema dostupnih salona. Molimo proverite kasnije.");
    }

    const vendorIdFromUrl = searchParams.get('vendorId');
    const serviceIdFromUrl = searchParams.get('serviceId'); // For later pre-selection

    if (vendorIdFromUrl && storeAllVendors.some(v => v.id === vendorIdFromUrl)) {
      if (selectedVendorId !== vendorIdFromUrl) {
        selectVendor(vendorIdFromUrl); // This resets service, worker pref, date, etc.
      }
      setCurrentStep('SELECT_SERVICE');
    } else if (selectedVendorId && storeAllVendors.some(v => v.id === selectedVendorId)) {
      // Vendor already selected in store, determine next step
      if (selectedServiceId) {
        if (preferredWorkerIdForFilter !== undefined) { // Check if worker step was potentially done
            setCurrentStep('SELECT_DATETIME');
        } else {
            setCurrentStep('SELECT_WORKER');
        }
      } else {
        setCurrentStep('SELECT_SERVICE');
      }
    } else if (storeAllVendors.length > 0 && !vendorIdFromUrl && !selectedVendorId) {
      // No vendor from URL, none in store, but vendors exist -> start at vendor selection
      setCurrentStep('SELECT_VENDOR');
    } else if (storeAllVendors.length === 0 && !storeIsLoadingAllVendors && !selectedVendorId) {
      setCurrentStep('SELECT_VENDOR'); // No vendors available
    }
    // If selectedVendorId is already set (e.g. from cookie), this effect will run,
    // and subsequent effects for services/workers will trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isHydrated, 
    storeIsLoadingAllVendors, 
    storeAllVendors, 
    searchParams, 
    // selectVendor, // Removed to prevent potential loops if store updates trigger re-run
    // selectedVendorId, // Removed for same reason
    // selectedServiceId, // Removed
    // preferredWorkerIdForFilter // Removed
  ]);
  
  // Effect to fetch vendors if not already in store (e.g., direct navigation to /book)
  useEffect(() => {
    if (isHydrated && storeAllVendors.length === 0 && !storeIsLoadingAllVendors) {
      fetchAndSetAllVendors().catch(err => setVendorsError(formatErrorMessage(err, "inicijalnog preuzimanja salona")));
    }
  }, [isHydrated, storeAllVendors.length, storeIsLoadingAllVendors, fetchAndSetAllVendors]);


  // Effect to fetch services when a vendor is selected
  useEffect(() => {
    if (selectedVendorId && (currentStep === 'SELECT_SERVICE' || currentStep === 'SELECT_WORKER' || currentStep === 'SELECT_DATETIME' || currentStep === 'CONFIRM')) {
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
            setCurrentStep('SELECT_WORKER'); // Proceed to worker selection
          } else if (data.length === 0) {
            setServicesError("Odabrani salon trenutno nema dostupnih aktivnih usluga.");
          }
        })
        .catch(err => setServicesError(formatErrorMessage(err, "preuzimanja usluga")))
        .finally(() => setIsLoadingServices(false));
    } else if (!selectedVendorId) {
      setServices([]);
      if(currentStep !== 'SELECT_VENDOR') setCurrentStep('SELECT_VENDOR');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId, currentStep, searchParams]);


  // Effect to fetch QUALIFIED workers when vendor and service are selected
  useEffect(() => {
    if (selectedVendorId && selectedServiceId && (currentStep === 'SELECT_WORKER' || currentStep === 'SELECT_DATETIME' || currentStep === 'CONFIRM')) {
      setIsLoadingWorkers(true);
      setWorkersError(null);
      setQualifiedWorkers([]);
      // Assuming the admin API for workers can be used or adapted.
      // This API should return workers with their assigned services.
      fetch(`/api/admin/vendors/${selectedVendorId}/workers`)
        .then(res => {
          if (!res.ok) return res.json().then(err => Promise.reject({ ...err, status: res.status }));
          return res.json();
        })
        .then((allVendorWorkers: Array<PrismaWorker & { services: Array<{id: string}> }>) => {
          const filtered = allVendorWorkers.filter(worker =>
            worker.services.some(s => s.id === selectedServiceId)
          );
          setQualifiedWorkers(filtered.map(w => ({ id: w.id, name: w.name, services: w.services })));
          if (filtered.length === 0) {
            setWorkersError("Nema radnika koji mogu izvršiti odabranu uslugu u ovom salonu.");
            // If no workers, but user had a preference, reset it.
            if(preferredWorkerIdForFilter) selectPreferredWorkerForFilter(null);
            // Potentially auto-skip to date/time with "any" worker implicitly,
            // or show message and let user go back. For now, show message.
          } else if (filtered.length === 1 && !preferredWorkerIdForFilter) {
            // If only one worker is qualified, auto-select them for filtering.
            selectPreferredWorkerForFilter(filtered[0].id);
            if(currentStep === 'SELECT_WORKER') setCurrentStep('SELECT_DATETIME');
          } else if (currentStep === 'SELECT_WORKER' && preferredWorkerIdForFilter && filtered.some(w=>w.id === preferredWorkerIdForFilter)){
             setCurrentStep('SELECT_DATETIME'); // If worker already preferred and valid, move on
          }
        })
        .catch(err => setWorkersError(formatErrorMessage(err, "preuzimanja radnika")))
        .finally(() => setIsLoadingWorkers(false));
    } else if (!selectedServiceId) {
      setQualifiedWorkers([]);
      if (currentStep === 'SELECT_WORKER') setCurrentStep('SELECT_SERVICE');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId, selectedServiceId, currentStep]);


  // Effect to fetch available slots (depends on vendor, service, DATE, and PREFERRED WORKER)
  useEffect(() => {
    if (selectedVendorId && selectedServiceId && selectedDate && (currentStep === 'SELECT_DATETIME' || currentStep === 'CONFIRM')) {
      setIsLoadingSlots(true);
      setSlotsError(null);
      setAvailableSlotsData([]);
      setWorkersForSelectedSlot([]); // Reset workers for specific slot

      let apiUrl = `${SITE_URL}/api/appointments/available?vendorId=${selectedVendorId}&serviceId=${selectedServiceId}&date=${format(selectedDate, 'yyyy-MM-dd')}`;
      if (preferredWorkerIdForFilter) { // Add workerId if preferred
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
            let slotsToSet = data.availableSlots;
            // Client-side filtering for slots too soon (if date is today)
            const currentMinBookingTime = addHours(new Date(), 1);
            if (isSameDay(selectedDate, new Date())) {
                slotsToSet = slotsToSet.filter(slot => {
                    const [slotHours, slotMinutes] = slot.time.split(':').map(Number);
                    const slotDateTime = setMinutes(setHours(selectedDate, slotHours), slotMinutes);
                    return isBefore(currentMinBookingTime, slotDateTime);
                });
            }
            setAvailableSlotsData(slotsToSet);
          }
        })
        .catch(err => setSlotsError(formatErrorMessage(err, "preuzimanja dostupnih termina")))
        .finally(() => setIsLoadingSlots(false));
    } else {
      setAvailableSlotsData([]);
      setWorkersForSelectedSlot([]);
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
    if(preferredWorkerIdForFilter !== workerId) selectPreferredWorkerForFilter(workerId);
    setCurrentStep('SELECT_DATETIME');
    setSlotsError(null); setBookingError(null);
  };

  const handleDateSelect = (date: Date | null) => {
    if (date && isBefore(date, startOfToday()) && !isSameDay(date, startOfToday())) {
      selectDate(startOfToday());
    } else {
      selectDate(date);
    }
    setSlotsError(null); setBookingError(null); setWorkersForSelectedSlot([]);
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
    selectSlotTime(slotData.time); // This store action also sets selectedWorkerForBookingId
    setWorkersForSelectedSlot(slotData.availableWorkers || []); // Store workers for this specific chosen slot
    setCurrentStep('CONFIRM');
    setBookingError(null);
  };

  const handleBookingSubmit = async () => {
    if (!selectedVendorId || !selectedServiceId || !selectedDate || !selectedSlotTime) {
      setBookingError("Molimo Vas odaberite salon, uslugu, datum i vreme termina.");
      setBookingStatus('error');
      return;
    }
    // selectedWorkerForBookingId is now set by selectSlotTime, so it will be used if available
    // If it's null, the backend will attempt to auto-assign.

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
          workerId: selectedWorkerForBookingId, // This is now correctly populated by store
          notes: bookingNotes,
        }),
      });
      if (!response.ok) {
        const errorPayload: BookingErrorPayload = { message: `Zakazivanje nije uspelo (Status: ${response.status})`, status: response.status };
        try {
          const errorData = await response.json();
          errorPayload.message = errorData.message || errorData.error || errorPayload.message;
          errorPayload.details = errorData.details || JSON.stringify(errorData);
        } catch { errorPayload.details = await response.text(); }
        throw errorPayload;
      }
      setBookingStatus('success');
      successModalRef.current?.showModal();
      useBookingStore.getState().resetServiceAndBelow(); // Reset for new booking, keeps vendor
      setWorkersForSelectedSlot([]);
      setQualifiedWorkers([]); // Clear qualified workers list
      setCurrentStep('SELECT_SERVICE');
    } catch (err: unknown) {
      setBookingStatus('error');
      setBookingError(formatErrorMessage(err, "slanja zahteva za zakazivanje"));
    }
  };

  const selectedVendorName = vendors.find(v => v.id === selectedVendorId)?.name || 'Salon';
  const selectedServiceName = services.find(s => s.id === selectedServiceId)?.name || 'Usluga';
  
  // Display name for the worker who will actually perform the service for the chosen slot
  const finalSelectedWorkerName = selectedWorkerForBookingId
    ? (workersForSelectedSlot.find(w => w.id === selectedWorkerForBookingId)?.name || 
       qualifiedWorkers.find(w => w.id === selectedWorkerForBookingId)?.name || // Fallback to qualified list
       `Radnik (ID: ...${selectedWorkerForBookingId.slice(-4)})`)
    : 'Bilo koji dostupan / Automatski dodeljen';


  const isWeekday = (date: Date) => getDay(date) !== 0 && getDay(date) !== 6;
  const getDayClassName = (date: Date): string => {
    if (isBefore(date, startOfToday()) && !isSameDay(date, startOfToday())) return "react-datepicker__day--past react-datepicker__day--disabled";
    if (!isWeekday(date)) return "react-datepicker__day--weekend react-datepicker__day--disabled";
    return "";
  };
  const isSlotDisabled = (slotTime: string): boolean => {
    if (selectedDate && isSameDay(selectedDate, new Date())) {
        const [hours, minutes] = slotTime.split(':').map(Number);
        const slotDateTime = setMinutes(setHours(selectedDate, hours), minutes);
        return isBefore(slotDateTime, addHours(new Date(), 1));
    }
    return false;
  };

  const StepIndicator = ({ step, title, current, onClick, isEnabled }: {step: BookingStep, title: string, current: BookingStep, onClick?: () => void, isEnabled: boolean}) => {
    const stepOrder: BookingStep[] = ['SELECT_VENDOR', 'SELECT_SERVICE', 'SELECT_WORKER', 'SELECT_DATETIME', 'CONFIRM'];
    const currentIndex = stepOrder.indexOf(current);
    const thisStepIndex = stepOrder.indexOf(step);
    const isCompleted = thisStepIndex < currentIndex;

    return (
        <button
            onClick={onClick}
            disabled={!isEnabled || step === current}
            className={`step ${isActive(step) || isCompleted ? 'step-primary' : ''} ${!isEnabled && !isActive(step) && !isCompleted ? 'opacity-50 cursor-not-allowed step-neutral' : 'cursor-pointer'}`}
        >
            {title}
        </button>
    )
  }
  
  const handleGoToStep = (step: BookingStep) => {
    if (step === 'SELECT_VENDOR') selectVendor(null); // Resets everything
    else if (step === 'SELECT_SERVICE') resetServiceAndBelow(); // Resets service, worker, date, slot
    else if (step === 'SELECT_WORKER') resetWorkerAndBelow(); // Resets worker pref, date, slot
    else if (step === 'SELECT_DATETIME') { selectDate(null); setWorkersForSelectedSlot([]); } // Resets date, slot
    
    setCurrentStep(step);
    setBookingError(null);
  }
  const isActive = (step: BookingStep) => step === currentStep;


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-content">Zakažite Vaš Termin</h1>
        <p className="text-lg text-neutral-content/80 mt-2">Brzo i lako do savršene frizure.</p>
      </div>

      <ul className="steps w-full mb-10">
        <StepIndicator step="SELECT_VENDOR" title="1. Salon" current={currentStep} onClick={() => handleGoToStep('SELECT_VENDOR')} isEnabled={true} />
        <StepIndicator step="SELECT_SERVICE" title="2. Usluga" current={currentStep} onClick={() => handleGoToStep('SELECT_SERVICE')} isEnabled={!!selectedVendorId} />
        <StepIndicator step="SELECT_WORKER" title="3. Radnik" current={currentStep} onClick={() => handleGoToStep('SELECT_WORKER')} isEnabled={!!selectedServiceId} />
        <StepIndicator step="SELECT_DATETIME" title="4. Vreme" current={currentStep} onClick={() => handleGoToStep('SELECT_DATETIME')} isEnabled={!!selectedServiceId && (qualifiedWorkers.length > 0 || preferredWorkerIdForFilter === null)} />
        <StepIndicator step="CONFIRM" title="5. Potvrda" current={currentStep} isEnabled={!!selectedSlotTime} />
      </ul>

      {/* Step 1: Select Vendor */}
      {isActive('SELECT_VENDOR') && (
        <section id="select-vendor" className="mb-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 card-title text-primary flex items-center">
            <Building2 className="h-6 w-6 mr-2" /> 1. Odaberite Salon
          </h2>
          {isLoadingVendors ? (
            <div className="flex justify-center items-center h-32"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> </div>
          ) : vendorsError ? (
            <div role="alert" className="alert alert-error"> <AlertTriangle className="h-6 w-6" /> <span>{vendorsError}</span> </div>
          ) : vendors.length === 0 ? (
            <div role="alert" className="alert alert-info"> <Info className="h-6 w-6" /> <span>Trenutno nema aktivnih salona. Molimo pokušajte kasnije.</span> </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Step 2: Select Service */}
      {isActive('SELECT_SERVICE') && selectedVendorId && (
         <section id="select-service" className="mb-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 card-title text-primary flex items-center">
            <ShoppingBag className="h-6 w-6 mr-2" /> 2. Odaberite Uslugu u salonu &quot;{selectedVendorName}&quot;
          </h2>
          {isLoadingServices ? (
            <div className="flex justify-center items-center h-32"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> </div>
          ) : servicesError ? (
            <div role="alert" className="alert alert-error"> <AlertTriangle className="h-6 w-6" /> <span>{servicesError}</span> </div>
          ) : services.length === 0 ? (
            <div role="alert" className="alert alert-info"> <Info className="h-6 w-6" /> <span>Ovaj salon trenutno nema dostupnih aktivnih usluga.</span> </div>
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

      {/* Step 3: Select Worker */}
      {isActive('SELECT_WORKER') && selectedVendorId && selectedServiceId && (
        <section id="select-worker" className="mb-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 card-title text-primary flex items-center">
            <UserCog className="h-6 w-6 mr-2" /> 3. Odaberite Radnika za &quot;{selectedServiceName}&quot;
          </h2>
          {isLoadingWorkers ? (
            <div className="flex justify-center items-center h-32"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> </div>
          ) : workersError ? (
            <div role="alert" className="alert alert-error"> <AlertTriangle className="h-6 w-6" /> <span>{workersError}</span> </div>
          ) : qualifiedWorkers.length === 0 ? (
            <div role="alert" className="alert alert-info">
              <Info className="h-6 w-6" />
              <span>Nema dostupnih radnika za ovu uslugu. Možete nastaviti sa &quot;Bilo koji dostupan&quot; ili izabrati drugu uslugu.</span>
              <button onClick={() => handleWorkerSelectForFilter(null)} className="btn btn-sm btn-outline btn-info ml-auto">Nastavi sa &quot;Bilo koji&quot;</button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-base-content/80">Možete odabrati željenog radnika ili prepustiti sistemu da odabere bilo kog dostupnog.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Option for Any Worker */}
                <div
                    className={`card bordered cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md transform hover:-translate-y-1 ${
                        preferredWorkerIdForFilter === null ? 'border-2 border-primary ring-2 ring-primary/50 bg-primary/10 shadow-lg' : 'bg-base-100 border-base-300 hover:border-primary/70'
                    }`}
                    onClick={() => handleWorkerSelectForFilter(null)}
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && handleWorkerSelectForFilter(null)}
                >
                    <div className="card-body p-4 sm:p-5 items-center text-center">
                        <Users className="h-8 w-8 text-base-content/70 mb-2"/>
                        <h3 className="card-title text-md">Bilo koji dostupan radnik</h3>
                    </div>
                </div>
                {/* List of Qualified Workers */}
                {qualifiedWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className={`card bordered cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md transform hover:-translate-y-1 ${
                      preferredWorkerIdForFilter === worker.id ? 'border-2 border-primary ring-2 ring-primary/50 bg-primary/10 shadow-lg' : 'bg-base-100 border-base-300 hover:border-primary/70'
                    }`}
                    onClick={() => handleWorkerSelectForFilter(worker.id)}
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && handleWorkerSelectForFilter(worker.id)}
                  >
                    <div className="card-body p-4 sm:p-5 items-center text-center">
                        {/* Placeholder for worker image/avatar if available */}
                        <UserCircle className="h-8 w-8 text-base-content/70 mb-2"/>
                        <h3 className="card-title text-md">{worker.name || `Radnik ${worker.id.substring(0,6)}...`}</h3>
                        {/* Optionally display worker's specific skills or bio snippet if available */}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Step 4: Select Date & Time */}
      {isActive('SELECT_DATETIME') && selectedVendorId && selectedServiceId && (
        <section id="select-datetime" className="mb-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-6 card-title text-primary flex items-center">
            <CalendarDays className="h-6 w-6 mr-2" /> 4. Odaberite Datum i Vreme za &quot;{selectedServiceName}&quot;
            {preferredWorkerIdForFilter && qualifiedWorkers.find(w=>w.id === preferredWorkerIdForFilter) && 
              <span> kod radnika &quot;{qualifiedWorkers.find(w=>w.id === preferredWorkerIdForFilter)?.name}&quot;</span>
            }
             {!preferredWorkerIdForFilter && <span> kod bilo kog dostupnog radnika</span>}
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
                  <p className="text-base-content/70 mt-2 p-4 bg-base-100 rounded-md border border-base-300"> Nema dostupnih termina za odabrani datum {preferredWorkerIdForFilter ? "kod izabranog radnika" : ""}. Molimo Vas pokušajte sa drugim datumom ili radnikom. </p>
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

      {/* Step 5: Confirm Booking */}
      {isActive('CONFIRM') && selectedVendorId && selectedServiceId && selectedDate && selectedSlotTime && (
        <section id="confirm-booking" className="mt-8 p-4 sm:p-6 card bg-base-200 shadow-xl border border-base-300/50">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 card-title text-primary flex items-center">
            <CheckCircle2 className="h-6 w-6 mr-2" /> 5. Potvrdite Vaš Zahtev za Termin
          </h2>
          <div className="mb-6 space-y-3 text-base-content/90 p-4 bg-base-100 rounded-lg border border-base-300">
            <p><span className="font-semibold">Salon:</span> {selectedVendorName}</p>
            <p><span className="font-semibold">Usluga:</span> {selectedServiceName}</p>
            <p><span className="font-semibold">Datum:</span> {format(selectedDate, "eeee, dd. MMMM yy'.'", { locale: srLatn })}</p>
            <p><span className="font-semibold">Vreme:</span> {selectedSlotTime}</p>
            <p><span className="font-semibold">Radnik:</span> {finalSelectedWorkerName}</p>


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

          {bookingStatus === 'error' && bookingError && (
            <div role="alert" className="alert alert-error mt-0 mb-4">
                <AlertTriangle className="h-6 w-6" />
                <div>
                    <h3 className="font-bold">Zakazivanje Neuspešno!</h3>
                    <div className="text-xs">{bookingError}</div>
                </div>
            </div>
          )}

          <button
            onClick={handleBookingSubmit}
            className={`btn btn-success btn-lg w-full sm:w-auto ${ bookingStatus === 'submitting' ? 'btn-disabled' : '' }`}
            disabled={bookingStatus === 'submitting'}
          >
            {bookingStatus === 'submitting' ? (
              <> <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Slanje Zahteva... </>
            ) : ( 'Pošalji Zahtev za Termin' )}
          </button>
        </section>
      )}

      {/* Back Button Logic */}
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

      <dialog id="success_booking_modal" className="modal modal-bottom sm:modal-middle" ref={successModalRef}>
        <div className="modal-box text-center bg-base-100">
            <CheckCircle2 className="text-success h-16 w-16 mx-auto mb-4" />
          <h3 className="font-bold text-2xl text-success">Uspešno!</h3>
          <p className="py-4 text-base text-base-content">Vaš zahtev za termin je uspešno poslat. Dobićete potvrdu kada bude odobren.</p>
          <div className="modal-action justify-center">
            <form method="dialog">
              <button className="btn btn-primary" onClick={() => {setCurrentStep('SELECT_SERVICE');}}>Odlično!</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
            <button onClick={() => {setCurrentStep('SELECT_SERVICE');}}>zatvori</button>
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
                {[...Array(5)].map((_, i) => ( // Updated to 5 steps
                    <div key={i} className={`h-8 bg-base-300 rounded w-1/6 ${i > 0 ? 'opacity-50' : ''}`}></div>
                ))}
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
            <div className="mt-12 text-center">
                <div className="h-10 bg-base-300 rounded w-1/4 mx-auto"></div>
            </div>
        </div>
    );
}
