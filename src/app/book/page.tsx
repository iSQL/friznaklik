// src/app/book/page.tsx
'use client'; // This directive marks this as a Client Component

import { useBookingStore } from '@/store/bookingStore'; // Import the Zustand booking store
import { useState, useEffect, Suspense, useRef } from 'react'; // Import React hooks, added Suspense and useRef
import { Service } from '@prisma/client'; // Import the Service type from Prisma
import Link from 'next/link'; // Import Link for navigation
import { useSearchParams } from 'next/navigation'; // Import for reading URL query params
import { formatErrorMessage, type FormattedError } from '@/lib/errorUtils'; // Import the error utility and its type

// Import react-datepicker and its CSS
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Import format function from date-fns
import { format } from 'date-fns';

// Define the base URL for your API.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Interface for the structured error payload when booking fails
interface BookingErrorPayload {
  message: string;
  status: number;
  details?: string; // Details might come from the server or be the raw text
}


// New component to handle search param logic, because useSearchParams needs to be under Suspense
function BookingForm() {
  const searchParams = useSearchParams(); // Hook to access URL query parameters
  const successModalRef = useRef<HTMLDialogElement>(null); // Ref for the success modal

  // Access state and actions from the Zustand store
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
  } = useBookingStore();

  // State to hold the list of available services fetched from the API
  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  // State to track loading of available slots
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // Fetch the list of services when the component mounts
  useEffect(() => {
    const fetchServices = async () => {
      setIsLoadingServices(true);
      setServicesError(null);
      try {
        const response = await fetch(`${SITE_URL}/api/services`);
        if (!response.ok) {
          const errorText = await response.text();
          const errorToThrow: FormattedError = {
            message: `Failed to fetch services: ${response.status}`,
            originalError: errorText,
            context: "fetching services",
            status: response.status
          };
          throw errorToThrow;
        }
        const data: Service[] = await response.json();
        setServices(data);
      } catch (err: unknown) {
        setServicesError(formatErrorMessage(err, "fetching services"));
      } finally {
        setIsLoadingServices(false);
      }
    };

    fetchServices();
  }, []);

  // Effect to pre-select service if serviceId is in URL and services are loaded
  useEffect(() => {
    const serviceIdFromUrl = searchParams.get('serviceId');
    if (serviceIdFromUrl && services.length > 0) {
      const serviceExists = services.some(s => s.id === serviceIdFromUrl);
      if (serviceExists) {
        console.log(`Pre-selecting service from URL: ${serviceIdFromUrl}`);
        selectService(serviceIdFromUrl);
      } else {
        console.warn(`Service ID ${serviceIdFromUrl} from URL not found in fetched services.`);
      }
    }
  }, [searchParams, services, selectService]);


  // Fetch available slots when selectedServiceId or selectedDate changes
  useEffect(() => {
    if (selectedServiceId && selectedDate) {
      const fetchAvailableSlots = async () => {
        setIsLoadingSlots(true);
        setSlotsError(null);
        setAvailableSlots([]);

        try {
          const formattedDate = format(selectedDate, 'yyyy-MM-dd');
          console.log(`Fetching slots for service ${selectedServiceId} on date ${formattedDate}`);

          const response = await fetch(`${SITE_URL}/api/appointments/available?serviceId=${selectedServiceId}&date=${formattedDate}`);

          if (!response.ok) {
            const errorText = await response.text();
            const errorToThrow: FormattedError = {
              message: `Failed to fetch available slots: ${response.status}`,
              originalError: errorText,
              context: "fetching available slots",
              status: response.status
            };
            throw errorToThrow;
          }
          const data: string[] = await response.json();
          setAvailableSlots(data);
        } catch (err: unknown) {
          setSlotsError(formatErrorMessage(err, "fetching available slots"));
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
  };

  const handleDateSelect = (date: Date | null) => {
    selectDate(date);
    setStoreSelectedSlot(null); // Reset slot when date changes
    setSlotsError(null);
  };

  const handleSlotSelect = (slot: string) => {
    setStoreSelectedSlot(slot);
  };

  const handleBookingSubmit = async () => {
    if (!selectedServiceId || !selectedDate || !selectedSlot) {
      console.error("Attempted booking without all required selections.");
      setBookingError("Please select a service, date, and time slot.");
      setBookingStatus('error');
      return;
    }

    setBookingStatus('submitting');
    setBookingError(null);

    try {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`${SITE_URL}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          date: formattedDate,
          slot: selectedSlot,
        }),
      });

      if (!response.ok) {
        const errorPayload: BookingErrorPayload = {
          message: `Booking failed with status ${response.status}`,
          status: response.status
        };
        try {
          const errorData = await response.json();
          errorPayload.details = errorData.message || errorData.error || errorData.details || JSON.stringify(errorData);
        } catch (e) {
          console.error("Failed to parse error response:", e);
          errorPayload.details = await response.text();
        }
        throw errorPayload;
      }

      setBookingStatus('success');
      console.log('Appointment requested successfully!');
      successModalRef.current?.showModal(); // Show the success modal

      // Reset form state after successful booking and modal display
      selectDate(null);
      setStoreSelectedSlot(null);
      // Optionally, you could reset the service as well, or navigate away
      // selectService(null); 

    } catch (err: unknown) {
      setBookingStatus('error');
      if (typeof err === 'object' && err !== null && 'message' in err) {
        const knownError = err as BookingErrorPayload;
        setBookingError(formatErrorMessage(knownError, "booking submission"));
      } else {
        setBookingError(formatErrorMessage(err, "booking submission"));
      }
    }
  };

  const selectedServiceName = services.find(s => s.id === selectedServiceId)?.name || 'Service';


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-8 text-center text-neutral-content">
        Book an Appointment
      </h1>

      {/* Step 1: Service Selection */}
      <div className="mb-8 p-6 card bg-base-200 shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 card-title">1. Select a Service</h2>
        {isLoadingServices ? (
          <div className="flex justify-center items-center h-24">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : servicesError ? (
          <div role="alert" className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{servicesError}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                className={`card bordered cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md ${
                  selectedServiceId === service.id
                    ? 'border-primary ring-2 ring-primary bg-primary/10'
                    : 'bg-base-100 border-base-300 hover:border-primary/70'
                }`}
                onClick={() => handleServiceSelect(service.id)}
              >
                <div className="card-body p-4">
                  <h3 className="card-title text-lg">{service.name}</h3>
                  <p className="text-sm text-base-content/70 mb-1 line-clamp-2">{service.description || "No description"}</p>
                  <p className="font-semibold text-base-content/90">${service.price.toFixed(2)} - {service.duration} min</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 & 3: Date and Time Slot Selection (Combined) */}
      {selectedServiceId && (
        <div className="mb-8 p-6 card bg-base-200 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 card-title">2. Select Date & Time for {selectedServiceName}</h2>
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Date Selection Column */}
            <div className="flex-1 lg:max-w-md"> {/* Constrain width of date picker on larger screens */}
              <h3 className="text-xl font-medium mb-3 text-neutral-content">Date</h3>
              <div className="p-4 border rounded-lg inline-block bg-base-100 border-base-300 shadow-sm">
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateSelect}
                  dateFormat="yyyy/MM/dd"
                  minDate={new Date()}
                  filterDate={(date) => date.getDay() !== 0 && date.getDay() !== 6}
                  inline
                  className="react-datepicker-override"
                />
              </div>
            </div>

            {/* Time Slot Selection Column */}
            {selectedDate && ( // Only show slots if a date is selected
              <div className="flex-1 min-w-0"> {/* min-w-0 helps flex item shrink correctly */}
                <h3 className="text-xl font-medium mb-3 text-neutral-content">
                  Available Slots for {format(selectedDate, 'MMMM d, yyyy')}
                </h3>
                {isLoadingSlots ? (
                  <div className="flex justify-center items-center h-24">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                  </div>
                ) : slotsError ? (
                  <div role="alert" className="alert alert-error">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>{slotsError}</span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-base-content/70 mt-2">No available slots for the selected date. Please try another date.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {availableSlots.map(slot => (
                      <button
                        key={slot}
                        className={`btn ${
                          selectedSlot === slot
                            ? 'btn-primary'
                            : 'btn-outline btn-ghost hover:bg-primary/10 hover:border-primary'
                        }`}
                        onClick={() => handleSlotSelect(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Global styles for react-datepicker to match DaisyUI theme */}
      <style jsx global>{`
        .react-datepicker-wrapper {
          display: inline-block;
        }
        .react-datepicker {
          font-family: inherit;
          border-color: hsl(var(--b3));
          background-color: hsl(var(--b1));
          color: hsl(var(--bc));
          border-radius: var(--rounded-box, 1rem);
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
          font-weight: bold;
        }
        .react-datepicker__day-name,
        .react-datepicker__day,
        .react-datepicker__time-name {
          color: hsl(var(--bc));
          width: 2rem;
          line-height: 2rem;
          margin: 0.166rem;
        }
        .react-datepicker__day--selected,
        .react-datepicker__day--in-selecting-range,
        .react-datepicker__day--in-range,
        .react-datepicker__month-text--selected,
        .react-datepicker__month-text--in-selecting-range,
        .react-datepicker__month-text--in-range,
        .react-datepicker__quarter-text--selected,
        .react-datepicker__quarter-text--in-selecting-range,
        .react-datepicker__quarter-text--in-range,
        .react-datepicker__year-text--selected,
        .react-datepicker__year-text--in-selecting-range,
        .react-datepicker__year-text--in-range {
          background-color: hsl(var(--p));
          color: hsl(var(--pc));
          border-radius: var(--rounded-btn, 0.5rem);
        }
        .react-datepicker__day--selected:hover,
        .react-datepicker__day--keyboard-selected {
            background-color: hsl(var(--pf, var(--p)));
            color: hsl(var(--pc));
        }
        .react-datepicker__day:hover {
          background-color: hsl(var(--p)/0.1);
          border-radius: var(--rounded-btn, 0.5rem);
        }
        .react-datepicker__day--disabled {
          color: hsl(var(--bc) / 0.4);
          cursor: default;
        }
        .react-datepicker__day--disabled:hover {
          background-color: transparent;
        }
        .react-datepicker__navigation {
          top: 10px;
        }
        .react-datepicker__navigation-icon::before {
          border-color: hsl(var(--bc));
          border-width: 2px 2px 0 0;
          height: 8px;
          width: 8px;
        }
        .react-datepicker__navigation:hover .react-datepicker__navigation-icon::before {
            border-color: hsl(var(--p));
        }
      `}</style>

      {/* Step 4: Booking Button & Status */}
      {selectedSlot && selectedDate && selectedServiceId && (
        <div className="mt-6 p-6 card bg-base-200 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 card-title">3. Confirm Your Booking</h2> {/* Changed step number */}
          <div className="mb-4 space-y-1 text-base-content/90">
            <p><span className="font-semibold">Service:</span> {selectedServiceName}</p>
            <p><span className="font-semibold">Date:</span> {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'N/A'}</p>
            <p><span className="font-semibold">Time:</span> {selectedSlot}</p>
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
                <span className="loading loading-spinner loading-sm"></span>
                Requesting...
              </>
            ) : (
              'Request Appointment'
            )}
          </button>
          {/* Error message display (remains inline for now) */}
          {bookingStatus === 'error' && bookingError && (
            <div role="alert" className="alert alert-error mt-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <h3 className="font-bold">Booking Failed!</h3>
                <div className="text-xs">{bookingError}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/" className="btn btn-ghost">
          &larr; Back to Home
        </Link>
      </div>

      {/* Success Modal */}
      <dialog id="success_booking_modal" className="modal modal-bottom sm:modal-middle" ref={successModalRef}>
        <div className="modal-box text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-success shrink-0 h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          <h3 className="font-bold text-2xl">Success!</h3>
          <p className="py-4 text-base">Your appointment has been successfully requested. You&apos;ll receive confirmation once it&apos;s approved.</p>
          <div className="modal-action justify-center">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn btn-primary">Great!</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
            <button>close</button> {/* Allows closing by clicking backdrop */}
        </form>
      </dialog>

    </div>
  );
}

// This is the main page component that Next.js will render.
export default function BookingPage() {
  return (
    <Suspense fallback={<BookingPageSkeleton />}>
      <BookingForm />
    </Suspense>
  );
}

// Skeleton component for loading state while Suspense resolves
function BookingPageSkeleton() {
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
            <div className="h-10 bg-base-300 rounded w-1/2 mx-auto mb-8"></div>

            {/* Service Selection Skeleton */}
            <div className="mb-8 p-6 card bg-base-200 shadow-lg">
                <div className="h-8 bg-base-300 rounded w-1/3 mb-4"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card bordered bg-base-100">
                            <div className="card-body p-4">
                                <div className="h-6 bg-base-300 rounded w-3/4 mb-2"></div>
                                <div className="h-4 bg-base-300 rounded w-full mb-1"></div>
                                <div className="h-4 bg-base-300 rounded w-5/6 mb-2"></div>
                                <div className="h-5 bg-base-300 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

             {/* Date & Time Skeleton (Combined) */}
            <div className="mb-8 p-6 card bg-base-200 shadow-lg">
                <div className="h-8 bg-base-300 rounded w-2/5 mb-6"></div> {/* Skeleton for section title */}
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                    {/* Date Picker Skeleton */}
                    <div className="flex-1 lg:max-w-md">
                        <div className="h-7 bg-base-300 rounded w-1/4 mb-3"></div> {/* "Date" title skeleton */}
                        <div className="p-4 bg-base-100 rounded-lg inline-block">
                            <div className="h-64 w-72 bg-base-300 rounded-md"></div>
                        </div>
                    </div>
                    {/* Time Slot Skeleton */}
                    <div className="flex-1 min-w-0">
                        <div className="h-7 bg-base-300 rounded w-1/2 mb-3"></div> {/* "Available Slots" title skeleton */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-12 bg-base-300 rounded-lg"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

             {/* Confirmation Skeleton */}
             <div className="mt-6 p-6 card bg-base-200 shadow-lg">
                <div className="h-8 bg-base-300 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-base-300 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-base-300 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-base-300 rounded w-1/3 mb-4"></div>
                <div className="h-12 bg-base-300 rounded-lg w-full sm:w-1/3"></div>
            </div>


            <div className="mt-10 text-center">
                <div className="h-10 bg-base-300 rounded w-1/4 mx-auto"></div>
            </div>
        </div>
    );
}
