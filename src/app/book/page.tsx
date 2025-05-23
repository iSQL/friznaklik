'use client';

import { useBookingStore, type SlotWithWorkers } from '@/store/bookingStore';
import { useState, useEffect, Suspense, useRef, useCallback }  from 'react';
import type { Service, Vendor } from '@prisma/client';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from "@clerk/nextjs";
import { formatErrorMessage } from '@/lib/errorUtils';
import {
  CalendarDays, Clock, ShoppingBag, AlertTriangle, CheckCircle2,
  ArrowLeft, Loader2, X, Users, Building2, Info, UserCog, UserCircle as UserAvatarIcon, ShieldAlert
} from 'lucide-react';

import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, isBefore, isSameDay, set, startOfTomorrow, isToday, addMinutes as addMinutesToDate, parse as parseDateFn } from 'date-fns';
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

interface BookingPayload {
  vendorId: string;
  serviceId: string;
  workerId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  notes?: string | null;
}

type BookingStep = 'SELECT_VENDOR' | 'SELECT_SERVICE' | 'SELECT_WORKER' | 'SELECT_DATETIME' | 'CONFIRM';

function BookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const successModalRef = useRef<HTMLDialogElement>(null);
  const [hasFinalizationAttemptedThisLoad, setHasFinalizationAttemptedThisLoad] = useState(false);


  const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();

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
    clearTransientBookingDetails,
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Effect for initial vendor loading and non-finalization deep linking
  useEffect(() => {
    const action = searchParams.get('action');
    // If a finalization action is in the URL, let the dedicated effect handle it.
    if (action === 'finalize_booking' && searchParams.get('attempt_booking') === 'true') {
        return;
    }
    if (!isHydrated) return; // Wait for store hydration

    setIsLoadingVendors(storeIsLoadingAllVendors);
    setVendors(storeAllVendors);

    if (!storeIsLoadingAllVendors && storeAllVendors.length === 0 && !selectedVendorId) {
        setVendorsError("Nema dostupnih salona. Molimo proverite kasnije.");
    }
    
    const vendorIdFromUrl = searchParams.get('vendorId');
    // Only try to set step from URL if not already past vendor selection or if selections are missing
    if (currentStep === 'SELECT_VENDOR' || !selectedVendorId) {
        if (vendorIdFromUrl && storeAllVendors.some(v => v.id === vendorIdFromUrl)) {
            if (selectedVendorId !== vendorIdFromUrl) selectVendor(vendorIdFromUrl);
            setCurrentStep('SELECT_SERVICE');
        } else if (selectedVendorId && storeAllVendors.some(v => v.id === selectedVendorId)) {
            // If store already has a vendor, progress accordingly
            if (selectedServiceId) {
                setCurrentStep(selectedSlotTime ? 'CONFIRM' : (preferredWorkerIdForFilter !== undefined ? 'SELECT_DATETIME' : 'SELECT_WORKER'));
            } else {
                setCurrentStep('SELECT_SERVICE');
            }
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, storeIsLoadingAllVendors, storeAllVendors, searchParams, selectVendor]);

  useEffect(() => {
    if (isHydrated && storeAllVendors.length === 0 && !storeIsLoadingAllVendors) {
      fetchAndSetAllVendors().catch(err => setVendorsError(formatErrorMessage(err, "inicijalnog preuzimanja salona")));
    }
  }, [isHydrated, storeAllVendors.length, storeIsLoadingAllVendors, fetchAndSetAllVendors]);

  // Fetch services for selected vendor
  useEffect(() => {
    if (selectedVendorId) {
      const shouldFetchServices = services.length === 0 || services[0]?.vendorId !== selectedVendorId || currentStep === 'SELECT_SERVICE' || (currentStep === 'CONFIRM' && hasFinalizationAttemptedThisLoad);
      if (shouldFetchServices) {
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
            // Auto-select service from URL only if on service step and not in a finalization flow that already set it
            if (currentStep === 'SELECT_SERVICE' && !(hasFinalizationAttemptedThisLoad && selectedServiceId === serviceIdFromUrl) && serviceIdFromUrl && data.some(s => s.id === serviceIdFromUrl)) {
              if(selectedServiceId !== serviceIdFromUrl) selectService(serviceIdFromUrl);
              setCurrentStep('SELECT_WORKER');
            } else if (data.length === 0) {
              setServicesError("Odabrani salon trenutno nema dostupnih aktivnih usluga.");
            }
          })
          .catch(err => setServicesError(formatErrorMessage(err, "preuzimanja usluga")))
          .finally(() => setIsLoadingServices(false));
      }
    } else {
      setServices([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId, currentStep, selectService, hasFinalizationAttemptedThisLoad]);

  // Fetch qualified workers
  useEffect(() => {
    if (selectedVendorId && selectedServiceId) {
      const shouldFetchWorkers = currentStep === 'SELECT_WORKER' || qualifiedWorkers.length === 0 || (currentStep === 'CONFIRM' && hasFinalizationAttemptedThisLoad);
      if (shouldFetchWorkers) {
        setIsLoadingWorkers(true);
        setWorkersError(null);
        fetch(`${SITE_URL}/api/vendors/${selectedVendorId}/services/${selectedServiceId}/workers`)
          .then(res => {
            if (!res.ok) return res.json().then(err => Promise.reject({ ...err, status: res.status }));
            return res.json();
          })
          .then((data: PublicWorkerInfo[]) => {
            setQualifiedWorkers(data);
            if (data.length === 0 && currentStep === 'SELECT_WORKER' && !hasFinalizationAttemptedThisLoad) {
                if (preferredWorkerIdForFilter !== null) selectPreferredWorkerForFilter(null);
            }
          })
          .catch(err => {
              setWorkersError(formatErrorMessage(err, "preuzimanja liste kvalifikovanih radnika"));
              if (currentStep === 'SELECT_WORKER' && !hasFinalizationAttemptedThisLoad) {
                  if (preferredWorkerIdForFilter !== null) selectPreferredWorkerForFilter(null);
              }
          })
          .finally(() => setIsLoadingWorkers(false));
      }
    } else {
      setQualifiedWorkers([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId, selectedServiceId, currentStep, selectPreferredWorkerForFilter, hasFinalizationAttemptedThisLoad]);

  // Fetch available slots
  useEffect(() => {
    if (selectedVendorId && selectedServiceId && selectedDate) {
      if (isToday(selectedDate)) {
        setAvailableSlotsData([]);
        setSlotsError("Rezervacije za danas nisu moguće. Molimo odaberite sutrašnji ili kasniji datum.");
        setIsLoadingSlots(false);
        return;
      }
      const shouldFetchSlots = currentStep === 'SELECT_DATETIME' || availableSlotsData.length === 0 || (currentStep === 'CONFIRM' && hasFinalizationAttemptedThisLoad);
      if (shouldFetchSlots) {
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
            if (data.message && data.availableSlots.length === 0) setSlotsError(data.message);
            else setAvailableSlotsData(data.availableSlots);
          })
          .catch(err => setSlotsError(formatErrorMessage(err, "preuzimanja dostupnih termina")))
          .finally(() => setIsLoadingSlots(false));
        }
    } else {
      setAvailableSlotsData([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId, selectedServiceId, selectedDate, preferredWorkerIdForFilter, currentStep, hasFinalizationAttemptedThisLoad]);


  // Effect to handle POST-LOGIN state restoration and step setting for finalization
  useEffect(() => {
    if (!isHydrated || !isAuthLoaded || !isSignedIn || hasFinalizationAttemptedThisLoad) {
        return;
    }

    const action = searchParams.get('action');
    const bookingAttempt = searchParams.get('attempt_booking');

    if (action === 'finalize_booking' && bookingAttempt === 'true') {
        setHasFinalizationAttemptedThisLoad(true);
        console.log("Finalization process started: Restoring state from URL...");

        const vendorIdFromUrl = searchParams.get('vendorId');
        const serviceIdFromUrl = searchParams.get('serviceId');
        const dateStrFromUrl = searchParams.get('date');
        const slotFromUrl = searchParams.get('slot');
        const workerIdFromUrl = searchParams.get('workerId'); // This is selectedWorkerForBookingId
        const prefWorkerFromUrl = searchParams.get('prefWorker');
        const notesFromUrl = searchParams.get('notes');

        let allSelectionsRestored = true;

        if (vendorIdFromUrl) { selectVendor(vendorIdFromUrl); } else { allSelectionsRestored = false; }
        if (serviceIdFromUrl) { selectService(serviceIdFromUrl); } else { allSelectionsRestored = false; }
        
        // Restore preferred worker if present, otherwise ensure it's null if not in URL
        if (prefWorkerFromUrl) { selectPreferredWorkerForFilter(prefWorkerFromUrl); }
        else if (searchParams.has('prefWorker') && !prefWorkerFromUrl) { selectPreferredWorkerForFilter(null); }


        if (dateStrFromUrl) {
            try {
                const parsedDate = parseDateFn(dateStrFromUrl, 'yyyy-MM-dd', new Date());
                if (!isNaN(parsedDate.getTime()) && !isBefore(parsedDate, startOfTomorrow())) {
                     selectDate(parsedDate);
                } else {
                    setBookingError("Datum iz linka je neispravan ili je prošao. Molimo odaberite ponovo.");
                    setCurrentStep('SELECT_DATETIME'); allSelectionsRestored = false;
                }
            } catch {
                setBookingError("Greška pri čitanju datuma iz linka.");
                setCurrentStep('SELECT_DATETIME'); allSelectionsRestored = false;
            }
        } else { allSelectionsRestored = false; }
        
        // Directly set slot and the specific worker for booking from URL
        if (slotFromUrl) { useBookingStore.setState({ selectedSlotTime: slotFromUrl }); } else { allSelectionsRestored = false; }
        if (workerIdFromUrl) { useBookingStore.setState({ selectedWorkerForBookingId: workerIdFromUrl }); } else { allSelectionsRestored = false; }
        
        if (notesFromUrl) setBookingNotes(decodeURIComponent(notesFromUrl));

        if (allSelectionsRestored) {
            console.log("State restored from URL, setting currentStep to CONFIRM");
            setCurrentStep('CONFIRM'); // This should now reliably set the step
        } else {
            console.warn("Not all selections could be restored from URL for finalization. User may need to re-select.");
            // Error message already set if date was invalid.
            // If other essential params are missing, the UI should reflect the current (partially restored) state.
            // Do not proceed to CONFIRM if critical data is missing.
            setHasFinalizationAttemptedThisLoad(false); // Allow re-attempt if validation failed here
        }

        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete('action');
        newParams.delete('attempt_booking');
        router.replace(`/book?${newParams.toString()}`, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, isAuthLoaded, isSignedIn, searchParams, router]); // Removed store setters, they are stable


  const performBookingSubmitStable = useCallback(async (serviceDurationMinutes: number) => {
    if (!selectedVendorId || !selectedServiceId || !selectedDate || !selectedSlotTime || !selectedWorkerForBookingId) {
        setBookingError("Kritični detalji rezervacije nedostaju.");
        setBookingStatus('error');
        setIsSubmitting(false);
        return;
    }
    if (isToday(selectedDate)) {
        setBookingError("Rezervacije za danas nisu moguće.");
        setBookingStatus('error');
        setIsSubmitting(false);
        return;
    }

    setIsSubmitting(true);
    setBookingStatus('submitting');
    setBookingError(null);

    try {
      const [hours, minutes] = selectedSlotTime.split(':').map(Number);
      const bookingStartTime = set(new Date(selectedDate), { hours, minutes, seconds: 0, milliseconds: 0 });
      const bookingEndTime = addMinutesToDate(bookingStartTime, serviceDurationMinutes);

      const payload: BookingPayload = {
        vendorId: selectedVendorId,
        serviceId: selectedServiceId,
        workerId: selectedWorkerForBookingId,
        startTime: bookingStartTime.toISOString(),
        endTime: bookingEndTime.toISOString(),
        notes: bookingNotes,
      };

      const response = await fetch(`${SITE_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayloadData: BookingErrorPayload = { message: `Zakazivanje nije uspelo (Status: ${response.status})`, status: response.status };
        try { const errorData = await response.json(); errorPayloadData.message = errorData.message || errorData.error || errorPayloadData.message; errorPayloadData.details = errorData.details || JSON.stringify(errorData); }
        catch { errorPayloadData.details = await response.text(); }
        throw errorPayloadData;
      }

      setBookingStatus('success');
      successModalRef.current?.showModal();
      if (clearTransientBookingDetails) clearTransientBookingDetails();
      else resetServiceAndBelow();
      setHasFinalizationAttemptedThisLoad(false); 
    } catch (err: unknown) {
      setBookingStatus('error');
      setBookingError(formatErrorMessage(err, "slanja zahteva za zakazivanje"));
    } finally {
      setIsSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedVendorId, selectedServiceId, selectedDate, selectedSlotTime, selectedWorkerForBookingId, bookingNotes,
    clearTransientBookingDetails, resetServiceAndBelow, setBookingError, setBookingStatus, successModalRef, router, setIsSubmitting
  ]);

  // Effect for ACTUAL SUBMISSION when on CONFIRM step and all data is ready
  useEffect(() => {
    if (isSignedIn && isAuthLoaded && currentStep === 'CONFIRM' && hasFinalizationAttemptedThisLoad) {
        if (isLoadingServices || isLoadingWorkers || isLoadingSlots) {
            console.log("Waiting for dependent data to load before final submission attempt...");
            return;
        }
        const currentService = services.find(s => s.id === selectedServiceId);
        if (selectedVendorId && selectedServiceId && selectedDate && selectedSlotTime && selectedWorkerForBookingId && currentService) {
            if (!isSubmitting && bookingStatus !== 'submitting') {
                 console.log("Performing booking submission automatically after finalization.");
                performBookingSubmitStable(currentService.duration);
            }
        } else {
             console.warn("On CONFIRM step for finalization, but some booking details are missing or service/slot data not loaded yet.");
             if (!currentService && services.length > 0 && !isLoadingServices) {
                setBookingError("Izabrana usluga nije pronađena. Molimo pokušajte ponovo od odabira usluge.");
             } else if (!currentService && !isLoadingServices && selectedServiceId) { // selectedServiceId exists but no service loaded
                setBookingError("Nije moguće učitati detalje usluge. Molimo pokušajte ponovo.");
             } else if (!selectedVendorId || !selectedServiceId || !selectedDate || !selectedSlotTime || !selectedWorkerForBookingId) {
                setBookingError("Nisu svi detalji rezervacije uspešno obnovljeni. Molimo proverite odabire.");
             }
             // Do not auto-submit if critical data is missing. Let the user see the CONFIRM step.
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isSignedIn, isAuthLoaded, currentStep, hasFinalizationAttemptedThisLoad, services, 
    selectedVendorId, selectedServiceId, selectedDate, selectedSlotTime, selectedWorkerForBookingId,
    performBookingSubmitStable, isLoadingServices, isLoadingWorkers, isLoadingSlots, isSubmitting, bookingStatus
  ]);


  const handleVendorSelect = (vendorId: string) => {
    if (selectedVendorId !== vendorId) selectVendor(vendorId);
    setCurrentStep('SELECT_SERVICE');
    setServicesError(null); setWorkersError(null); setSlotsError(null); setBookingError(null);
    setHasFinalizationAttemptedThisLoad(false);
  };

  const handleServiceSelect = (serviceId: string) => {
    if (selectedServiceId !== serviceId) selectService(serviceId);
    setCurrentStep('SELECT_WORKER');
    setWorkersError(null); setSlotsError(null); setBookingError(null);
    setHasFinalizationAttemptedThisLoad(false);
  };

  const handleWorkerSelectForFilter = (workerId: string | null) => {
    if (preferredWorkerIdForFilter !== workerId) selectPreferredWorkerForFilter(workerId);
    setCurrentStep('SELECT_DATETIME');
    setSlotsError(null); setBookingError(null);
    setHasFinalizationAttemptedThisLoad(false);
  };

  const handleDateSelect = (date: Date | null) => {
    if (date && isBefore(date, startOfTomorrow())) {
      selectDate(startOfTomorrow());
    } else {
      selectDate(date);
    }
    setSlotsError(null); setBookingError(null);
    setHasFinalizationAttemptedThisLoad(false);
  };

  const handleSlotButtonClick = (slotDataTime: string) => {
    selectSlotTime(slotDataTime);
    setCurrentStep('CONFIRM');
    setBookingError(null);
    setHasFinalizationAttemptedThisLoad(false);
  };

  const handleAttemptBooking = async () => {
    setBookingError(null);
    
    if (!isAuthLoaded) {
      console.log("Čeka se učitavanje statusa autentifikacije...");
      return;
    }

    const currentService = services.find(s => s.id === selectedServiceId);
    if (!selectedVendorId || !selectedServiceId || !selectedDate || !selectedSlotTime || !selectedWorkerForBookingId || !currentService) {
      setBookingError("Molimo Vas da popunite sve korake rezervacije pre potvrde.");
      return;
    }
    if (isToday(selectedDate)) {
        setBookingError("Rezervacije za danas nisu moguće. Molimo odaberite sutrašnji ili kasniji datum.");
        return;
    }

    // Mark that user is trying to confirm this specific selection, which might lead to login
    setHasFinalizationAttemptedThisLoad(true); 

    if (!isSignedIn) {
      console.log("Korisnik nije prijavljen. Preusmeravanje na prijavu...");
      const redirectUrl = `/book?action=finalize_booking&attempt_booking=true&vendorId=${selectedVendorId}&serviceId=${selectedServiceId}&date=${format(selectedDate, 'yyyy-MM-dd')}&slot=${selectedSlotTime}&workerId=${selectedWorkerForBookingId}${preferredWorkerIdForFilter ? `&prefWorker=${preferredWorkerIdForFilter}` : ''}${bookingNotes ? `&notes=${encodeURIComponent(bookingNotes)}` : ''}`;
      router.push(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);
      return;
    }
    await performBookingSubmitStable(currentService.duration);
  };

  const selectedVendorName = vendors.find(v => v.id === selectedVendorId)?.name || 'Salon';
  const selectedServiceName = services.find(s => s.id === selectedServiceId)?.name || 'Usluga';
  const finalSelectedWorkerName = selectedWorkerForBookingId
    ? (qualifiedWorkers.find(w => w.id === selectedWorkerForBookingId)?.name ||
       availableSlotsData.flatMap(s => s.availableWorkers).find(w => w.id === selectedWorkerForBookingId)?.name ||
       `Radnik`)
    : 'Bilo koji dostupan / Automatski dodeljen';

  const getDayClassName = (date: Date): string => {
    if (isBefore(date, startOfTomorrow()) && !isSameDay(date, startOfTomorrow())) return "react-datepicker__day--past react-datepicker__day--disabled";
    return "";
  };

  const isSlotDisabled = (): boolean => {
    if (selectedDate && isToday(selectedDate)) return true;
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
            className={`step ${isActive ? 'step-primary' : ''} ${isCompleted ? 'step-primary' : ''} ${!isEnabled && !isActive && !isCompleted ? 'opacity-50 cursor-not-allowed !step-neutral' : 'cursor-pointer'}`}
        >
            {title}
        </button>
    )
  }

  const handleGoToStep = (step: BookingStep) => {
    setHasFinalizationAttemptedThisLoad(false); 
    if (step === 'SELECT_VENDOR') {
        selectVendor(null);
    } else if (step === 'SELECT_SERVICE' && selectedVendorId) {
        resetServiceAndBelow();
    } else if (step === 'SELECT_WORKER' && selectedServiceId) {
        resetWorkerAndBelow();
    } else if (step === 'SELECT_DATETIME' && selectedServiceId) {
        useBookingStore.setState({ selectedDate: null, selectedSlotTime: null, selectedWorkerForBookingId: null, availableSlotsData: [] });
    }
    setCurrentStep(step);
    setBookingError(null);
  }

  if (!isAuthLoaded || !isHydrated) {
    return <BookingPageSkeleton title="Učitavanje forme za rezervaciju..." />;
  }

    return (
        <div className="container mx-auto p-2 sm:p-4 lg:p-6">
        <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-base-content">Zakažite Vaš Termin</h1>
            <p className="text-md sm:text-lg text-base-content/80 mt-1">Brzo i lako do savršenog izgleda.</p>
        </div>

        <ul className="steps w-full mb-8 overflow-x-auto pb-2">
            <StepIndicator step="SELECT_VENDOR" title="Salon" currentStepProp={currentStep} onClick={() => handleGoToStep('SELECT_VENDOR')} isEnabled={true} />
            <StepIndicator step="SELECT_SERVICE" title="Usluga" currentStepProp={currentStep} onClick={() => handleGoToStep('SELECT_SERVICE')} isEnabled={!!selectedVendorId} />
            <StepIndicator step="SELECT_WORKER" title="Radnik" currentStepProp={currentStep} onClick={() => handleGoToStep('SELECT_WORKER')} isEnabled={!!selectedServiceId} />
            <StepIndicator step="SELECT_DATETIME" title="Vreme" currentStepProp={currentStep} onClick={() => handleGoToStep('SELECT_DATETIME')}
                        isEnabled={!!selectedServiceId} />
            <StepIndicator step="CONFIRM" title="Potvrda" currentStepProp={currentStep} isEnabled={!!selectedSlotTime} />
        </ul>

        {currentStep === 'SELECT_VENDOR' && (
            <section id="select-vendor" className="mb-6 p-3 sm:p-5 card bg-base-200 shadow-lg border border-base-300/40">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 card-title text-primary flex items-center">
                <Building2 className="h-5 w-5 mr-2" /> 1. Odaberite Salon
            </h2>
            {isLoadingVendors ? ( <div className="flex justify-center items-center h-24"> <Loader2 className="h-10 w-10 animate-spin text-primary" /> </div>
            ) : vendorsError ? ( <div role="alert" className="alert alert-error text-sm p-3"> <AlertTriangle className="h-5 w-5" /> <span>{vendorsError}</span> </div>
            ) : vendors.length === 0 ? ( <div role="alert" className="alert alert-info text-sm p-3"> <Info className="h-5 w-5" /> <span>Trenutno nema aktivnih salona.</span> </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {vendors.map((vendor) => (
                    <div key={vendor.id}
                    className={`card bordered cursor-pointer hover:shadow-lg transition-all duration-150 ease-in-out ${selectedVendorId === vendor.id ? 'border-2 border-primary ring-2 ring-primary/30 bg-primary/5' : 'bg-base-100 hover:bg-base-300/30'}`}
                    onClick={() => handleVendorSelect(vendor.id)} >
                    <div className="card-body p-3 sm:p-4"><h3 className="card-title text-md sm:text-lg">{vendor.name}</h3>
                        <p className="text-xs sm:text-sm text-base-content/70 line-clamp-2 h-[2.5em] sm:h-[3em]">{vendor.description || "Nema opisa."}</p>
                        {vendor.address && <p className="text-xs text-base-content/60 mt-1">{vendor.address}</p>}
                    </div>
                    </div>
                ))}
                </div>
            )}
            </section>
        )}

        {currentStep === 'SELECT_SERVICE' && selectedVendorId && (
            <section id="select-service" className="mb-6 p-3 sm:p-5 card bg-base-200 shadow-lg border border-base-300/40">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 card-title text-primary flex items-center">
                <ShoppingBag className="h-5 w-5 mr-2" /> 2. Odaberite Uslugu u salonu &quot;{selectedVendorName}&quot;
            </h2>
            {isLoadingServices ? ( <div className="flex justify-center items-center h-24"> <Loader2 className="h-10 w-10 animate-spin text-primary" /> </div>
            ) : servicesError ? ( <div role="alert" className="alert alert-error text-sm p-3"> <AlertTriangle className="h-5 w-5" /> <span>{servicesError}</span> </div>
            ) : services.length === 0 ? ( <div role="alert" className="alert alert-info text-sm p-3"> <Info className="h-5 w-5" /> <span>Ovaj salon nema aktivnih usluga.</span> </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {services.map((service) => (
                    <div key={service.id}
                    className={`card bordered cursor-pointer hover:shadow-lg transition-all duration-150 ease-in-out ${selectedServiceId === service.id ? 'border-2 border-primary ring-2 ring-primary/30 bg-primary/5' : 'bg-base-100 hover:bg-base-300/30'}`}
                    onClick={() => handleServiceSelect(service.id)}>
                    <div className="card-body p-3 sm:p-4"><h3 className="card-title text-md sm:text-lg">{service.name}</h3>
                        <p className="text-xs sm:text-sm text-base-content/70 line-clamp-2 h-[2.5em] sm:h-[3em]">{service.description || "Nema opisa."}</p>
                        <p className="font-semibold text-sm mt-1">{service.price.toFixed(2)} RSD - {service.duration} min</p>
                    </div>
                    </div>
                ))}
                </div>
            )}
            </section>
        )}

        {currentStep === 'SELECT_WORKER' && selectedVendorId && selectedServiceId && (
            <section id="select-worker" className="mb-6 p-3 sm:p-5 card bg-base-200 shadow-lg border border-base-300/40">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 card-title text-primary flex items-center">
                <UserCog className="h-5 w-5 mr-2" /> 3. Odaberite Radnika za &quot;{selectedServiceName}&quot;
            </h2>
            {isLoadingWorkers ? ( <div className="flex justify-center items-center h-24"> <Loader2 className="h-10 w-10 animate-spin text-primary" /> </div>
            ) : workersError ? (
                <div role="alert" className="alert alert-error text-sm p-3">
                    <AlertTriangle className="h-5 w-5" />
                    <span>{workersError}</span>
                    <button onClick={() => handleWorkerSelectForFilter(null)} className="btn btn-xs btn-outline btn-info ml-auto mt-1 sm:mt-0">Nastavi sa &quot;Bilo koji&quot;</button>
                </div>
            ) : qualifiedWorkers.length === 0 && !isLoadingWorkers ? ( 
                <div className="text-center p-4 bg-base-100 rounded-md border border-base-300/30">
                    <Info className="h-7 w-7 mx-auto text-info mb-2" />
                    <p className="text-base-content/80 mb-3 text-sm sm:text-base">Za ovu uslugu nije neophodno birati određenog radnika.</p>
                    <button onClick={() => handleWorkerSelectForFilter(null)} className="btn btn-primary btn-sm">Nastavi sa &quot;Bilo koji dostupan&quot;</button>
                </div>
            ) : ( 
                <div className="space-y-3">
                <p className="text-xs sm:text-sm text-base-content/80">Možete odabrati željenog radnika ili prepustiti sistemu da odabere bilo kog dostupnog.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className={`card bordered cursor-pointer hover:shadow-lg transition-all duration-150 ease-in-out ${preferredWorkerIdForFilter === null ? 'border-2 border-primary ring-2 ring-primary/30 bg-primary/5' : 'bg-base-100 hover:bg-base-300/30'}`}
                        onClick={() => handleWorkerSelectForFilter(null)}>
                        <div className="card-body p-3 sm:p-4 items-center text-center"><Users className="h-7 w-7 text-base-content/70 mb-1"/><h3 className="card-title text-sm sm:text-md">Bilo koji dostupan</h3></div>
                    </div>
                    {qualifiedWorkers.map((worker) => (
                    <div key={worker.id}
                        className={`card bordered cursor-pointer hover:shadow-lg transition-all duration-150 ease-in-out ${preferredWorkerIdForFilter === worker.id ? 'border-2 border-primary ring-2 ring-primary/30 bg-primary/5' : 'bg-base-100 hover:bg-base-300/30'}`}
                        onClick={() => handleWorkerSelectForFilter(worker.id)}>
                        <div className="card-body p-3 sm:p-4 items-center text-center">
                        {worker.photoUrl ?
                            (<div className="avatar mb-1"><div className="w-10 h-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-1"><Image src={worker.photoUrl} alt={worker.name || 'Radnik'} width={40} height={40} className="object-cover"/></div></div>)
                            : <UserAvatarIcon className="h-7 w-7 text-base-content/70 mb-1"/>}
                        <h3 className="card-title text-sm sm:text-md">{worker.name || `Radnik ${worker.id.substring(0,6)}`}</h3>
                        {worker.bio && <p className="text-xs text-base-content/60 line-clamp-2 h-[2.5em]">{worker.bio}</p>}
                        </div>
                    </div>
                    ))}
                </div>
                </div>
            )}
            </section>
        )}

        {currentStep === 'SELECT_DATETIME' && selectedVendorId && selectedServiceId && (
            <section id="select-datetime" className="mb-6 p-3 sm:p-5 card bg-base-200 shadow-lg border border-base-300/40">
            <h2 className="text-lg sm:text-xl font-semibold mb-5 card-title text-primary flex items-center">
                <CalendarDays className="h-5 w-5 mr-2" /> 4. Odaberite Datum i Vreme za &quot;{selectedServiceName}&quot;
                {preferredWorkerIdForFilter && qualifiedWorkers.find(w=>w.id === preferredWorkerIdForFilter) &&
                <span className="text-base-content/80 text-sm ml-1"> kod radnika &quot;{qualifiedWorkers.find(w=>w.id === preferredWorkerIdForFilter)?.name}&quot;</span>}
                {!preferredWorkerIdForFilter && <span className="text-base-content/80 text-sm ml-1"> kod bilo kog dostupnog radnika</span>}
            </h2>
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
                <div className="flex-shrink-0 lg:max-w-xs mx-auto lg:mx-0">
                <h3 className="text-md font-medium mb-2 text-base-content text-center lg:text-left">Datum</h3>
                <div className="p-1 border rounded-lg inline-block bg-base-100 shadow-sm">
                    <DatePicker
                        selected={selectedDate}
                        onChange={handleDateSelect}
                        dateFormat="dd.MM.yyyy"
                        minDate={startOfTomorrow()}
                        inline
                        locale="sr-Latn"
                        calendarClassName="bg-base-100"
                        dayClassName={getDayClassName}
                    />
                </div>
                </div>
                {selectedDate && !isToday(selectedDate) && (
                <div className="flex-1 min-w-0">
                    <h3 className="text-md font-medium mb-2 text-base-content">Dostupni Termini za {format(selectedDate, "dd. MMMM yy'.'", { locale: srLatn })}</h3>
                    {isLoadingSlots ? ( <div className="flex justify-center items-center h-20"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </div>
                    ) : slotsError ? ( <div role="alert" className="alert alert-warning text-xs p-2.5"> <AlertTriangle className="h-4 w-4" /> <span>{slotsError}</span> </div>
                    ) : availableSlotsData.length === 0 ? ( <p className="text-base-content/70 mt-1 p-3 bg-base-100 rounded-md text-sm">Nema dostupnih termina za odabrani datum.</p>
                    ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 sm:gap-2">
                        {availableSlotsData.map(slotData => {
                        const disabledSlot = isSlotDisabled();
                        return (
                            <button key={slotData.time}
                            className={`btn btn-sm sm:btn-md ${selectedSlotTime === slotData.time && !disabledSlot ? 'btn-primary' : 'btn-outline'} ${disabledSlot ? 'btn-disabled' : ''}`}
                            onClick={() => !disabledSlot && handleSlotButtonClick(slotData.time)} disabled={disabledSlot} >
                            <Clock className="h-3.5 w-3.5 mr-1 hidden sm:inline-block"/> {slotData.time} {disabledSlot && <X size={12} className="ml-1"/>}
                            </button>
                        );
                        })}
                    </div>
                    )}
                </div>
                )}
                {selectedDate && isToday(selectedDate) && (
                    <div className="flex-1 min-w-0 mt-2 lg:mt-0">
                        <div role="alert" className="alert alert-info text-xs p-2.5">
                            <Info className="h-4 w-4" />
                            <span>Rezervacije za danas nisu moguće. Molimo odaberite sutrašnji ili kasniji datum.</span>
                        </div>
                    </div>
                )}
            </div>
            </section>
        )}

        {currentStep === 'CONFIRM' && selectedVendorId && selectedServiceId && selectedDate && selectedSlotTime && (
            <section id="confirm-booking" className="mt-6 p-3 sm:p-5 card bg-base-200 shadow-xl border border-base-300/40">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 card-title text-primary flex items-center">
                <CheckCircle2 className="h-5 w-5 mr-2" /> 5. Potvrdite Vašu Rezervaciju
            </h2>
            <div className="mb-5 space-y-2 p-3 sm:p-4 bg-base-100 rounded-lg shadow">
                <p><span className="font-semibold text-base-content/80">Salon:</span> {selectedVendorName}</p>
                <p><span className="font-semibold text-base-content/80">Usluga:</span> {selectedServiceName}</p>
                <p><span className="font-semibold text-base-content/80">Datum:</span> {format(selectedDate, "eeee, dd. MMMM yy'.'", { locale: srLatn })}</p>
                <p><span className="font-semibold text-base-content/80">Vreme:</span> {selectedSlotTime}</p>
                <p><span className="font-semibold text-base-content/80">Radnik:</span> {finalSelectedWorkerName}</p>
                <div className="form-control w-full mt-2">
                    <label className="label pb-1" htmlFor="bookingNotes"><span className="label-text font-semibold text-base-content/80">Napomena (opciono):</span></label>
                    <textarea id="bookingNotes" className="textarea textarea-bordered h-20 text-sm" placeholder="Dodatne želje ili informacije..." value={bookingNotes || ''} onChange={(e) => setBookingNotes(e.target.value)}></textarea>
                </div>
            </div>

            {bookingStatus === 'error' && bookingError && (
                <div role="alert" className="alert alert-error text-sm p-3 mb-3">
                    <ShieldAlert className="h-5 w-5"/>
                    <span>{bookingError}</span>
                </div>
            )}
            {bookingStatus === 'success' && ( 
                <div role="alert" className="alert alert-success text-sm p-3 mb-3">
                    <CheckCircle2 className="h-5 w-5"/>
                    <span>Vaš zahtev za termin je uspešno poslat!</span>
                </div>
            )}

            <button
                onClick={handleAttemptBooking}
                disabled={isSubmitting || !isAuthLoaded || bookingStatus === 'submitting'}
                className={`btn btn-lg w-full ${isSubmitting || !isAuthLoaded ? 'btn-disabled' : (isSignedIn ? 'btn-success' : 'btn-primary')}`}
            >
                {isSubmitting || bookingStatus === 'submitting' ? <><Loader2 className="animate-spin mr-2"/> Slanje Zahteva...</>
                : !isAuthLoaded ? <><Loader2 className="animate-spin mr-2"/> Učitavanje...</>
                : isSignedIn ? 'Potvrdi i Zakaži'
                : 'Prijavite se da Zakažete'}
            </button>
            {!isSignedIn && isAuthLoaded && <p className="text-xs text-center mt-2 text-base-content/70">Bićete preusmereni na stranicu za prijavu.</p>}
            </section>
        )}

        {/* Back Button */}
        {currentStep !== 'SELECT_VENDOR' && (
            <div className="mt-10 text-center">
                <button onClick={() => {
                    if (currentStep === 'SELECT_SERVICE') { handleGoToStep('SELECT_VENDOR'); }
                    else if (currentStep === 'SELECT_WORKER') { handleGoToStep('SELECT_SERVICE'); }
                    else if (currentStep === 'SELECT_DATETIME') { handleGoToStep('SELECT_WORKER'); }
                    else if (currentStep === 'CONFIRM') { handleGoToStep('SELECT_DATETIME'); }
                }} className="btn btn-ghost text-sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Nazad na prethodni korak
                </button>
            </div>
        )}

        {/* Success Modal */}
        <dialog id="success_booking_modal" className="modal" ref={successModalRef}>
            <form method="dialog" className="modal-box text-center bg-base-100 shadow-xl">
            <CheckCircle2 className="text-success h-14 w-14 mx-auto mb-3" />
            <h3 className="font-bold text-xl text-success">Uspešno Poslato!</h3>
            <p className="py-3 text-base-content/90">Vaš zahtev za termin je uspešno poslat salonu. Očekujte potvrdu uskoro.</p>
            <div className="modal-action justify-center">
                <button className="btn btn-primary" onClick={() => {
                    successModalRef.current?.close();
                    router.push('/user'); 
                }}>Moji Termini</button>
                <button className="btn btn-ghost" onClick={() => {
                    successModalRef.current?.close();
                    setCurrentStep('SELECT_VENDOR'); 
                    selectVendor(null); 
                }}>Zakaži Novi</button>
            </div>
            </form>
        </dialog>

        {/* Global Styles for DatePicker (scoped with jsx global) */}
        <style jsx global>{`
            .react-datepicker-wrapper { display: inline-block; width: auto; }
            .react-datepicker__input-container input {
                width: 100% !important; 
                padding: 0.5rem 0.75rem !important;
                border-radius: var(--rounded-btn, 0.5rem) !important;
                border: 1px solid hsl(var(--bc) / 0.2) !important;
            }
            .react-datepicker__input-container input:focus {
                outline: 2px solid transparent;
                outline-offset: 2px;
                border-color: hsl(var(--p)) !important;
                box-shadow: 0 0 0 2px hsl(var(--p) / 0.2);
            }
            .react-datepicker {
            font-family: inherit;
            border: 1px solid hsl(var(--b3, var(--bc) / 0.2));
            background-color: hsl(var(--b1, #ffffff));
            color: hsl(var(--bc, #000000));
            border-radius: var(--rounded-box, 0.75rem); 
            box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05));
            padding: 0.25rem; 
            }
            .react-datepicker__header {
            background-color: hsl(var(--b2, var(--b1))); 
            border-bottom: 1px solid hsl(var(--b3, var(--bc) / 0.1));
            padding-top: 8px;
            border-top-left-radius: calc(var(--rounded-box, 0.75rem) - 0.25rem); 
            border-top-right-radius: calc(var(--rounded-box, 0.75rem) - 0.25rem);
            }
            .react-datepicker__current-month,
            .react-datepicker-time__header,
            .react-datepicker-year-header {
            color: hsl(var(--bc));
            font-weight: 600;
            font-size: 0.95rem; 
            }
            .react-datepicker__day-name,
            .react-datepicker__day,
            .react-datepicker__time-name {
            color: hsl(var(--bc));
            width: 2.1rem; 
            line-height: 2.1rem;
            margin: 0.15rem; 
            font-size: 0.8rem;
            }
            .react-datepicker__day--selected,
            .react-datepicker__day--in-selecting-range,
            .react-datepicker__day--in-range,
            .react-datepicker__day--keyboard-selected {
            background-color: hsl(var(--p)) !important;
            color: hsl(var(--pc)) !important;
            border-radius: var(--rounded-btn, 0.375rem); 
            }
            .react-datepicker__day--selected:hover {
                background-color: hsl(var(--pf, var(--p))) !important; 
            }
            .react-datepicker__day:not(.react-datepicker__day--selected):not(.react-datepicker__day--disabled):not(.react-datepicker__day--past):hover {
            background-color: hsl(var(--p)/0.1);
            border-radius: var(--rounded-btn, 0.375rem);
            }
            .react-datepicker__day--disabled,
            .react-datepicker__day--past:not(.react-datepicker__day--selected) {
            color: hsl(var(--bc) / 0.4) !important; 
            background-color: transparent !important; 
            cursor: not-allowed !important;
            text-decoration: line-through; 
            opacity: 0.6;
            }
            .react-datepicker__day--disabled:hover,
            .react-datepicker__day--past:not(.react-datepicker__day--selected):hover {
                background-color: transparent !important;
            }
            .react-datepicker__navigation {
            top: 10px; 
            }
            .react-datepicker__navigation-icon::before {
            border-color: hsl(var(--bc) / 0.7); 
            border-width: 2px 2px 0 0;
            height: 6px; 
            width: 6px;
            }
            .react-datepicker__navigation:hover .react-datepicker__navigation-icon::before {
                border-color: hsl(var(--p));
            }
            .react-datepicker__month {
                margin: 0.25rem; 
            }
            .react-datepicker-popper[data-placement^="bottom"] .react-datepicker__triangle::before,
            .react-datepicker-popper[data-placement^="bottom"] .react-datepicker__triangle::after {
                border-bottom-color: hsl(var(--b2, var(--b1))) !important;
            }
            .react-datepicker-popper {
                z-index: 55 !important; 
            }
        `}</style>
        </div>
    );
    }

    export default function BookingPage() {
    return (
        <Suspense fallback={<BookingPageSkeleton title="Učitavanje stranice za rezervaciju..." />}>
        <BookingForm />
        </Suspense>
    );
    }

    function BookingPageSkeleton({ title }: { title?: string}) {
        return (
            <div className="container mx-auto p-2 sm:p-4 lg:p-6 animate-pulse">
                <div className="text-center mb-8">
                    <div className="h-8 bg-base-300 rounded w-3/4 md:w-1/2 mx-auto mb-2"></div>
                    <div className="h-6 bg-base-300 rounded w-1/2 md:w-1/3 mx-auto"></div>
                    {title && <p className="text-sm text-base-content/60 mt-4">{title}</p>}
                </div>
                <div className="flex justify-around mb-8 steps w-full">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className={`step h-6 bg-base-300 rounded-full w-1/6 ${i > 0 ? 'opacity-60' : 'opacity-100'}`}></div>
                    ))}
                </div>
                <div className="mb-6 p-3 sm:p-5 card bg-base-200 shadow-lg">
                    <div className="h-7 bg-base-300 rounded w-1/3 mb-5"></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[1,2,3].map(i=>(
                            <div key={i} className="card bg-base-100 h-32 rounded-lg">
                                <div className="card-body p-3 sm:p-4 space-y-2">
                                    <div className="h-5 bg-base-300 rounded w-3/4"></div>
                                    <div className="h-4 bg-base-300 rounded w-full mt-1"></div>
                                    <div className="h-4 bg-base-300 rounded w-5/6 mt-1"></div>
                                    <div className="h-4 bg-base-300 rounded w-1/2 mt-2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-10 text-center">
                    <div className="h-10 bg-base-300 rounded w-1/4 mx-auto"></div>
                </div>
            </div>
        );
    }